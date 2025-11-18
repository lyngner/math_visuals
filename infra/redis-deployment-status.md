# Redis deployment status

This document tracks the Redis provisioning workflow that needs to run outside of the
repository. All commands assume the AWS CLI is configured with credentials that can
create CloudFormation stacks, Secrets Manager secrets and SSM parameters.

## 1. Shared parameter exports

Run the shared coordination stack once per environment before anything else so the
exported parameter/secret names exist:

```bash
aws cloudformation deploy \
  --region eu-west-1 \
  --stack-name math-visuals-shared \
  --template-file infra/shared-parameters.yaml \
  --parameter-overrides EnvironmentName=prod
```

This step failed in CI because the execution environment does not expose AWS
credentials. You must run it from an authenticated workstation or pipeline that
has access to the target AWS account.

## 2. Data plane (VPC + Redis)

Deploy `infra/data/template.yaml` after the shared stack so the template can
import the exported names. Provide the ElastiCache auth token via a dynamic
Secrets Manager reference to keep it out of plaintext:

```bash
aws cloudformation deploy \
  --region eu-west-1 \
  --stack-name math-visuals-data \
  --template-file infra/data/template.yaml \
  --parameter-overrides \
    EnvironmentName=prod \
    SharedParametersStackName=math-visuals-shared \
    RedisAuthToken='{{resolve:secretsmanager:math-visuals/prod/redis/auth:SecretString:authToken}}'
```

ElastiCache auth tokens must be 32–128 printable ASCII characters with no spaces
or quotes; violating those rules triggers an "Invalid AUTH token" rollback.

This command was not executed locally for the same credential reasons as above.
It provisions the VPC, subnets, Lambda security group, Redis replication group
and the Redis-related SSM parameters/Secrets Manager secret described in the
template.

### 2a. Verifiser eksportene etter deploy

Når stacken er ferdig, dobbeltsjekk at eksportene i `eu-west-1` peker til de nye
ressursene (VPC, subnett, sikkerhetsgrupper og Redis-endepunkter). I
CloudShell/CLI kan du kjøre:

```bash
aws cloudformation list-exports \
  --region eu-west-1 \
  --query 'Exports[?starts_with(Name, `math-visuals-data-`) == `true`].[Name,Value]' \
  --output table
```

Bruk `describe-stacks` for å hente de menneskevennlige beskrivelsene dersom noe
ser uklart ut:

```bash
aws cloudformation describe-stacks \
  --region eu-west-1 \
  --stack-name math-visuals-data \
  --query 'Stacks[0].Outputs[*].{Key:OutputKey,Value:OutputValue,Description:Description}' \
  --output table
```

Bekreft spesielt at `VpcId`, `PrivateSubnet*Id`, `LambdaSecurityGroupId`,
`RedisPrimaryEndpoint`, `RedisReaderEndpoint` og `RedisPort` samsvarer med de
nylige ressurs-ID-ene i regionen. Ta skjermbilde eller noter CloudFormation
`LastUpdatedTime` sammen med eksportnavnet så det er lett å vise at verdiene ble
oppdatert.

### 2b. Notér verdier for API-stack og secrets

API-stacken og GitHub-secrets forventer tre operasjonelle verdier: Redis-endepunkt,
port og passord. Hent dem fra outputs og skriv dem ned i et sikkert vault (f.eks.
1Password eller AWS Secrets Manager) sammen med tidsstempel og stack-versjon.
En enkel måte å hente verdiene på er:

```bash
DATA_STACK=math-visuals-data
REGION=eu-west-1

aws cloudformation describe-stacks \
  --region "$REGION" \
  --stack-name "$DATA_STACK" \
  --query 'Stacks[0].Outputs[?OutputKey==`RedisPrimaryEndpoint` || OutputKey==`RedisReaderEndpoint` || OutputKey==`RedisPort` || OutputKey==`RedisPasswordSecretName` || starts_with(OutputKey, `RedisEndpointParameterName`)].{Key:OutputKey,Value:OutputValue}' \
  --output table
```

