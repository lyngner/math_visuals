#!/usr/bin/env bash
set -euo pipefail

STACK_NAME=${STACK_NAME:-math-visuals-static-site}
SHARED_STACK_NAME=${SHARED_STACK_NAME:-math-visuals-shared}
TEMPLATE_FILE=${TEMPLATE_FILE:-infra/static-site/template.yaml}

function read_parameter() {
  local key=$1
  local value
  value=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --query "Stacks[0].Parameters[?ParameterKey=='$key'].ParameterValue" \
    --output text)

  if [[ -z "$value" || "$value" == "None" ]]; then
    echo "Unable to read parameter '$key' from stack '$STACK_NAME'." >&2
    echo "Make sure the stack exists and has the parameter set." >&2
    exit 1
  fi

  echo "$value"
}

function read_output() {
  local key=$1
  local value
  value=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --query "Stacks[0].Outputs[?OutputKey=='$key'].OutputValue" \
    --output text)

  if [[ -z "$value" || "$value" == "None" ]]; then
    echo "Unable to read output '$key' from stack '$STACK_NAME'." >&2
    echo "Make sure the stack exists and the deployment finished successfully." >&2
    exit 1
  fi

  echo "$value"
}

SITE_BUCKET_NAME=${SITE_BUCKET_NAME:-}
API_GATEWAY_DOMAIN=${API_GATEWAY_DOMAIN:-}
API_GATEWAY_ORIGIN_PATH=${API_GATEWAY_ORIGIN_PATH:-}
CLOUDFRONT_PRICE_CLASS=${CLOUDFRONT_PRICE_CLASS:-}
CACHE_POLICY_ID=${CACHE_POLICY_ID:-}

if [[ -z "$SITE_BUCKET_NAME" ]]; then
  SITE_BUCKET_NAME=$(read_parameter "SiteBucketName")
fi

if [[ -z "$API_GATEWAY_DOMAIN" ]]; then
  API_GATEWAY_DOMAIN=$(read_parameter "ApiGatewayDomainName")
fi

if [[ -z "$API_GATEWAY_ORIGIN_PATH" ]]; then
  API_GATEWAY_ORIGIN_PATH=$(read_parameter "ApiGatewayOriginPath")
fi

if [[ -z "$CLOUDFRONT_PRICE_CLASS" ]]; then
  CLOUDFRONT_PRICE_CLASS=$(read_parameter "CloudFrontPriceClass")
fi

echo "Deploying $STACK_NAME using parameters from the existing stack..."

PARAM_OVERRIDES=(
  "SiteBucketName=$SITE_BUCKET_NAME"
  "ApiGatewayDomainName=$API_GATEWAY_DOMAIN"
  "ApiGatewayOriginPath=$API_GATEWAY_ORIGIN_PATH"
  "CloudFrontPriceClass=$CLOUDFRONT_PRICE_CLASS"
  "SharedParametersStackName=$SHARED_STACK_NAME"
)

if [[ -n "$CACHE_POLICY_ID" ]]; then
  PARAM_OVERRIDES+=("CachePolicyId=$CACHE_POLICY_ID")
fi

aws cloudformation deploy \
  --stack-name "$STACK_NAME" \
  --template-file "$TEMPLATE_FILE" \
  --capabilities CAPABILITY_NAMED_IAM \
  --force-upload \
  --parameter-overrides "${PARAM_OVERRIDES[@]}"

CLOUDFRONT_DOMAIN=$(read_output "CloudFrontDistributionDomainName")
CLOUDFRONT_ID=$(read_output "CloudFrontDistributionId")

cat <<INFO

Deployment complete.
CloudFront distribution domain: $CLOUDFRONT_DOMAIN
CloudFront distribution id: $CLOUDFRONT_ID

Next steps:
  1. Confirm the /api/* behaviour still targets ApiGatewayOrigin
     (see infra/static-site/README.md for the aws cloudfront command).
  2. Run the verification curls documented in infra/static-site/README.md.
INFO
