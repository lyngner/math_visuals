#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat <<'USAGE'
Bruk: scripts/cloudshell-export-actions-secrets.sh [--region REGION] [--shared-stack NAVN] [--static-stack NAVN]
       [--api-artifact-bucket NAVN] [--api-artifact-key STI] [--api-stage-name NAVN]
       [--aws-iac-role-arn ARN] [--price-class PRICE_CLASS]

Henter secrets/parameterverdier fra CloudFormation-stacker og skriver KEY=VALUE-linjer til stdout
for bruk som GitHub Actions-secrets.

Miljøvariabler/standardverdier:
  REGION=eu-west-1
  SHARED_STACK=math-visuals-shared
  STATIC_STACK=math-visuals-static-site
  API_ARTIFACT_BUCKET=<bucket-med-lambda-artefakter>
  API_ARTIFACT_KEY=lambda/api-lambda.zip
  API_STAGE_NAME=prod
  AWS_IAC_ROLE_ARN=<fyll-inn-rolle-arn>
  STATIC_SITE_CLOUDFRONT_PRICE_CLASS=PriceClass_All

Flagg:
  --region                 AWS-region (standard: $REGION)
  --shared-stack           Stack med Redis-parametre (standard: $SHARED_STACK)
  --static-stack           Stack med CloudFront/S3 (standard: $STATIC_STACK). Hvis stacken mangler
                           skrives tomme verdier og det gis en advarsel.
  --api-artifact-bucket    S3-bøtte for Lambda-artefaktet (kreves, ingen standard utover placeholder)
  --api-artifact-key       Nøkkel for Lambda-artefaktet (standard: $API_ARTIFACT_KEY)
  --api-stage-name         API-steg/alias (standard: $API_STAGE_NAME)
  --aws-iac-role-arn       ARN for GitHub OIDC-rollen (kreves, ingen standard utover placeholder)
  --price-class            CloudFront price class (standard: $STATIC_SITE_CLOUDFRONT_PRICE_CLASS)
  -h, --help               Vis denne hjelpeteksten

Eksempel:
  REGION=eu-west-1 SHARED_STACK=math-visuals-shared \
    scripts/cloudshell-export-actions-secrets.sh \
      --api-artifact-bucket my-artifacts-bucket \
      --aws-iac-role-arn arn:aws:iam::123456789012:role/MathVisualsGithubDeploy
USAGE
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Mangler kommando: $1" >&2
    exit 1
  fi
}

warn() {
  echo "[advarsel] $1" >&2
}

get_output() {
  local stack="$1" key="$2"
  aws cloudformation describe-stacks \
    --stack-name "$stack" \
    --query "Stacks[0].Outputs[?OutputKey=='$key'].OutputValue" \
    --output text
}

stack_exists() {
  local stack="$1"
  aws cloudformation describe-stacks --stack-name "$stack" \
    --query 'Stacks[0].StackName' --output text >/dev/null 2>&1
}

fetch_shared_values() {
  local stack="$1"
  local pw_secret endpoint_param port_param

  pw_secret=$(get_output "$stack" RedisPasswordSecretName)
  endpoint_param=$(get_output "$stack" RedisEndpointParameterName)
  port_param=$(get_output "$stack" RedisPortParameterName)

  if [[ -z "$pw_secret" || -z "$endpoint_param" || -z "$port_param" ]]; then
    echo "Fant ikke alle Redis-outputs i stacken '$stack'." >&2
    exit 1
  fi

  REDIS_PASSWORD=$(aws secretsmanager get-secret-value --secret-id "$pw_secret" --query SecretString --output text | jq -r .authToken)
  REDIS_ENDPOINT=$(aws ssm get-parameter --name "$endpoint_param" --with-decryption --query Parameter.Value --output text)
  REDIS_PORT=$(aws ssm get-parameter --name "$port_param" --with-decryption --query Parameter.Value --output text)
}

