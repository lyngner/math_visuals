# Redis deployment status

This document tracks the Redis provisioning workflow that needs to run outside of the
repository. All commands assume the AWS CLI is configured with credentials that can
create CloudFormation stacks, Secrets Manager secrets and SSM parameters. If you just
need the exact commands to paste into AWS CloudShell, jump to the checklist below.

## CloudShell quick reference

Prerequisite (run once per environment before step 2):

```bash
aws secretsmanager create-secret \
  --region eu-north-1 \
  --name math-visuals/prod/redis/auth \
  --secret-string '{"authToken":"<32-128 printable ASCII chars>"}'
```

Use `aws secretsmanager put-secret-value` instead if the secret already exists and
just needs a new version.

```bash
# 1) Shared parameter exports
aws cloudformation deploy \
  --region eu-north-1 \
  --stack-name math-visuals-shared \
  --template-file infra/shared-parameters.yaml \
  --parameter-overrides EnvironmentName=prod

# 2) Data plane (VPC + Redis)
aws cloudformation deploy \
  --region eu-north-1 \
  --stack-name math-visuals-data \
  --template-file infra/data/template.yaml \
  --parameter-overrides \
    EnvironmentName=prod \
    SharedParametersStackName=math-visuals-shared \
    RedisAuthToken='{{resolve:secretsmanager:math-visuals/prod/redis/auth:SecretString:authToken}}'

# 3) Populate Secrets Manager/SSM + mirror to GitHub
SHARED_STACK=math-visuals-shared \
STATIC_STACK=math-visuals-static-site \
SHARED_REGION=eu-north-1 \
STATIC_REGION=eu-west-1 \
  ./scripts/update-shared-params.sh

# 4) Package + upload API Lambda, then redeploy the stack
scripts/package-api-lambda.sh
aws s3 cp infra/api/api-lambda.zip s3://<artifact-bucket>/api/api-lambda.zip --region eu-north-1
aws cloudformation deploy \
  --region eu-north-1 \
  --stack-name math-visuals-api \
  --template-file infra/api/template.yaml \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides \
    LambdaCodeS3Bucket=<artifact-bucket> \
    LambdaCodeS3Key=api/api-lambda.zip \
    [LambdaCodeS3ObjectVersion=<object-version-if-bucket-is-versioned>] \
    EnvironmentName=prod \
    DataStackName=math-visuals-data \
    SharedParametersStackName=math-visuals-shared

# 5) Verify Lambda reports mode "kv"
aws logs tail /aws/lambda/math-visuals-api \
  --region eu-north-1 \
  --since 10m \
  --filter-pattern 'mode" "kv"'
```

`<artifact-bucket>` must exist in `eu-north-1`; create or reuse a bucket in that
region before running the upload and deploy commands. Only include
`LambdaCodeS3ObjectVersion` if the bucket enforces object versioning.

The remainder of the document provides the background/rationale for each step in case
you need to adapt the workflow to another environment.

## 1. Shared parameter exports

Open AWS CloudShell in the target account/region and run the shared coordination
stack once per environment before anything else so the exported
parameter/secret names exist:

```bash
aws cloudformation deploy \
  --region eu-north-1 \
  --stack-name math-visuals-shared \
  --template-file infra/shared-parameters.yaml \
  --parameter-overrides EnvironmentName=prod
```

This step failed in CI because the execution environment does not expose AWS
credentials. You must run it from an authenticated workstation or pipeline that
has access to the target AWS account.

## 2. Data plane (VPC + Redis)

Before running the data stack you **must** pre-provision the Secrets Manager
entry that supplies the Redis auth token, otherwise CloudFormation will fail
with `ResourceNotFoundException`. Create/update the secret in the same region
as the stack (eu-north-1) and store the token under the `authToken` key:

```bash
# only needed once per environment; use put-secret-value if it already exists
aws secretsmanager create-secret \
  --region eu-north-1 \
  --name math-visuals/prod/redis/auth \
  --secret-string '{"authToken":"<32-128 printable ASCII chars>"}'
```

ElastiCache only accepts tokens that are 32–128 printable ASCII characters with
no spaces or quotes, so generate a value that meets those constraints.

