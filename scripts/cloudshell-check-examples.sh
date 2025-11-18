#!/usr/bin/env bash

# Source-friendly helper: `source scripts/cloudshell-check-examples.sh && cloudshell_check_examples --url=...`

DEFAULT_REGION="${DEFAULT_REGION:-eu-west-1}"

usage() {
  cat <<'USAGE'
Bruk: DATA_STACK=<stack-navn> API_URL="https://<domene>/api/examples" bash scripts/cloudshell-check-examples.sh

Alternativt kan du oppgi flagg:
  --region=REGION          AWS-regionen som inneholder stacken (standard: verdien i
                           $REGION/$AWS_REGION/$AWS_DEFAULT_REGION/$DEFAULT_REGION eller eu-west-1)
  --stack=STACK            Navnet på CloudFormation-stacken for data (standard: verdien i $DATA_STACK eller math-visuals-data)
  --url=URL                URL-en til /api/examples som skal testes (kan også settes via API_URL)
  -h, --help               Vis denne hjelpeteksten

Eksempel:
  DATA_STACK=math-visuals-data \
    API_URL="https://eksempel.no/api/examples" \
    bash scripts/cloudshell-check-examples.sh

Kilde og kjør manuelt:
  DATA_STACK=math-visuals-data \
    API_URL="https://eksempel.no/api/examples" \
    source scripts/cloudshell-check-examples.sh && cloudshell_check_examples
USAGE
}

cloudshell_check_examples() {
  local -
  set -euo pipefail

  REGION=${REGION:-${AWS_REGION:-${AWS_DEFAULT_REGION:-$DEFAULT_REGION}}}
  DATA_STACK=${DATA_STACK:-math-visuals-data}
  API_URL=${API_URL:-}

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --region=*)
        REGION="${1#*=}"
        ;;
      --stack=*)
        DATA_STACK="${1#*=}"
        ;;
      --url=*)
        API_URL="${1#*=}"
        ;;
      -h|--help)
        usage
        return 0
        ;;
      *)
        echo "Ukjent flagg: $1" >&2
        usage >&2
        return 1
        ;;
    esac
    shift
  done

  if [[ -z "${API_URL}" ]]; then
    echo "API_URL er ikke satt. Angi API_URL miljøvariabelen eller bruk --url=..." >&2
    usage >&2
    return 1
  fi

  if ! command -v aws >/dev/null 2>&1; then
    echo "aws CLI mangler. Installer den (CloudShell har den ferdig installert)." >&2
    return 1
  fi

  if ! command -v jq >/dev/null 2>&1; then
    echo "jq mangler. Installer den før du kjører skriptet." >&2
    return 1
  fi

  echo "Region:        $REGION"
  echo "Data-stack:    $DATA_STACK"
  echo "API-URL:       $API_URL"

  describe_output() {
    local key="$1"
    aws cloudformation describe-stacks \
      --region "$REGION" \
      --stack-name "$DATA_STACK" \
      --query "Stacks[0].Outputs[?OutputKey==\`$key\`].OutputValue" \
      --output text
  }

  require_value() {
    local value="$1"
    local label="$2"
    if [[ -z "$value" || "$value" == "None" ]]; then
      echo "Fant ikke verdi for $label. Sjekk at stacken '$DATA_STACK' finnes i region '$REGION'." >&2
      return 1
    fi
  }

  echo "Henter Parameter Store-/Secrets Manager-navn ..."
  REDIS_ENDPOINT_PARAMETER=$(describe_output "RedisEndpointParameterName")
  REDIS_PORT_PARAMETER=$(describe_output "RedisPortParameterName")
  REDIS_PASSWORD_SECRET=$(describe_output "RedisPasswordSecretName")

  require_value "$REDIS_ENDPOINT_PARAMETER" "RedisEndpointParameterName"
  require_value "$REDIS_PORT_PARAMETER" "RedisPortParameterName"
  require_value "$REDIS_PASSWORD_SECRET" "RedisPasswordSecretName"

  echo "Leser REDIS_ENDPOINT fra $REDIS_ENDPOINT_PARAMETER ..."
  export REDIS_ENDPOINT=$(aws ssm get-parameter \
    --region "$REGION" \
    --name "$REDIS_ENDPOINT_PARAMETER" \
    --query 'Parameter.Value' \
    --output text)

  echo "Leser REDIS_PORT fra $REDIS_PORT_PARAMETER ..."
  export REDIS_PORT=$(aws ssm get-parameter \
    --region "$REGION" \
    --name "$REDIS_PORT_PARAMETER" \
    --query 'Parameter.Value' \
    --output text)

  echo "Leser REDIS_PASSWORD fra secret $REDIS_PASSWORD_SECRET ..."
  secret_payload=$(aws secretsmanager get-secret-value \
    --region "$REGION" \
    --secret-id "$REDIS_PASSWORD_SECRET" \
    --query 'SecretString' \
    --output text)

  export REDIS_PASSWORD=$(jq -r '.authToken // empty' <<<"$secret_payload")
  if [[ -z "$REDIS_PASSWORD" ]]; then
    echo "Secret $REDIS_PASSWORD_SECRET inneholder ikke feltet authToken." >&2
    return 1
  fi

  echo "REDIS_* er eksportert i dette shell-et. Kjører npm run check-examples-api ..."
  npm run check-examples-api -- --url="$API_URL"
}

[[ "${BASH_SOURCE[0]}" == "$0" ]] && cloudshell_check_examples "$@"