Kopier følgende til en sikker notatfil (ikke sjekk inn hemmelighetene):

- `RedisPrimaryEndpoint`
- `RedisReaderEndpoint`
- `RedisPort`
- `RedisPasswordSecretName`
- `RedisEndpointParameterName`
- `RedisReaderEndpointParameterName`
- `RedisPortParameterName`

Disse verdiene brukes når API-stacken oppdateres og når GitHub-secrets skal
synkroniseres. Lagre også VPC- og sikkerhetsgruppe-ID-ene slik at Lambda kan
kjøres inne i samme nettverk.

## 3. Populate Secrets Manager/SSM + mirror to GitHub

After the stacks are in place, run the helper to push the Redis endpoint, port
and auth token and to update the frontend allow-lists:

```bash
SHARED_STACK=math-visuals-shared \
STATIC_STACK=math-visuals-static-site \
SHARED_REGION=eu-west-1 \
STATIC_REGION=eu-west-1 \
  ./scripts/update-shared-params.sh
```

The script prompts for the Redis values, writes them to Secrets Manager and SSM
(based on the names exported by the shared stack) and prints the values that
need to be copied into the `REDIS_PASSWORD`, `REDIS_ENDPOINT` and `REDIS_PORT`
GitHub secrets. Running it requires AWS credentials, so the step could not be
performed here.

## 4. Lambda packaging, parameters and verification

The API stack already loads the Redis endpoint/port/secret via dynamic
references (`REDIS_*` environment variables inside `infra/api/template.yaml`).
Because that template does not embed the Lambda code inline, you **must**
provide the Lambda artefact location through the `LambdaCodeS3Bucket`,
`LambdaCodeS3Key` and (optionally) `LambdaCodeS3ObjectVersion` parameters.

Package the Lambda from the repository root either with the helper script or by
running the equivalent manual commands:

```bash
# Scripted
./scripts/package-api-lambda.sh

# Manual alternative
(cd infra/api/lambda && npm ci --omit=dev)
rm -rf infra/api/build
mkdir -p infra/api/build/api infra/api/build/palette
cp infra/api/runtime/index.js infra/api/build/index.js
cp infra/api/lambda/package.json infra/api/build/package.json
cp infra/api/lambda/package-lock.json infra/api/build/package-lock.json
cp -R infra/api/lambda/node_modules infra/api/build/node_modules
rsync -a --exclude 'node_modules' api/ infra/api/build/api/
rsync -a palette/ infra/api/build/palette/
(cd infra/api/build && zip -qr ../api-lambda.zip .)
```

Upload the artefact to S3 so CloudFormation can pick it up. Before running
`aws s3 cp` or the API stack deploy, make sure the variables point to an
existing artefact bucket in `eu-north-1`:

```bash
# Configure the destination; the bucket must already exist in eu-north-1
export ARTIFACT_BUCKET=math-visuals-artifacts-eun1
export ARTIFACT_KEY=api/api-lambda.zip
# Optional: only set if you want to pin a specific object version
export ARTIFACT_VERSION=

aws s3 cp infra/api/api-lambda.zip s3://$ARTIFACT_BUCKET/$ARTIFACT_KEY
```

When redeploying the API stack, include the required parameters so the template
knows where to pull the Lambda code from:

```bash
aws cloudformation deploy \
  --region eu-west-1 \
  --stack-name math-visuals-api \
  --template-file infra/api/template.yaml \
  --parameter-overrides \
    LambdaCodeS3Bucket=$ARTIFACT_BUCKET \
    LambdaCodeS3Key=$ARTIFACT_KEY \
    LambdaCodeS3ObjectVersion=$ARTIFACT_VERSION \
    # other parameters ...
```

After the redeploy, verify that the Lambda runtime reports `mode: "kv"` by
inspecting the CloudWatch logs:

```bash
aws logs tail /aws/lambda/math-visuals-api \
  --region eu-west-1 \
  --since 10m \
  --filter-pattern 'mode" "kv"'
```

Because CloudWatch is also unreachable without valid AWS credentials, this
verification has to happen in the target AWS account.
