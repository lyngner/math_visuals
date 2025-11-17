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

Use the helper script to update the Redis secrets and the frontend allow-list in
one go:

```bash
./scripts/update-shared-params.sh
```

The script:

1. Defaults to the production stack/region names (`math-visuals-shared`,
   `math-visuals-static-site`, `eu-north-1`, `eu-west-1`) but respects any of the
   `SHARED_STACK`, `STATIC_STACK`, `SHARED_REGION` and `STATIC_REGION`
   environment variables you export before running it.
2. Looks up the Secrets Manager/Parameter Store resource names from CloudFormation
   outputs, fetches the current Redis password/endpoint/port values, prompts for
   overrides and then writes the values back to Secrets Manager/SSM.
3. Resolves the CloudFront domain from the static stack, writes the required
   allow-list (`https://<domain>,https://mathvisuals.no,https://app.mathvisuals.no`)
   to a temporary file and updates both
   `EXAMPLES_ALLOWED_ORIGINS`/`SVG_ALLOWED_ORIGINS` via file-based input so the
   AWS CLI never tries to fetch HTTPS URLs during validation.
4. Prints a masked summary of the values that should be mirrored to the
   `REDIS_*` GitHub Action secrets.

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
