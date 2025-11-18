#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<USAGE
Usage: $0 <artifact-bucket> [artifact-key]

Ensures an S3 bucket exists in eu-west-1, packages the Lambda artefact, uploads
it, deploys CloudFormation and verifies the Lambda VPC/secret bindings.
USAGE
}

if [[ ${1:-} == "-h" || ${1:-} == "--help" ]]; then
  usage
  exit 0
fi

if [[ $# -lt 1 ]]; then
  usage >&2
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required for post-deploy verification" >&2
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ARTIFACT_BUCKET="$1"
ARTIFACT_KEY="${2:-lambda/api-lambda.zip}"
AWS_REGION="${AWS_REGION:-eu-west-1}"
STACK_NAME="${STACK_NAME:-math-visuals-api}"
DATA_STACK_NAME="${DATA_STACK_NAME:-math-visuals-data}"
SHARED_PARAMETERS_STACK_NAME="${SHARED_PARAMETERS_STACK_NAME:-math-visuals-shared}"
STAGE_NAME="${STAGE_NAME:-prod}"
LAMBDA_ARTIFACT_PATH="$ROOT_DIR/infra/api/api-lambda.zip"
TEMPLATE_FILE="$ROOT_DIR/infra/api/template.yaml"

info() {
  echo "[cloudshell-deploy] $*"
}

ensure_bucket() {
  info "Ensuring artefact bucket '$ARTIFACT_BUCKET' exists in $AWS_REGION"
  if aws s3api head-bucket --bucket "$ARTIFACT_BUCKET" 2>/dev/null; then
    bucket_region=$(aws s3api get-bucket-location --bucket "$ARTIFACT_BUCKET" --query 'LocationConstraint' --output text)
    if [[ "$bucket_region" == "None" ]]; then
      bucket_region="us-east-1"
    fi
    if [[ "$bucket_region" != "$AWS_REGION" ]]; then
      echo "Bucket exists in region $bucket_region, expected $AWS_REGION" >&2
      exit 1
    fi
  else
    if [[ "$AWS_REGION" == "us-east-1" ]]; then
      aws s3api create-bucket --bucket "$ARTIFACT_BUCKET"
    else
      aws s3api create-bucket --bucket "$ARTIFACT_BUCKET" --region "$AWS_REGION" --create-bucket-configuration "LocationConstraint=$AWS_REGION"
    fi
  fi
}

package_lambda() {
  info "Packaging Lambda artefact"
  "$ROOT_DIR/scripts/package-api-lambda.sh" >/dev/null
}

upload_lambda() {
  info "Uploading artefact to s3://$ARTIFACT_BUCKET/$ARTIFACT_KEY"
  aws s3 cp "$LAMBDA_ARTIFACT_PATH" "s3://$ARTIFACT_BUCKET/$ARTIFACT_KEY"
}

deploy_stack() {
  info "Deploying CloudFormation stack $STACK_NAME"
  aws cloudformation deploy \
    --stack-name "$STACK_NAME" \
    --template-file "$TEMPLATE_FILE" \
    --region "$AWS_REGION" \
    --capabilities CAPABILITY_IAM \
    --parameter-overrides \
      LambdaCodeS3Bucket="$ARTIFACT_BUCKET" \
      LambdaCodeS3Key="$ARTIFACT_KEY" \
      StageName="$STAGE_NAME" \
      DataStackName="$DATA_STACK_NAME" \
      SharedParametersStackName="$SHARED_PARAMETERS_STACK_NAME"
}

stack_output() {
  local stack_name="$1"
  local key="$2"
  aws cloudformation describe-stacks \
    --stack-name "$stack_name" \
    --region "$AWS_REGION" \
    --query "Stacks[0].Outputs[?OutputKey==\`$key\`].OutputValue" \
    --output text
}

verify_lambda() {
  info "Verifying Lambda configuration"
  local subnet1 subnet2 lambda_sg redis_secret redis_endpoint_param redis_port_param
  subnet1=$(stack_output "$DATA_STACK_NAME" PrivateSubnet1Id)
  subnet2=$(stack_output "$DATA_STACK_NAME" PrivateSubnet2Id)
  lambda_sg=$(stack_output "$DATA_STACK_NAME" LambdaSecurityGroupId)
  redis_secret=$(stack_output "$DATA_STACK_NAME" RedisPasswordSecretName)
  redis_endpoint_param=$(stack_output "$DATA_STACK_NAME" RedisEndpointParameterName)
  redis_port_param=$(stack_output "$DATA_STACK_NAME" RedisPortParameterName)

  local function_physical_id
  function_physical_id=$(aws cloudformation describe-stack-resource \
    --stack-name "$STACK_NAME" \
    --region "$AWS_REGION" \
    --logical-resource-id ApiFunction \
    --query 'StackResourceDetail.PhysicalResourceId' \
    --output text)

  local lambda_config
  lambda_config=$(aws lambda get-function-configuration \
    --function-name "$function_physical_id" \
    --region "$AWS_REGION")

  local errors=0

  contains_value() {
    local needle="$1"
    shift
    for value in "$@"; do
      if [[ "$value" == "$needle" ]]; then
        return 0
      fi
    done
    return 1
  }

  mapfile -t lambda_subnets < <(echo "$lambda_config" | jq -r '.VpcConfig.SubnetIds[]')
  mapfile -t lambda_sgs < <(echo "$lambda_config" | jq -r '.VpcConfig.SecurityGroupIds[]')

  if ! contains_value "$subnet1" "${lambda_subnets[@]}"; then
    echo "Missing subnet $subnet1 in Lambda VpcConfig" >&2
    errors=$((errors+1))
  fi
  if ! contains_value "$subnet2" "${lambda_subnets[@]}"; then
    echo "Missing subnet $subnet2 in Lambda VpcConfig" >&2
    errors=$((errors+1))
  fi
  if ! contains_value "$lambda_sg" "${lambda_sgs[@]}"; then
    echo "Missing Lambda security group $lambda_sg" >&2
    errors=$((errors+1))
  fi

  local redis_password_env redis_endpoint_env redis_port_env
  redis_password_env=$(echo "$lambda_config" | jq -r '.Environment.Variables.REDIS_PASSWORD // ""')
  redis_endpoint_env=$(echo "$lambda_config" | jq -r '.Environment.Variables.REDIS_ENDPOINT // ""')
  redis_port_env=$(echo "$lambda_config" | jq -r '.Environment.Variables.REDIS_PORT // ""')

  if [[ "$redis_password_env" != *"$redis_secret"* ]]; then
    echo "REDIS_PASSWORD does not reference $redis_secret" >&2
    errors=$((errors+1))
  fi
  if [[ "$redis_endpoint_env" != *"$redis_endpoint_param"* ]]; then
    echo "REDIS_ENDPOINT does not resolve $redis_endpoint_param" >&2
    errors=$((errors+1))
  fi
  if [[ "$redis_port_env" != *"$redis_port_param"* ]]; then
    echo "REDIS_PORT does not resolve $redis_port_param" >&2
    errors=$((errors+1))
  fi

  if [[ $errors -gt 0 ]]; then
    echo "Lambda verification failed with $errors issue(s)" >&2
    exit 1
  fi

  info "Lambda VPC and secret bindings verified"
}

ensure_bucket
package_lambda
upload_lambda
deploy_stack
verify_lambda

info "Deployment complete"
