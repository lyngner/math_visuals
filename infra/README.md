# Infrastructure configuration

This repository contains multiple CloudFormation/SAM templates under `infra/`.
`shared-parameters.yaml` acts as a lightweight coordination layer that keeps the
Secrets Manager and Systems Manager parameter names consistent across stacks.

## Shared parameter stack

Deploy the shared parameter template once per environment before any other
stacks that consume the values:

```bash
aws cloudformation deploy \
  --stack-name math-visuals-shared \
  --template-file infra/shared-parameters.yaml \
  --parameter-overrides EnvironmentName=prod
```

The stack exports the canonical names for the Redis connection secrets/parameters
and the frontend origin allow-lists. Other templates import these exports by
passing `SharedParametersStackName=math-visuals-shared`.

## Setting secret and parameter values before deployment

The consuming stacks use dynamic references to resolve the values at deploy
and runtime. Make sure the Secrets Manager secret and SSM parameters exist (and
contain the latest values) **before** deploying the API, static site or data
stacks:

```bash
SHARED_STACK=math-visuals-shared
STATIC_STACK=math-visuals-static-site
SHARED_REGION=eu-north-1
STATIC_REGION=eu-west-1

REDIS_SECRET_NAME=$(aws cloudformation describe-stacks \
  --region "$SHARED_REGION" \
  --stack-name "$SHARED_STACK" \
  --query 'Stacks[0].Outputs[?OutputKey==`RedisPasswordSecretName`].OutputValue' \
  --output text)

EXAMPLES_ALLOWED_ORIGINS=$(aws cloudformation describe-stacks \
  --region "$SHARED_REGION" \
  --stack-name "$SHARED_STACK" \
  --query 'Stacks[0].Outputs[?OutputKey==`ExamplesAllowedOriginsParameterName`].OutputValue' \
  --output text)

SVG_ALLOWED_ORIGINS=$(aws cloudformation describe-stacks \
  --region "$SHARED_REGION" \
  --stack-name "$SHARED_STACK" \
  --query 'Stacks[0].Outputs[?OutputKey==`SvgAllowedOriginsParameterName`].OutputValue' \
  --output text)

# Update the Redis password/auth token stored in Secrets Manager
aws secretsmanager put-secret-value \
  --region "$SHARED_REGION" \
  --secret-id "$REDIS_SECRET_NAME" \
  --secret-string '{"authToken":"<redis-password>"}'

# Update the Redis endpoint and port parameters
aws ssm put-parameter \
  --region "$SHARED_REGION" \
  --name "$(aws cloudformation describe-stacks --region "$SHARED_REGION" --stack-name "$SHARED_STACK" \
      --query 'Stacks[0].Outputs[?OutputKey==`RedisEndpointParameterName`].OutputValue' \
      --output text)" \
  --type String \
  --value 'redis.prod.example.cache.amazonaws.com' \
  --overwrite

aws ssm put-parameter \
  --region "$SHARED_REGION" \
  --name "$(aws cloudformation describe-stacks --region "$SHARED_REGION" --stack-name "$SHARED_STACK" \
      --query 'Stacks[0].Outputs[?OutputKey==`RedisPortParameterName`].OutputValue' \
      --output text)" \
  --type String \
  --value '6379' \
  --overwrite

# Update the frontend allow-lists used by the API and CloudFront
CLOUDFRONT_DOMAIN=$(aws cloudformation describe-stacks \
  --region "$STATIC_REGION" \
  --stack-name "$STATIC_STACK" \
  --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontDistributionDomainName`].OutputValue' \
  --output text)

ALLOWLIST_VALUE="https://$CLOUDFRONT_DOMAIN,https://mathvisuals.no,https://app.mathvisuals.no"

aws ssm put-parameter \
  --region "$SHARED_REGION" \
  --name "$EXAMPLES_ALLOWED_ORIGINS" \
  --type StringList \
  --value "$ALLOWLIST_VALUE" \
  --overwrite

aws ssm put-parameter \
  --region "$SHARED_REGION" \
  --name "$SVG_ALLOWED_ORIGINS" \
  --type StringList \
  --value "$ALLOWLIST_VALUE" \
  --overwrite
```

We keep the shared stack (Secrets Manager/SSM) in `eu-north-1` together with the
API and Redis cluster, while the static site stack runs in `eu-west-1` for lower
latency to most visitors and proximity to the CloudFront/S3 origin. Using two
region variables makes it explicit which AWS calls talk to which stack.

Repeat the `put-secret-value` and `put-parameter` commands whenever the Redis or
allowed-origins configuration changes. The next deployment will automatically
pick up the updated values because the templates resolve them dynamically.

### CI-integrasjon og nødvendige secrets

GitHub Actions-workflowen [`deploy-infra.yml`](../.github/workflows/deploy-infra.yml)
synkroniserer verdiene ovenfor automatisk før API-stacken deployes. Workflowen
bruker outputs fra `SharedParametersStackName` til å finne navnene på Secrets
Manager- og SSM-ressursene, og forventer at følgende GitHub Secrets er definert
under **Settings → Secrets and variables → Actions**:

| Secret | Hva den brukes til |
| --- | --- |
| `REDIS_PASSWORD` | JSON-feltet `authToken` som lagres i Secrets Manager og som også sendes inn som `RedisAuthToken` når datastacken deployes. |
| `REDIS_ENDPOINT` | Hostnavnet som skrives til Parameter Store slik at Lambda/APIGW kan slå det opp. |
| `REDIS_PORT` | Portnummeret som skrives til Parameter Store slik at klientene vet hvilken port Redis eksponerer. |

Disse hemmelighetene må være tilstede i CI-miljøet. Workflowen validerer at alle
tre er satt og avbryter før API-deployen dersom én mangler, slik at man slipper
å pushe en stack uten konsistente Redis-verdier.