fetch_static_values() {
  local stack="$1"
  if ! stack_exists "$stack"; then
    warn "Fant ikke static stack '$stack'. Fyll inn STATIC_SITE_* verdiene manuelt."
    STATIC_SITE_BUCKET_NAME=""
    STATIC_SITE_CLOUDFRONT_DISTRIBUTION_ID=""
    STATIC_SITE_API_DOMAIN=""
    return
  fi

  STATIC_SITE_BUCKET_NAME=$(get_output "$stack" StaticSiteBucketName)
  STATIC_SITE_CLOUDFRONT_DISTRIBUTION_ID=$(get_output "$stack" CloudFrontDistributionId)
  STATIC_SITE_API_DOMAIN=$(get_output "$stack" CloudFrontDistributionDomainName || true)
}

main() {
  REGION=${REGION:-eu-west-1}
  SHARED_STACK=${SHARED_STACK:-math-visuals-shared}
  STATIC_STACK=${STATIC_STACK:-math-visuals-static-site}
  API_ARTIFACT_BUCKET=${API_ARTIFACT_BUCKET:-<bucket-med-lambda-artefakter>}
  API_ARTIFACT_KEY=${API_ARTIFACT_KEY:-lambda/api-lambda.zip}
  API_STAGE_NAME=${API_STAGE_NAME:-prod}
  AWS_IAC_ROLE_ARN=${AWS_IAC_ROLE_ARN:-<fyll-inn-rolle-arn>}
  STATIC_SITE_CLOUDFRONT_PRICE_CLASS=${STATIC_SITE_CLOUDFRONT_PRICE_CLASS:-PriceClass_All}
  local show_help=false

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --region) REGION="$2"; shift 2;;
      --shared-stack) SHARED_STACK="$2"; shift 2;;
      --static-stack) STATIC_STACK="$2"; shift 2;;
      --api-artifact-bucket) API_ARTIFACT_BUCKET="$2"; shift 2;;
      --api-artifact-key) API_ARTIFACT_KEY="$2"; shift 2;;
      --api-stage-name) API_STAGE_NAME="$2"; shift 2;;
      --aws-iac-role-arn) AWS_IAC_ROLE_ARN="$2"; shift 2;;
      --price-class) STATIC_SITE_CLOUDFRONT_PRICE_CLASS="$2"; shift 2;;
      -h|--help) show_help=true; shift;;
      *) echo "Ukjent flagg: $1" >&2; usage; exit 1;;
    esac
  done

  if [[ "$show_help" == true ]]; then
    usage
    exit 0
  fi

  require_cmd aws
  require_cmd jq

  export AWS_REGION="$REGION"

  if ! stack_exists "$SHARED_STACK"; then
    echo "Fant ikke shared stack '$SHARED_STACK'. Sett --shared-stack eller sørg for at stacken finnes." >&2
    exit 1
  fi

  fetch_shared_values "$SHARED_STACK"
  fetch_static_values "$STATIC_STACK"

  cat <<EOF
AWS_REGION=$AWS_REGION
AWS_IAC_ROLE_ARN=$AWS_IAC_ROLE_ARN
STATIC_SITE_BUCKET_NAME=${STATIC_SITE_BUCKET_NAME:-}
STATIC_SITE_CLOUDFRONT_DISTRIBUTION_ID=${STATIC_SITE_CLOUDFRONT_DISTRIBUTION_ID:-}
STATIC_SITE_API_DOMAIN=${STATIC_SITE_API_DOMAIN:-}
STATIC_SITE_API_ORIGIN_PATH=/
STATIC_SITE_CLOUDFRONT_PRICE_CLASS=$STATIC_SITE_CLOUDFRONT_PRICE_CLASS
API_ARTIFACT_BUCKET=$API_ARTIFACT_BUCKET
API_ARTIFACT_KEY=$API_ARTIFACT_KEY
API_STAGE_NAME=$API_STAGE_NAME
REDIS_PASSWORD=$REDIS_PASSWORD
REDIS_ENDPOINT=$REDIS_ENDPOINT
REDIS_PORT=$REDIS_PORT
# Valgfritt: EXAMPLES_SEED_JSON, EXAMPLES_SEED_JSON_PROD/DEV/PREVIEW, CLOUDFRONT_INVALIDATION_PATHS
EOF
}

main "$@"
