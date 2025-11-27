#!/usr/bin/env bash
set -euo pipefail

if ! command -v jq >/dev/null 2>&1; then
  echo "This script requires jq to parse CloudFront distribution configs." >&2
  exit 1
fi

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
CLOUDFRONT_REGION=${CLOUDFRONT_REGION:-us-east-1}
SKIP_INVALIDATION=${SKIP_INVALIDATION:-}

if [[ -z "$SITE_BUCKET_NAME" ]]; then
  SITE_BUCKET_NAME=$(read_parameter "SiteBucketName")
fi

if [[ -z "$API_GATEWAY_DOMAIN" ]]; then
  API_GATEWAY_DOMAIN=$(read_parameter "ApiGatewayDomainName")
fi

if [[ -z "$API_GATEWAY_ORIGIN_PATH" ]]; then
  API_GATEWAY_ORIGIN_PATH=$(read_parameter "ApiGatewayOriginPath")
fi

# CloudFront requires origin paths to start with a leading '/'. Normalize
# existing stack values so redeployments using older parameters succeed.
if [[ -n "$API_GATEWAY_ORIGIN_PATH" && "${API_GATEWAY_ORIGIN_PATH:0:1}" != "/" ]]; then
  API_GATEWAY_ORIGIN_PATH="/$API_GATEWAY_ORIGIN_PATH"
fi

if [[ -z "$CLOUDFRONT_PRICE_CLASS" ]]; then
  CLOUDFRONT_PRICE_CLASS=$(read_parameter "CloudFrontPriceClass")
fi

if [[ -z "$CACHE_POLICY_ID" ]]; then
  CACHE_POLICY_ID=$(read_parameter "CachePolicyId")
fi

echo "Deploying $STACK_NAME using parameters from the existing stack..."
echo "  Cache policy: $CACHE_POLICY_ID"

PARAM_OVERRIDES=(
  "SiteBucketName=$SITE_BUCKET_NAME"
  "ApiGatewayDomainName=$API_GATEWAY_DOMAIN"
  "ApiGatewayOriginPath=$API_GATEWAY_ORIGIN_PATH"
  "CloudFrontPriceClass=$CLOUDFRONT_PRICE_CLASS"
  "CachePolicyId=$CACHE_POLICY_ID"
  "SharedParametersStackName=$SHARED_STACK_NAME"
)

aws cloudformation deploy \
  --stack-name "$STACK_NAME" \
  --template-file "$TEMPLATE_FILE" \
  --capabilities CAPABILITY_NAMED_IAM \
  --force-upload \
  --parameter-overrides "${PARAM_OVERRIDES[@]}"

CLOUDFRONT_DOMAIN=$(read_output "CloudFrontDistributionDomainName")
CLOUDFRONT_ID=$(read_output "CloudFrontDistributionId")

function ensure_api_behavior_first() {
  local distribution_config_json etag api_index
  distribution_config_json=$(aws cloudfront get-distribution-config \
    --region "$CLOUDFRONT_REGION" \
    --id "$CLOUDFRONT_ID")

  etag=$(jq -r '.ETag' <<<"$distribution_config_json")
  api_index=$(jq -r '
    (.DistributionConfig.CacheBehaviors.Items // [])
    | map(.PathPattern)
    | index("/api/*")
  ' <<<"$distribution_config_json")

  if [[ "$api_index" == "null" ]]; then
    echo "The CloudFront distribution is missing the /api/* behaviour."
    echo "Redeploy the stack or inspect the distribution manually."
    exit 1
  fi

  if [[ "$api_index" -gt 0 ]]; then
    echo "Reordering cache behaviours so /api/* has highest precedence..."
    local reordered_config
    reordered_config=$(jq '
      .DistributionConfig.CacheBehaviors.Items |= (
        (map(select(.PathPattern == "/api/*")) +
         map(select(.PathPattern != "/api/*"))))
      | .DistributionConfig.CacheBehaviors.Quantity =
          (.DistributionConfig.CacheBehaviors.Items | length)
    ' <<<"$distribution_config_json")

    aws cloudfront update-distribution \
      --region "$CLOUDFRONT_REGION" \
      --id "$CLOUDFRONT_ID" \
      --if-match "$etag" \
      --distribution-config "$reordered_config" >/dev/null

    echo "Cache behaviours updated. Waiting for propagation may take a few minutes."
  else
    echo "/api/* behaviour already has highest precedence."
  fi

  local cache_policy
  cache_policy=$(jq -r '
    .DistributionConfig.CacheBehaviors.Items
      | map(select(.PathPattern == "/api/*"))
      | .[0].CachePolicyId
  ' <<<"$(aws cloudfront get-distribution-config --region "$CLOUDFRONT_REGION" --id "$CLOUDFRONT_ID")")

  if [[ "$cache_policy" != "$CACHE_POLICY_ID" ]]; then
    echo "Warning: /api/* cache policy ($cache_policy) differs from expected $CACHE_POLICY_ID." >&2
  fi
}

ensure_api_behavior_first

if [[ -z "$SKIP_INVALIDATION" ]]; then
  echo "Creating CloudFront invalidation on distribution $CLOUDFRONT_ID for paths: /api/* and /*"
  aws cloudfront create-invalidation \
    --region "$CLOUDFRONT_REGION" \
    --distribution-id "$CLOUDFRONT_ID" \
    --paths "/api/*" "/*" >/dev/null
else
  echo "Skipping CloudFront invalidation because SKIP_INVALIDATION is set."
fi

cat <<INFO

Deployment complete.
CloudFront distribution domain: $CLOUDFRONT_DOMAIN
CloudFront distribution id: $CLOUDFRONT_ID

Next steps:
  1. Behaviour ordering validated (see above for any automatic reordering).
  2. An invalidation was requested for /api/* and /* unless SKIP_INVALIDATION=1.
  3. Run the verification curls documented in infra/static-site/README.md.
INFO
