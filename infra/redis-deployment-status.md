# Redis deployment status

This document tracks the Redis provisioning workflow that needs to run outside of the
repository. All commands assume the AWS CLI is configured with credentials that can
create CloudFormation stacks, Secrets Manager secrets and SSM parameters. If you just
need the exact commands to paste into AWS CloudShell, jump to the checklist below.

## CloudShell quick reference

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
    RedisAuthToken='{{resolve:secretsmanager:math-visuals/prod/redis/auth}}'

# 3) Populate Secrets Manager/SSM + mirror to GitHub
SHARED_STACK=math-visuals-shared \
STATIC_STACK=math-visuals-static-site \
SHARED_REGION=eu-north-1 \
STATIC_REGION=eu-west-1 \
  ./scripts/update-shared-params.sh

# 4) API stack refresh (ensures env vars pick up the latest values)
aws cloudformation deploy \
  --region eu-north-1 \
  --stack-name math-visuals-api \
  --template-file infra/api/template.yaml \
  --parameter-overrides \
    EnvironmentName=prod \
    DataStackName=math-visuals-data \
    SharedParametersStackName=math-visuals-shared

# 5) Verify Lambda reports mode "kv"
aws logs tail /aws/lambda/math-visuals-api \
  --region eu-north-1 \
  --since 10m \
  --filter-pattern 'mode" "kv"'
```

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

Still inside CloudShell, deploy `infra/data/template.yaml` after the shared
stack so the template can import the exported names. Provide the ElastiCache
auth token via a dynamic Secrets Manager reference to keep it out of plaintext:

```bash
aws cloudformation deploy \
  --region eu-north-1 \
  --stack-name math-visuals-data \
  --template-file infra/data/template.yaml \
  --parameter-overrides \
    EnvironmentName=prod \
    SharedParametersStackName=math-visuals-shared \
    RedisAuthToken='{{resolve:secretsmanager:math-visuals/prod/redis/auth}}'
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

## 4. Lambda environment variables and verification

The API stack already loads the Redis endpoint/port/secret via dynamic
references (`REDIS_*` environment variables inside `infra/api/template.yaml`).
After redeploying the API stack (for example via `aws cloudformation deploy` on
`infra/api/template.yaml`), verify that the Lambda runtime reports
`mode: "kv"` by inspecting the CloudWatch logs:

```bash
aws cloudformation deploy \
  --region eu-north-1 \
  --stack-name math-visuals-api \
  --template-file infra/api/template.yaml \
  --parameter-overrides \
    EnvironmentName=prod \
    DataStackName=math-visuals-data \
    SharedParametersStackName=math-visuals-shared
```


```bash
aws logs tail /aws/lambda/math-visuals-api \
  --region eu-north-1 \
  --since 10m \
  --filter-pattern 'mode" "kv"'
```

Because CloudWatch is also unreachable without valid AWS credentials, this
verification has to happen in the target AWS account.
