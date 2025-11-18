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

Upload the artefact to S3 so CloudFormation can pick it up:

```bash
aws s3 cp infra/api/api-lambda.zip s3://<artefact-bucket>/<path>/api-lambda.zip
```

When redeploying the API stack, include the required parameters so the template
knows where to pull the Lambda code from:

```bash
aws cloudformation deploy \
  --region eu-west-1 \
  --stack-name math-visuals-api \
  --template-file infra/api/template.yaml \
  --parameter-overrides \
    LambdaCodeS3Bucket=<artefact-bucket> \
    LambdaCodeS3Key=<path>/api-lambda.zip \
    LambdaCodeS3ObjectVersion=<optional-version> \
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