Still inside CloudShell, deploy `infra/data/template.yaml` after the shared
stack so the template can import the exported names. Provide the ElastiCache
auth token via a dynamic Secrets Manager reference that resolves directly to
the `authToken` field to keep it out of plaintext:

```bash
aws cloudformation deploy \
  --region eu-north-1 \
  --stack-name math-visuals-data \
  --template-file infra/data/template.yaml \
  --parameter-overrides \
    EnvironmentName=prod \
    SharedParametersStackName=math-visuals-shared \
    RedisAuthToken='{{resolve:secretsmanager:math-visuals/prod/redis/auth:SecretString:authToken}}'
```

This command was not executed locally for the same credential reasons as above.
It provisions the VPC, subnets, Lambda security group, Redis replication group
and the Redis-related SSM parameters/Secrets Manager secret described in the
template.

## 3. Populate Secrets Manager/SSM + mirror to GitHub

After the stacks are in place, run the helper to push the Redis endpoint, port
and auth token and to update the frontend allow-lists. CloudShell already has
`bash`, so you can execute the script directly once you have pulled the repo
there:

```bash
SHARED_STACK=math-visuals-shared \
STATIC_STACK=math-visuals-static-site \
SHARED_REGION=eu-north-1 \
STATIC_REGION=eu-west-1 \
  ./scripts/update-shared-params.sh
```

The script prompts for the Redis values, writes them to Secrets Manager and SSM
(based on the names exported by the shared stack) and prints the values that
need to be copied into the `REDIS_PASSWORD`, `REDIS_ENDPOINT` and `REDIS_PORT`
GitHub secrets. Running it requires AWS credentials, so the step could not be
performed here.

## 4. Package the API Lambda, redeploy, and verify KV mode

The API stack already loads the Redis endpoint/port/secret via dynamic
references (`REDIS_*` environment variables inside `infra/api/template.yaml`).
However, the CloudFormation template expects the Lambda bundle to be staged in
S3 and **does not** embed any inline code, so redeploying the stack requires you
to package and upload the artifact before running `aws cloudformation deploy`.

### 4a. Build the Lambda bundle

Run the helper script (or reproduce the same steps manually) to create
`infra/api/api-lambda.zip` with the runtime entry point, `api/` routes and
dependencies:

```bash
scripts/package-api-lambda.sh
```

### 4b. Upload the artifact to an S3 bucket in `eu-north-1`

Lambda can only pull code from S3 in the same region as the stack. Use an
existing artifact bucket in `eu-north-1` or create one:

```bash
aws s3api create-bucket \
  --bucket math-visuals-artifacts-eun1 \
  --region eu-north-1 \
  --create-bucket-configuration LocationConstraint=eu-north-1

aws s3 cp infra/api/api-lambda.zip s3://math-visuals-artifacts-eun1/api/api-lambda.zip --region eu-north-1
```

If the bucket enforces versioning, capture the object version so you can pass it
to CloudFormation.

### 4c. Redeploy the API stack with the artifact parameters

`infra/api/template.yaml` requires `LambdaCodeS3Bucket`, `LambdaCodeS3Key`, and
(optionally) `LambdaCodeS3ObjectVersion`. Include those parameters along with the
stack-linking overrides so CloudFormation can update the Lambda function:

```bash
aws cloudformation deploy \
  --region eu-north-1 \
  --stack-name math-visuals-api \
  --template-file infra/api/template.yaml \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides \
    LambdaCodeS3Bucket=math-visuals-artifacts-eun1 \
    LambdaCodeS3Key=api/api-lambda.zip \
    [LambdaCodeS3ObjectVersion=<object-version-if-bucket-is-versioned>] \
    EnvironmentName=prod \
    DataStackName=math-visuals-data \
    SharedParametersStackName=math-visuals-shared
```

### 4d. Verify Lambda reports `mode: "kv"`

After redeploying, confirm in CloudWatch that the runtime is operating in KV
mode:

```bash
aws logs tail /aws/lambda/math-visuals-api \
  --region eu-north-1 \
  --since 10m \
  --filter-pattern 'mode" "kv"'
```

Because CloudWatch is unreachable from this workspace without valid AWS
credentials, the log verification must be performed in the target AWS account.
