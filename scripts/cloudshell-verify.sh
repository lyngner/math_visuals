#!/usr/bin/env bash
set -eEuo pipefail

err_report() {
  local status=$?
  echo "[cloudshell-verify] Feil (exit=${status}) i kommando: ${BASH_COMMAND}" >&2
}

trap err_report ERR

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
  --api-url=URL                Overstyr CloudFront-oppslaget og bruk denne URL-en for /api/examples-testene (hopper over describe-stacks)
  --log-group=NAME             CloudWatch-logggruppen til Lambdaen (standard: /aws/lambda/math-visuals-api)
  --trace                      Slå på shell-tracing for å se hvert steg i skriptet (nyttig for feilsøking)
  -h, --help                   Vis denne hjelpen

Skriptet krever at du allerede har kjørt `aws configure` eller `aws sso login`.
USAGE
}

REGION=$DEFAULT_REGION
CLOUDFRONT_REGION=$DEFAULT_CLOUDFRONT_REGION
DATA_STACK=$DEFAULT_DATA_STACK
STATIC_STACK=$DEFAULT_STATIC_STACK
LOG_GROUP=$DEFAULT_LOG_GROUP
API_URL=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --trace)
      set -x
      ;;
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
    --api-url=*)
      API_URL="${1#*=}"
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

# Hjelpere for å kunne fortsette etter feil men likevel rapportere status til slutt
OVERALL_STATUS=0

record_status() {
  local status="$1"
  if [[ $status -ne 0 && $OVERALL_STATUS -eq 0 ]]; then
    OVERALL_STATUS=$status
  fi
}

run_step() {
  set +e
  "$@"
  local status=$?
  set -e
  record_status "$status"
  return $status
}

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
if [[ -z "$API_URL" ]]; then
  CF_DOMAIN=$(describe_output_for_stack "$STATIC_STACK" "CloudFrontDistributionDomainName")
  if [[ -z "$CF_DOMAIN" || "$CF_DOMAIN" == "None" ]]; then
    echo "Fant ikke CloudFrontDistributionDomainName i stacken $STATIC_STACK" >&2
    echo "Tips: Oppgi --api-url=https://<ditt-domene>/api/examples dersom CloudFront-stacken har et annet navn." >&2
    exit 1
  fi
  API_URL="https://${CF_DOMAIN}/api/examples"
else
  # Prøv å trekke ut domenet fra API_URL for å bruke det i CloudFront-sjekkene
  CF_DOMAIN=$(printf '%s' "$API_URL" | sed -E 's#^[a-zA-Z]+://([^/]+)/?.*$#\1#')
fi

if [[ -z "$API_URL" ]]; then
  echo "API_URL kunne ikke bestemmes. Sett --api-url=... eller sørg for CloudFront-outputs." >&2
  exit 1
fi

# 1. Hent Redis-konfig og sjekk API-et
source "$CHECK_SCRIPT"
echo "==> Verifiserer Redis-parametere og API via cloudshell_check_examples ..."
set +e
API_URL="$API_URL" cloudshell_check_examples --region="$REGION" --stack="$DATA_STACK" --static-stack="$STATIC_STACK"
HELPER_STATUS=$?
set -e

if [[ $HELPER_STATUS -ne 0 ]]; then
  echo "cloudshell_check_examples feilet (exit=${HELPER_STATUS}). Fortsetter med CloudFront-/curl-sjekkene for mer kontekst." >&2
fi

record_status "$HELPER_STATUS"

# 2. Bruk CloudFront-domenet til å teste sluttpunkter
echo "==> Slår opp CloudFront-domenet (${CF_DOMAIN:-<ukjent>}) og sjekker API-responsen for mode=kv ..."
run_step bash -lc "curl -fsS '$API_URL' | jq '{mode, storage, persistent, updatedAt}'"

if [[ -n "$CF_DOMAIN" ]]; then
  echo "==> Bekrefter at /sortering/eksempel1 fungerer via CloudFront ..."
  run_step curl -I "https://${CF_DOMAIN}/sortering/eksempel1"

  # 3. Valider CloudFront-origins
  DISTRIBUTION_ID=$(aws cloudfront list-distributions \
    --region "$CLOUDFRONT_REGION" \
    --query "DistributionList.Items[?DomainName=='${CF_DOMAIN}'].Id" \
    --output text)

  if [[ -z "$DISTRIBUTION_ID" || "$DISTRIBUTION_ID" == "None" ]]; then
    echo "Fant ikke en CloudFront-distribusjon for $CF_DOMAIN i region $CLOUDFRONT_REGION" >&2
    record_status 1
  else
    echo "==> Henter CloudFront-distribusjonen (${DISTRIBUTION_ID}) og viser origins ..."
    run_step aws cloudfront get-distribution-config \
      --region "$CLOUDFRONT_REGION" \
      --id "$DISTRIBUTION_ID" \
      | jq '.DistributionConfig.Origins.Items'
  fi
else
  echo "Advarsel: CF_DOMAIN ble ikke satt (brukte --api-url uten CloudFront-lookup). Hopper over CloudFront- og /sortering-sjekkene." >&2
fi

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

exit $OVERALL_STATUS
