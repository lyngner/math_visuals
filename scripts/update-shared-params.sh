#!/usr/bin/env bash
set -euo pipefail

if ! command -v aws >/dev/null 2>&1; then
  echo "This script requires the AWS CLI (aws) to be installed and configured." >&2
  exit 1
fi

export SHARED_STACK="${SHARED_STACK:-math-visuals-shared}"
export STATIC_STACK="${STATIC_STACK:-math-visuals-static-site}"
export SHARED_REGION="${SHARED_REGION:-eu-north-1}"
export STATIC_REGION="${STATIC_REGION:-eu-west-1}"

info() {
  printf '\n%s\n' "$1"
}

get_cf_output() {
  local region="$1"
  local stack="$2"
  local output_key="$3"

  aws cloudformation describe-stacks \
    --region "$region" \
    --stack-name "$stack" \
    --query "Stacks[0].Outputs[?OutputKey==\`$output_key\`].OutputValue" \
    --output text
}

prompt_value() {
  local label="$1"
  local current_value="$2"
  local secret="${3:-false}"
  local input=""

  while true; do
    if [ "$secret" = true ]; then
      if [ -n "$current_value" ]; then
        read -r -s -p "$label (leave blank to keep existing): " input
      else
        read -r -s -p "$label (required): " input
      fi
      echo
    else
      if [ -n "$current_value" ]; then
        read -r -p "$label [$current_value]: " input
      else
        read -r -p "$label (required): " input
      fi
    fi

    if [ -n "$input" ]; then
      printf '%s' "$input"
      return 0
    fi

    if [ -n "$current_value" ]; then
      printf '%s' "$current_value"
      return 0
    fi

    echo "Value required" >&2
  done
}

mask_value() {
  local value="$1"
  local length=${#value}

  if [ "$length" -eq 0 ]; then
    printf '(empty)'
    return
  fi

  if [ "$length" -le 4 ]; then
    printf '****'
    return
  fi

  printf '%s****%s (len %d)' "${value:0:2}" "${value: -2}" "$length"
}

info "Resolving shared parameter resources from $SHARED_STACK in $SHARED_REGION..."
REDIS_SECRET_NAME=$(get_cf_output "$SHARED_REGION" "$SHARED_STACK" "RedisPasswordSecretName")
REDIS_ENDPOINT_PARAM=$(get_cf_output "$SHARED_REGION" "$SHARED_STACK" "RedisEndpointParameterName")
REDIS_PORT_PARAM=$(get_cf_output "$SHARED_REGION" "$SHARED_STACK" "RedisPortParameterName")
EXAMPLES_ALLOWED_ORIGINS_PARAM=$(get_cf_output "$SHARED_REGION" "$SHARED_STACK" "ExamplesAllowedOriginsParameterName")
SVG_ALLOWED_ORIGINS_PARAM=$(get_cf_output "$SHARED_REGION" "$SHARED_STACK" "SvgAllowedOriginsParameterName")

info "Retrieving current Redis values..."
CURRENT_SECRET_STRING=""
if CURRENT_SECRET_STRING=$(aws secretsmanager get-secret-value \
  --region "$SHARED_REGION" \
  --secret-id "$REDIS_SECRET_NAME" \
  --query SecretString \
  --output text 2>/dev/null); then
  :
else
  CURRENT_SECRET_STRING=""
fi

CURRENT_REDIS_PASSWORD=""
if [ -n "$CURRENT_SECRET_STRING" ]; then
  CURRENT_REDIS_PASSWORD=$(SECRET_STRING="$CURRENT_SECRET_STRING" python3 - <<'PY'
import json, os
secret = os.environ.get('SECRET_STRING', '')
try:
    data = json.loads(secret)
    print(data.get('authToken', ''))
except Exception:
    print('')
PY
  )
fi

CURRENT_REDIS_ENDPOINT=""
if CURRENT_REDIS_ENDPOINT=$(aws ssm get-parameter \
  --region "$SHARED_REGION" \
  --name "$REDIS_ENDPOINT_PARAM" \
  --query 'Parameter.Value' \
  --output text 2>/dev/null); then
  :
else
  CURRENT_REDIS_ENDPOINT=""
fi

CURRENT_REDIS_PORT=""
if CURRENT_REDIS_PORT=$(aws ssm get-parameter \
  --region "$SHARED_REGION" \
  --name "$REDIS_PORT_PARAM" \
  --query 'Parameter.Value' \
  --output text 2>/dev/null); then
  :
else
  CURRENT_REDIS_PORT=""
fi

info "Enter the values that should be stored in Secrets Manager / SSM:"
REDIS_PASSWORD=$(prompt_value "Redis password" "$CURRENT_REDIS_PASSWORD" true)
REDIS_ENDPOINT=$(prompt_value "Redis endpoint" "$CURRENT_REDIS_ENDPOINT")
REDIS_PORT=$(prompt_value "Redis port" "$CURRENT_REDIS_PORT")

info "Updating Redis password secret..."
SECRET_PAYLOAD=$(REDIS_PASSWORD="$REDIS_PASSWORD" python3 - <<'PY'
import json, os
print(json.dumps({"authToken": os.environ["REDIS_PASSWORD"]}))
PY
)
aws secretsmanager put-secret-value \
  --region "$SHARED_REGION" \
  --secret-id "$REDIS_SECRET_NAME" \
  --secret-string "$SECRET_PAYLOAD" >/dev/null

info "Updating Redis endpoint parameter..."
aws ssm put-parameter \
  --region "$SHARED_REGION" \
  --name "$REDIS_ENDPOINT_PARAM" \
  --type String \
  --value "$REDIS_ENDPOINT" \
  --overwrite >/dev/null

info "Updating Redis port parameter..."
aws ssm put-parameter \
  --region "$SHARED_REGION" \
  --name "$REDIS_PORT_PARAM" \
  --type String \
  --value "$REDIS_PORT" \
  --overwrite >/dev/null

info "Resolving CloudFront domain from $STATIC_STACK in $STATIC_REGION..."
CLOUDFRONT_DOMAIN=$(get_cf_output "$STATIC_REGION" "$STATIC_STACK" "CloudFrontDistributionDomainName")
ALLOWLIST_FILE=$(mktemp)
trap 'rm -f "$ALLOWLIST_FILE"' EXIT
printf 'https://%s,https://mathvisuals.no,https://app.mathvisuals.no' "$CLOUDFRONT_DOMAIN" >"$ALLOWLIST_FILE"

info "Updating frontend allow-list parameters via file input..."
aws ssm put-parameter \
  --region "$SHARED_REGION" \
  --name "$EXAMPLES_ALLOWED_ORIGINS_PARAM" \
  --type StringList \
  --value "file://$ALLOWLIST_FILE" \
  --overwrite >/dev/null
aws ssm put-parameter \
  --region "$SHARED_REGION" \
  --name "$SVG_ALLOWED_ORIGINS_PARAM" \
  --type StringList \
  --value "file://$ALLOWLIST_FILE" \
  --overwrite >/dev/null

info "Done. Copy the following values into the REDIS_* GitHub Secrets as needed:"
echo "  REDIS_PASSWORD: $(mask_value "$REDIS_PASSWORD")"
echo "  REDIS_ENDPOINT: $(mask_value "$REDIS_ENDPOINT")"
echo "  REDIS_PORT: $(mask_value "$REDIS_PORT")"
