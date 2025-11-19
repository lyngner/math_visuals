#!/usr/bin/env bash
set -euo pipefail

DEFAULT_REGION=${DEFAULT_REGION:-eu-west-1}
DEFAULT_CLOUDFRONT_REGION=${DEFAULT_CLOUDFRONT_REGION:-us-east-1}
DEFAULT_DATA_STACK=${DEFAULT_DATA_STACK:-math-visuals-data}
DEFAULT_STATIC_STACK=${DEFAULT_STATIC_STACK:-math-visuals-static-site}
DEFAULT_API_STACK=${DEFAULT_API_STACK:-math-visuals-api}
DEFAULT_LOG_GROUP=${DEFAULT_LOG_GROUP:-/aws/lambda/math-visuals-api}

usage() {
  cat <<'USAGE'
Bruk: bash scripts/cloudshell-verify.sh [flagg]

Tilgjengelige flagg:
  --region=REGION              Regionen der data/API-stakkene ligger (standard: eu-west-1)
  --cloudfront-region=REGION   Regionen som brukes for CloudFront API-kall (standard: us-east-1)
  --data-stack=STACK           CloudFormation-stacken som eier Redis-outputs (standard: math-visuals-data)
  --api-stack=STACK            CloudFormation-stacken som eier API-et (for logg-lookup, standard: math-visuals-api)
  --static-stack=STACK         CloudFormation-stacken som eier CloudFront/S3-outputs (standard: math-visuals-static-site)
  --api-url=URL                Overstyr CloudFront-oppslaget og bruk denne URL-en for /api/examples-testene (hopper over describe-stacks)
  --log-group=NAME             CloudWatch-logggruppen til Lambdaen (standard: /aws/lambda/math-visuals-api)
  --trace                      Slå på shell tracing (set -x) for å feilsøke tidlige stopp
  -h, --help                   Vis denne hjelpen

Skriptet krever at du allerede har kjørt `aws configure` eller `aws sso login`.
USAGE
}

REGION=$DEFAULT_REGION
CLOUDFRONT_REGION=$DEFAULT_CLOUDFRONT_REGION
DATA_STACK=$DEFAULT_DATA_STACK
STATIC_STACK=$DEFAULT_STATIC_STACK
API_STACK=$DEFAULT_API_STACK
LOG_GROUP=$DEFAULT_LOG_GROUP
API_URL_OVERRIDE=""
TRACE=false
SHOW_HELP=false
LOG_GROUP_SET=false
CF_DOMAIN=""
API_URL=""
HELPER_STATUS="not-run"
OVERALL_STATUS=""

print_summary() {
  local exit_code=$?
  local api_value="${API_URL:-}"
  local cf_value="${CF_DOMAIN:-}"
  local redis_value="${REDIS_ENDPOINT:-}"
  local helper_value="${HELPER_STATUS:-not-set}"
  local overall_value="${OVERALL_STATUS:-$exit_code}"

  echo "==> Summary: API_URL=${api_value:-<unset>} CF_DOMAIN=${cf_value:-<unset>} REDIS_ENDPOINT=${redis_value:-<unset>} HELPER_STATUS=${helper_value} OVERALL_STATUS=${overall_value}"
}

trap 'print_summary' EXIT

while [[ $# -gt 0 ]]; do
  case "$1" in
    --region=*)
      REGION="${1#*=}"
      ;;
    --cloudfront-region=*)
      CLOUDFRONT_REGION="${1#*=}"
      ;;
    --data-stack=*)
      DATA_STACK="${1#*=}"
      ;;
    --api-stack=*)
      API_STACK="${1#*=}"
      ;;
    --static-stack=*)
      STATIC_STACK="${1#*=}"
      ;;
    --api-url=*)
      API_URL_OVERRIDE="${1#*=}"
      ;;
    --log-group=*)
      LOG_GROUP="${1#*=}"
      LOG_GROUP_SET=true
      ;;
    --trace)
      TRACE=true
      ;;
    -h|--help)
      SHOW_HELP=true
      ;;
    *)
      echo "Ukjent flagg: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
  shift
done

if [[ "$SHOW_HELP" == true ]]; then
  usage
  exit 0
fi

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Kommandoen '$1' er ikke tilgjengelig i PATH. Installer den før du fortsetter." >&2
    exit 1
  fi
}

for cmd in aws jq curl npm; do
  require_cmd "$cmd"
done

if [[ "$TRACE" == true ]]; then
  set -x
fi

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
CHECK_SCRIPT="$SCRIPT_DIR/cloudshell-check-examples.sh"

if [[ ! -f "$CHECK_SCRIPT" ]]; then
  echo "Fant ikke helper-skriptet $CHECK_SCRIPT" >&2
  exit 1
fi

