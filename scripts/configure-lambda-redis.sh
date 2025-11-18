#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<USAGE
Usage: $(basename "$0") <lambda-function-name>

Henter VPC- og Redis-verdier fra CloudFormation/SSM/Secrets Manager og oppdaterer
Lambda-funksjonen slik at den kjører inne i VPC-en og bruker Secrets-baserte
Redis-miljøvariabler.

Obligatoriske argumenter:
  <lambda-function-name>  Navnet/ARN-en til Lambda-funksjonen som skal oppdateres.

Miljøvariabler:
  DATA_STACK        Navn på data-stack (default: math-visuals-data)
  AWS_REGION        Region for ressursene (default: eu-west-1)
  AWS_PROFILE       Valgfritt. Brukes av AWS CLI ved behov.

Eksempel:
  DATA_STACK=math-visuals-data AWS_REGION=eu-west-1 \
    ./scripts/configure-lambda-redis.sh math-visuals-api
USAGE
}

if [[ ${1:-} == "-h" || ${1:-} == "--help" ]]; then
  usage
  exit 0
fi

if [[ $# -lt 1 ]]; then
  echo "Feil: Mangler Lambda-funksjonsnavn." >&2
  usage
  exit 1
fi

if ! command -v aws >/dev/null 2>&1; then
  echo "Feil: aws CLI er ikke tilgjengelig i PATH." >&2
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "Feil: jq må være installert for å parse Secrets Manager-responsen." >&2
  exit 1
fi

FUNCTION_NAME=$1
DATA_STACK=${DATA_STACK:-math-visuals-data}
REGION=${AWS_REGION:-${AWS_DEFAULT_REGION:-eu-west-1}}

fetch_output() {
  local output_key=$1
  aws cloudformation describe-stacks \
    --region "$REGION" \
    --stack-name "$DATA_STACK" \
    --query "Stacks[0].Outputs[?OutputKey==\`$output_key\`].OutputValue" \
    --output text
}

require_value() {
  local value=$1
  local description=$2
  if [[ -z "$value" || "$value" == "None" ]]; then
    echo "Feil: Fant ingen verdi for $description i stacken $DATA_STACK." >&2
    exit 1
  fi
}

PRIVATE_SUBNET1=$(fetch_output PrivateSubnet1Id)
require_value "$PRIVATE_SUBNET1" "PrivateSubnet1Id"

PRIVATE_SUBNET2=$(fetch_output PrivateSubnet2Id)
require_value "$PRIVATE_SUBNET2" "PrivateSubnet2Id"

LAMBDA_SECURITY_GROUP=$(fetch_output LambdaSecurityGroupId)
require_value "$LAMBDA_SECURITY_GROUP" "LambdaSecurityGroupId"

REDIS_ENDPOINT_PARAMETER=$(fetch_output RedisEndpointParameterName)
require_value "$REDIS_ENDPOINT_PARAMETER" "RedisEndpointParameterName"

REDIS_PORT_PARAMETER=$(fetch_output RedisPortParameterName)
require_value "$REDIS_PORT_PARAMETER" "RedisPortParameterName"

REDIS_PASSWORD_SECRET=$(fetch_output RedisPasswordSecretName)
require_value "$REDIS_PASSWORD_SECRET" "RedisPasswordSecretName"

REDIS_ENDPOINT=$(aws ssm get-parameter \
  --region "$REGION" \
  --name "$REDIS_ENDPOINT_PARAMETER" \
  --query 'Parameter.Value' \
  --output text)
require_value "$REDIS_ENDPOINT" "Redis-endepunktet"

REDIS_PORT=$(aws ssm get-parameter \
  --region "$REGION" \
  --name "$REDIS_PORT_PARAMETER" \
  --query 'Parameter.Value' \
  --output text)
require_value "$REDIS_PORT" "Redis-porten"

SECRET_STRING=$(aws secretsmanager get-secret-value \
  --region "$REGION" \
  --secret-id "$REDIS_PASSWORD_SECRET" \
  --query 'SecretString' \
  --output text)
require_value "$SECRET_STRING" "Redis-passordet (SecretString)"

if ! REDIS_PASSWORD=$(printf '%s' "$SECRET_STRING" | jq -er 'try (.authToken // .password // .secret // .value // .token)'); then
  # SecretString er sannsynligvis ren tekst
  REDIS_PASSWORD=$SECRET_STRING
fi

ENVIRONMENT_JSON=$(jq -n \
  --arg endpoint "$REDIS_ENDPOINT" \
  --arg port "$REDIS_PORT" \
  --arg password "$REDIS_PASSWORD" \
  '{Variables: {REDIS_ENDPOINT: $endpoint, REDIS_PORT: $port, REDIS_PASSWORD: $password}}')

aws lambda update-function-configuration \
  --region "$REGION" \
  --function-name "$FUNCTION_NAME" \
  --vpc-config "SubnetIds=$PRIVATE_SUBNET1,$PRIVATE_SUBNET2,SecurityGroupIds=$LAMBDA_SECURITY_GROUP" \
  --environment "$ENVIRONMENT_JSON"

echo "Oppdatert $FUNCTION_NAME med VPC-konfigurasjon og Redis-hemmeligheter fra $DATA_STACK i $REGION." >&2
