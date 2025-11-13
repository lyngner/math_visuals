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
REGION=eu-north-1

REDIS_SECRET_NAME=$(aws cloudformation describe-stacks \
  --stack-name "$SHARED_STACK" \
  --query 'Stacks[0].Outputs[?OutputKey==`RedisPasswordSecretName`].OutputValue' \
  --output text)

EXAMPLES_ALLOWED_ORIGINS=$(aws cloudformation describe-stacks \
  --stack-name "$SHARED_STACK" \
  --query 'Stacks[0].Outputs[?OutputKey==`ExamplesAllowedOriginsParameterName`].OutputValue' \
  --output text)

SVG_ALLOWED_ORIGINS=$(aws cloudformation describe-stacks \
  --stack-name "$SHARED_STACK" \
  --query 'Stacks[0].Outputs[?OutputKey==`SvgAllowedOriginsParameterName`].OutputValue' \
  --output text)

# Update the Redis password/auth token stored in Secrets Manager
aws secretsmanager put-secret-value \
  --region "$REGION" \
  --secret-id "$REDIS_SECRET_NAME" \
  --secret-string '{"authToken":"<redis-password>"}'

# Update the Redis endpoint and port parameters
aws ssm put-parameter \
  --region "$REGION" \
  --name "$(aws cloudformation describe-stacks --stack-name "$SHARED_STACK" \
      --query 'Stacks[0].Outputs[?OutputKey==`RedisEndpointParameterName`].OutputValue' \
      --output text)" \
  --type String \
  --value 'redis.prod.example.cache.amazonaws.com' \
  --overwrite

aws ssm put-parameter \
  --region "$REGION" \
  --name "$(aws cloudformation describe-stacks --stack-name "$SHARED_STACK" \
      --query 'Stacks[0].Outputs[?OutputKey==`RedisPortParameterName`].OutputValue' \
      --output text)" \
  --type String \
  --value '6379' \
  --overwrite

# Update the frontend allow-lists used by the API and CloudFront
aws ssm put-parameter \
  --region "$REGION" \
  --name "$EXAMPLES_ALLOWED_ORIGINS" \
  --type String \
  --value 'https://mathvisuals.no,https://admin.mathvisuals.no' \
  --overwrite

aws ssm put-parameter \
  --region "$REGION" \
  --name "$SVG_ALLOWED_ORIGINS" \
  --type String \
  --value 'https://mathvisuals.no,https://admin.mathvisuals.no' \
  --overwrite
```

Repeat the `put-secret-value` and `put-parameter` commands whenever the Redis or
allowed-origins configuration changes. The next deployment will automatically
pick up the updated values because the templates resolve them dynamically.

### CI-integrasjon og nødvendige secrets

GitHub Actions-workflowen [`deploy-infra.yml`](../.github/workflows/deploy-infra.yml)
synkroniserer verdiene ovenfor automatisk før API-stacken deployes. Workflowen
bruker outputs fra `SharedParametersStackName` til å finne navnene på Secrets
Manager- og SSM-ressursene, og skriver følgende GitHub Secrets inn i dem:

- `REDIS_PASSWORD` – JSON-feltet `authToken` som lagres i Secrets Manager.
- `REDIS_ENDPOINT` – hostnavnet som plasseres i Parameter Store.
- `REDIS_PORT` – portnummeret som plasseres i Parameter Store.

Dersom én av hemmelighetene mangler vil workflowen stoppe før API-deployen slik
at man slipper å pushe en stack uten konsistente Redis-verdier.