# Hjelpefunksjoner for CloudFormation-outputs
describe_output_for_stack() {
  local stack_name="$1"
  local output_key="$2"
  aws cloudformation describe-stacks \
    --region "$REGION" \
    --stack-name "$stack_name" \
    --query "Stacks[0].Outputs[?OutputKey==\`$output_key\`].OutputValue" \
    --output text
}

stack_exists() {
  local stack_name="$1"
  if aws cloudformation describe-stacks \
    --region "$REGION" \
    --stack-name "$stack_name" \
    --query 'length(Stacks)' \
    --output text >/dev/null 2>&1; then
    return 0
  fi
  return 1
}

extract_domain_from_url() {
  local url="$1"
  if [[ "$url" =~ ^https?://([^/]+)/? ]]; then
    echo "${BASH_REMATCH[1]}"
  else
    return 1
  fi
}

log_group_has_streams() {
  local log_group_name="$1"
  if [[ -z "$log_group_name" ]]; then
    return 1
  fi

  local stream_count
  stream_count=$(aws cloudwatch logs describe-log-streams \
    --region "$REGION" \
    --log-group-name "$log_group_name" \
    --limit 1 \
    --query 'length(logStreams)' \
    --output text 2>/dev/null || echo "0")

  if [[ "$stream_count" != "0" && "$stream_count" != "None" ]]; then
    return 0
  fi
  return 1
}

discover_log_groups() {
  local results=()

  if stack_exists "$API_STACK"; then
    local api_fn_arn
    api_fn_arn=$(describe_output_for_stack "$API_STACK" "ApiFunctionArn")
    if [[ -n "$api_fn_arn" && "$api_fn_arn" != "None" ]]; then
      local api_fn_name
      api_fn_name="${api_fn_arn##*:function:}"
      if [[ -n "$api_fn_name" ]]; then
        results+=("/aws/lambda/${api_fn_name}")
      fi
    fi
  fi

  local described
  if described=$(aws logs describe-log-groups \
    --region "$REGION" \
    --log-group-name-prefix "$DEFAULT_LOG_GROUP" \
    --query 'logGroups[].logGroupName' \
    --output text 2>/dev/null); then
    while IFS=$'\t' read -r lg; do
      if [[ -n "$lg" ]]; then
        results+=("$lg")
      fi
    done <<< "$described"
  fi

  echo "${results[@]}"
}

has_cloudwatch_tail() {
  local aws_version
  if aws_version=$(aws --version 2>/dev/null); then
    if [[ "$aws_version" =~ aws-cli/2 ]] && aws cloudwatch logs tail --help >/dev/null 2>&1; then
      return 0
    fi
  fi

  return 1
}

resolve_log_group() {
  if [[ "$LOG_GROUP_SET" == true ]]; then
    return
  fi

  mapfile -t DISCOVERED_LOG_GROUPS < <(discover_log_groups)

  for candidate in "${DISCOVERED_LOG_GROUPS[@]}"; do
    if log_group_has_streams "$candidate"; then
      LOG_GROUP="$candidate"
      return
    fi
  done

  local api_fn_prefix
  api_fn_prefix="${DEFAULT_LOG_GROUP}-ApiFunction"
  local described
  if described=$(aws logs describe-log-groups \
    --region "$REGION" \
    --log-group-name-prefix "$api_fn_prefix" \
    --query 'logGroups[].logGroupName' \
    --output text 2>/dev/null); then
    while IFS=$'\t' read -r lg; do
      if log_group_has_streams "$lg"; then
        LOG_GROUP="$lg"
        return
      fi
    done <<< "$described"
  fi

  if log_group_has_streams "$LOG_GROUP"; then
    return
  fi

  LOG_GROUP=""
}

tail_logs() {
  if [[ -z "$LOG_GROUP" ]]; then
    echo "LOG_GROUP er tom. Hopper over CloudWatch-tail."
    return
  fi

  echo "==> Tailer de siste 15 minuttene med Lambda-logger for å se etter Redis/advarsler ..."
  local TAIL_STATUS=0
  set +e
  if has_cloudwatch_tail; then
    aws cloudwatch logs tail "$LOG_GROUP" \
      --region "$REGION" \
      --since 15m \
      --format short | grep -Ei 'mode|kv'
    TAIL_STATUS=$?
  else
    echo "aws cloudwatch logs tail er ikke tilgjengelig (krever AWS CLI v2); prøver filter-log-events som fallback ..." >&2
    local local_end_ts
    local local_start_ts
    local_end_ts=$(date -u +%s)
    local_start_ts=$((local_end_ts - 1800)) # 30 minutter tilbakeblikk
    aws logs filter-log-events \
      --log-group-name "$LOG_GROUP" \
      --region "$REGION" \
      --start-time $((local_start_ts * 1000)) \
      --end-time $((local_end_ts * 1000)) \
      --query 'events[].message' \
      --output text | grep -Ei 'mode|kv'
    TAIL_STATUS=$?
  fi
  set -e
  if [[ "$TAIL_STATUS" -ne 0 ]]; then
    echo "CloudWatch-loggtrinnet feilet eller ga ingen treff; fortsetter verifiseringen." >&2
  fi
}

# 1. Hent Redis-konfig og sjekk API-et
source "$CHECK_SCRIPT"
echo "==> Verifiserer Redis-parametere og API via cloudshell_check_examples ..."
CHECK_ARGS=(--region="$REGION" --stack="$DATA_STACK" --static-stack="$STATIC_STACK")
if [[ -n "$API_URL_OVERRIDE" ]]; then
  CHECK_ARGS+=(--url="$API_URL_OVERRIDE")
fi
if [[ "$TRACE" == true ]]; then
  CHECK_ARGS+=(--trace)
fi
CHECK_LOG=$(mktemp)
set +e
{
  set -o pipefail
  cloudshell_check_examples "${CHECK_ARGS[@]}" \
    2> >(tee -a "$CHECK_LOG" >&2) \
    | tee "$CHECK_LOG"
}
CLOUDSHELL_STATUS=$?
set -e
HELPER_STATUS=$CLOUDSHELL_STATUS
if [[ "$CLOUDSHELL_STATUS" -ne 0 ]]; then
  echo "cloudshell_check_examples stoppet med exit $CLOUDSHELL_STATUS; sjekk loggen i $CHECK_LOG eller utskriften over." >&2
  OVERALL_STATUS="$CLOUDSHELL_STATUS"
  exit "$CLOUDSHELL_STATUS"
fi
rm -f "$CHECK_LOG"

# 2. Finn CloudFront-domenet og test sluttpunkter
CF_DOMAIN=""
API_URL=""

if [[ -n "$API_URL_OVERRIDE" ]]; then
  API_URL="$API_URL_OVERRIDE"
  if ! CF_DOMAIN=$(extract_domain_from_url "$API_URL_OVERRIDE"); then
    echo "Kunne ikke lese domenet fra --api-url=$API_URL_OVERRIDE. Oppgi en URL som starter med http(s)://" >&2
    exit 1
  fi
else
  STATIC_STACK_FOUND=true
  if ! stack_exists "$STATIC_STACK"; then
    STATIC_STACK_FOUND=false
    echo "Fant ikke CloudFormation-stacken '$STATIC_STACK' i region '$REGION'." >&2
    echo "Oppgi --static-stack=<navn> eller --api-url=https://ditt-domene/api/examples for å fortsette." >&2
    exit 1
  fi

  if [[ "$STATIC_STACK_FOUND" == true ]]; then
    CF_DOMAIN=$(describe_output_for_stack "$STATIC_STACK" "CloudFrontDistributionDomainName")
  fi
  if [[ -z "$CF_DOMAIN" || "$CF_DOMAIN" == "None" ]]; then
    echo "Fant ikke CloudFrontDistributionDomainName i stacken $STATIC_STACK" >&2
    exit 1
  fi
  API_URL="https://${CF_DOMAIN}/api/examples"
fi
echo "==> Slår opp CloudFront-domenet (${CF_DOMAIN}) og sjekker API-responsen for mode=kv ..."
curl -fsS "$API_URL" | jq '{mode, storage, persistent, updatedAt}'

echo "==> Bekrefter at /sortering/eksempel1 fungerer via CloudFront ..."
curl -I "https://${CF_DOMAIN}/sortering/eksempel1"

# 3. Valider CloudFront-origins
DISTRIBUTION_ID=$(aws cloudfront list-distributions \
  --region "$CLOUDFRONT_REGION" \
  --query "DistributionList.Items[?DomainName=='${CF_DOMAIN}'].Id" \
  --output text)

if [[ -z "$DISTRIBUTION_ID" || "$DISTRIBUTION_ID" == "None" ]]; then
  echo "Fant ikke en CloudFront-distribusjon for $CF_DOMAIN i region $CLOUDFRONT_REGION" >&2
  exit 1
fi

echo "==> Henter CloudFront-distribusjonen (${DISTRIBUTION_ID}) og viser origins ..."
aws cloudfront get-distribution-config \
  --region "$CLOUDFRONT_REGION" \
  --id "$DISTRIBUTION_ID" \
  | jq '.DistributionConfig.Origins.Items'

# 4. Tail CloudWatch-loggene
resolve_log_group
if [[ -z "$LOG_GROUP" ]]; then
  echo "Fant ingen logggruppe med loggstrømmer. Sett --log-group til den faktiske Lambda-gruppen (f.eks. /aws/lambda/math-visuals-api-ApiFunction-...) og kjør skriptet på nytt." >&2
else
  tail_logs
fi

echo "\nAlt ferdig. Bekreft at curl/jq- og loggutskriftene viser mode=\"kv\" for å sikre at Redis brukes."
