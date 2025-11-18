# Redis deployment status

This document tracks the Redis provisioning workflow that needs to run outside of the
repository. All commands assume the AWS CLI is configured with credentials that can
create CloudFormation stacks, Secrets Manager secrets and SSM parameters.

## 1. Shared parameter exports

Run the shared coordination stack once per environment before anything else so the
exported parameter/secret names exist:

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

## 2. Redis auth secret

Create or update the Secrets Manager secret that holds the Redis auth token
before touching the data stack. The `math-visuals-data` template consumes the
`RedisAuthToken` dynamic reference twice (for the managed secret and the
ElastiCache `AuthToken` property), so the secret must already exist or the
deployment fails. Use the same region as the stack (here `eu-north-1`) and keep
the token in JSON form:

```bash
aws secretsmanager create-secret \
  --region eu-north-1 \
  --name math-visuals/prod/redis/auth \
  --secret-string '{"authToken":"<token>"}'
```

If the secret already exists, update it instead:

```bash
aws secretsmanager put-secret-value \
  --region eu-north-1 \
  --secret-id math-visuals/prod/redis/auth \
  --secret-string '{"authToken":"<token>"}'
```

## 3. Data plane (VPC + Redis)

Deploy `infra/data/template.yaml` after the shared stack so the template can
import the exported names. Provide the ElastiCache auth token via a dynamic
Secrets Manager reference to keep it out of plaintext:

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

## 4. Populate Secrets Manager/SSM + mirror to GitHub

After the stacks are in place, run the helper to push the Redis endpoint, port
and auth token and to update the frontend allow-lists:

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

## 5. Lambda environment variables and verification

The API stack already loads the Redis endpoint/port/secret via dynamic
references (`REDIS_*` environment variables inside `infra/api/template.yaml`).
After redeploying the API stack, verify that the Lambda runtime reports
`mode: "kv"` by inspecting the CloudWatch logs:

```bash
aws logs tail /aws/lambda/math-visuals-api \
  --region eu-north-1 \
  --since 10m \
  --filter-pattern 'mode" "kv"'
```

Because CloudWatch is also unreachable without valid AWS credentials, this
verification has to happen in the target AWS account.
