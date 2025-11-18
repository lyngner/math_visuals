#!/usr/bin/env bash
set -euo pipefail

DEFAULT_REGION=${DEFAULT_REGION:-eu-west-1}
DEFAULT_CLOUDFRONT_REGION=${DEFAULT_CLOUDFRONT_REGION:-us-east-1}
DEFAULT_DATA_STACK=${DEFAULT_DATA_STACK:-math-visuals-data}
DEFAULT_STATIC_STACK=${DEFAULT_STATIC_STACK:-math-visuals-static-site}
DEFAULT_LOG_GROUP=${DEFAULT_LOG_GROUP:-/aws/lambda/math-visuals-api}

usage() {
  cat <<'USAGE'
Bruk: bash scripts/cloudshell-verify.sh [flagg]

Tilgjengelige flagg:
  --region=REGION              Regionen der data/API-stakkene ligger (standard: eu-west-1)
  --cloudfront-region=REGION   Regionen som brukes for CloudFront API-kall (standard: us-east-1)
  --data-stack=STACK           CloudFormation-stacken som eier Redis-outputs (standard: math-visuals-data)
  --static-stack=STACK         CloudFormation-stacken som eier CloudFront/S3-outputs (standard: math-visuals-static-site)
  --log-group=NAME             CloudWatch-logggruppen til Lambdaen (standard: /aws/lambda/math-visuals-api)
  -h, --help                   Vis denne hjelpen

Skriptet krever at du allerede har kjørt `aws configure` eller `aws sso login`.
USAGE
}

REGION=$DEFAULT_REGION
CLOUDFRONT_REGION=$DEFAULT_CLOUDFRONT_REGION
DATA_STACK=$DEFAULT_DATA_STACK
STATIC_STACK=$DEFAULT_STATIC_STACK
LOG_GROUP=$DEFAULT_LOG_GROUP

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
    --static-stack=*)
      STATIC_STACK="${1#*=}"
      ;;
    --log-group=*)
      LOG_GROUP="${1#*=}"
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Ukjent flagg: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
  shift
done

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Kommandoen '$1' er ikke tilgjengelig i PATH. Installer den før du fortsetter." >&2
    exit 1
  fi
}

for cmd in aws jq curl npm; do
  require_cmd "$cmd"
done

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

# Finn CloudFront-domenet på forhånd slik at helperen også bruker korrekt API-URL
CF_DOMAIN=$(describe_output_for_stack "$STATIC_STACK" "CloudFrontDistributionDomainName")
if [[ -z "$CF_DOMAIN" || "$CF_DOMAIN" == "None" ]]; then
  echo "Fant ikke CloudFrontDistributionDomainName i stacken $STATIC_STACK" >&2
  exit 1
fi

API_URL="https://${CF_DOMAIN}/api/examples"

# 1. Hent Redis-konfig og sjekk API-et
source "$CHECK_SCRIPT"
echo "==> Verifiserer Redis-parametere og API via cloudshell_check_examples ..."
if ! API_URL="$API_URL" cloudshell_check_examples --region="$REGION" --stack="$DATA_STACK" --static-stack="$STATIC_STACK"; then
  echo "cloudshell_check_examples feilet. Se meldingen over og fiks forutsetningene før du prøver igjen." >&2
  exit 1
fi

# 2. Bruk CloudFront-domenet til å teste sluttpunkter
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
if [[ -n "$LOG_GROUP" ]]; then
  echo "==> Tailer de siste 15 minuttene med Lambda-logger for å se etter Redis/advarsler ..."
  aws cloudwatch logs tail "$LOG_GROUP" \
    --region "$REGION" \
    --since 15m \
    --format short | grep -Ei 'mode|kv' || true
else
  echo "LOG_GROUP er tom. Hopper over CloudWatch-tail."
fi

echo "\nAlt ferdig. Bekreft at curl/jq- og loggutskriftene viser mode=\"kv\" for å sikre at Redis brukes."
