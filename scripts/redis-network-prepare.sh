#!/usr/bin/env bash
set -euo pipefail

DEFAULT_REGION=${DEFAULT_REGION:-eu-west-1}
DEFAULT_DATA_STACK=${DEFAULT_DATA_STACK:-math-visuals-data}
DEFAULT_API_STACK=${DEFAULT_API_STACK:-math-visuals-api}
CLOUDSHELL_CIDR=""

usage() {
  cat <<'USAGE'
Bruk: bash scripts/redis-network-prepare.sh [flagg]

Oppdaterer Redis-securitygruppen med ingress fra Lambda og CloudShell og
validerer at Redis-subnettene og Lambda ligger i samme VPC med riktig routing.

Tilgjengelige flagg:
  --region=REGION       Regionen som brukes for alle AWS-kall (standard: eu-west-1)
  --data-stack=NAME     CloudFormation-stacken som eier Redis/VPC-ressursene (standard: math-visuals-data)
  --api-stack=NAME      CloudFormation-stacken som eier API/Lambda-funksjonen (standard: math-visuals-api)
  --cloudshell-cidr=CIDR
                        CIDR-blokk som skal få tilgang fra CloudShell (hoppe over auto-
                        oppslag). Må inkludere prefiks, f.eks. 1.2.3.4/32
  --trace               Slå på shell tracing (set -x)
  -h, --help            Vis denne hjelpen

Skriptet forutsetter at du er logget inn med AWS-legitimasjon og at AWS CLI,
jq og python er tilgjengelig i PATH.
USAGE
}

REGION=$DEFAULT_REGION
DATA_STACK=$DEFAULT_DATA_STACK
API_STACK=$DEFAULT_API_STACK
TRACE=false
SHOW_HELP=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --region=*)
      REGION="${1#*=}"
      ;;
    --data-stack=*)
      DATA_STACK="${1#*=}"
      ;;
    --api-stack=*)
      API_STACK="${1#*=}"
      ;;
    --cloudshell-cidr=*)
      CLOUDSHELL_CIDR="${1#*=}"
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

if [[ "$TRACE" == true ]]; then
  set -x
fi

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Kommandoen '$1' mangler i PATH. Installer den før du fortsetter." >&2
    exit 1
  fi
}

for cmd in aws jq python3; do
  require_cmd "$cmd"
done

curl_available() {
  command -v curl >/dev/null 2>&1
}

record_status() {
  local status="$1"
  local label="$2"
  local message="${3:-}";

  if [[ "$status" -ne 0 ]]; then
    echo "$label feilet${message:+: }$message" >&2
    return
  fi

  if [[ -n "$message" ]]; then
    echo "$label: $message"
  else
    echo "$label: OK"
  fi
}

describe_output_for_stack() {
  local stack_name="$1"
  local output_key="$2"
  aws cloudformation describe-stacks \
    --region "$REGION" \
    --stack-name "$stack_name" \
    --query "Stacks[0].Outputs[?OutputKey==\`$output_key\`].OutputValue" \
    --output text
}

info() {
  echo "[redis-network-prepare] $*"
}

info "Henter VPC/Redis-verdier fra $DATA_STACK i $REGION"
redis_sg=$(describe_output_for_stack "$DATA_STACK" "RedisSecurityGroupId")
lambda_sg=$(describe_output_for_stack "$DATA_STACK" "LambdaSecurityGroupId")
private_subnet1=$(describe_output_for_stack "$DATA_STACK" "PrivateSubnet1Id")
private_subnet2=$(describe_output_for_stack "$DATA_STACK" "PrivateSubnet2Id")
redis_endpoint=$(describe_output_for_stack "$DATA_STACK" "RedisPrimaryEndpoint")
redis_port=$(describe_output_for_stack "$DATA_STACK" "RedisPort")

if [[ -z "$redis_sg" || -z "$lambda_sg" || -z "$private_subnet1" || -z "$private_subnet2" ]]; then
  echo "Fant ikke alle nødvendige outputs i $DATA_STACK" >&2
  exit 1
fi

subnet_desc=$(aws ec2 describe-subnets \
  --region "$REGION" \
  --subnet-ids "$private_subnet1" "$private_subnet2" \
  --query 'Subnets[].{id:SubnetId,cidr:CidrBlock,vpc:VpcId,az:AvailabilityZone}' \
  --output json)

redis_vpc=$(echo "$subnet_desc" | jq -r '.[0].vpc // ""')
redis_cidrs=$(echo "$subnet_desc" | jq -r '.[].cidr')

if [[ -z "$redis_vpc" ]]; then
  echo "Kunne ikke hente VPC-ID fra Redis-subnettene" >&2
  exit 1
fi

info "Ser etter CloudShell-security groups i VPC $redis_vpc"
cloudshell_sgs_raw=$(aws ec2 describe-network-interfaces \
  --region "$REGION" \
  --filters Name=interface-type,Values=api_gateway_cloud_shell Name=status,Values=available,in-use Name=vpc-id,Values="$redis_vpc" \
  --query 'NetworkInterfaces[].Groups[].GroupId' \
  --output text 2>/dev/null || true)

if [[ -z "$cloudshell_sgs_raw" ]]; then
  echo "Fant ingen CloudShell-ENI-er i $redis_vpc." >&2
fi

mapfile -t cloudshell_sgs < <(tr '\t' '\n' <<<"$cloudshell_sgs_raw" | sed '/^$/d' | sort -u)

info "Ser etter Lambda-funksjonen fra $API_STACK"
api_fn_physical=$(aws cloudformation describe-stack-resource \
  --region "$REGION" \
  --stack-name "$API_STACK" \
  --logical-resource-id ApiFunction \
  --query 'StackResourceDetail.PhysicalResourceId' \
  --output text 2>/dev/null || true)

if [[ -z "$api_fn_physical" || "$api_fn_physical" == "None" ]]; then
  echo "Fant ikke ApiFunction i stacken $API_STACK; hopper over Lambda/VPC-sjekk." >&2
else
  lambda_config=$(aws lambda get-function-configuration \
    --region "$REGION" \
    --function-name "$api_fn_physical")
  mapfile -t lambda_subnets < <(echo "$lambda_config" | jq -r '.VpcConfig.SubnetIds[]?')
  mapfile -t lambda_sgs_from_lambda < <(echo "$lambda_config" | jq -r '.VpcConfig.SecurityGroupIds[]?')

  if [[ ${#lambda_sgs_from_lambda[@]} -gt 0 ]]; then
    if printf '%s\n' "${lambda_sgs_from_lambda[@]}" | grep -Fxq "$lambda_sg"; then
      record_status 0 "Lambda SG" "Lambda bruker $lambda_sg"
    else
      record_status 1 "Lambda SG" "Lambda mangler forventet SG $lambda_sg (fant ${lambda_sgs_from_lambda[*]:-ingen})"
    fi
  else
    record_status 1 "Lambda SG" "Fant ingen security groups i Lambda-konfigurasjonen"
  fi

  if [[ ${#lambda_subnets[@]} -gt 0 ]]; then
    lambda_vpc=$(aws ec2 describe-subnets \
      --region "$REGION" \
      --subnet-ids "${lambda_subnets[@]}" \
      --query 'Subnets[0].VpcId' \
      --output text 2>/dev/null || "")

    if [[ -n "$lambda_vpc" && "$lambda_vpc" != "$redis_vpc" ]]; then
      record_status 1 "Lambda VPC" "Lambda ligger i $lambda_vpc, men Redis ligger i $redis_vpc"
    else
      record_status 0 "Lambda VPC" "Lambda og Redis deler VPC $redis_vpc"
    fi

    missing_subnets=()
    for expected in "$private_subnet1" "$private_subnet2"; do
      if ! printf '%s\n' "${lambda_subnets[@]}" | grep -Fxq "$expected"; then
        missing_subnets+=("$expected")
      fi
    done

    if [[ ${#missing_subnets[@]} -gt 0 ]]; then
      record_status 1 "Lambda subnet" "Manglende subnett: ${missing_subnets[*]}"
    else
      record_status 0 "Lambda subnet" "Lambda er koblet til begge Redis-subnettene"
    fi
  else
    record_status 1 "Lambda VPC" "Fant ingen VpcConfig på $api_fn_physical"
  fi
fi

sg_has_ingress() {
  local target_sg="$1"
  local source_sg="$2"
  local perm_count
  perm_count=$(aws ec2 describe-security-groups \
    --region "$REGION" \
    --group-ids "$target_sg" \
    --query "length(SecurityGroups[0].IpPermissions[?FromPort==\`6379\` && ToPort==\`6379\` && IpProtocol=='tcp' && contains(UserIdGroupPairs[].GroupId, \`$source_sg\`) == `true`])" \
    --output text 2>/dev/null || echo "0")
  [[ "$perm_count" != "0" && "$perm_count" != "None" ]]
}

sg_has_cidr_ingress() {
  local target_sg="$1"
  local cidr="$2"
  local perm_count
  perm_count=$(aws ec2 describe-security-groups \
    --region "$REGION" \
    --group-ids "$target_sg" \
    --query "length(SecurityGroups[0].IpPermissions[?FromPort==\`6379\` && ToPort==\`6379\` && IpProtocol=='tcp' && contains(IpRanges[].CidrIp, \`$cidr\`) == `true`])" \
    --output text 2>/dev/null || echo "0")
  [[ "$perm_count" != "0" && "$perm_count" != "None" ]]
}

ensure_ingress_rule() {
  local source_sg="$1"
  local label="$2"

  if [[ -z "$source_sg" ]]; then
    record_status 1 "SG-ingress ($label)" "Kilde-SG mangler"
    return
  fi

  if sg_has_ingress "$redis_sg" "$source_sg"; then
    record_status 0 "SG-ingress ($label)" "Regel finnes allerede"
    return
  fi

  set +e
  aws ec2 authorize-security-group-ingress \
    --region "$REGION" \
    --group-id "$redis_sg" \
    --ip-permissions "IpProtocol=tcp,FromPort=6379,ToPort=6379,UserIdGroupPairs=[{GroupId=$source_sg}]" >/dev/null 2>&1
  auth_status=$?
  set -e

  if [[ "$auth_status" -ne 0 ]]; then
    record_status 1 "SG-ingress ($label)" "Kunne ikke legge til regel fra $source_sg"
  else
    record_status 0 "SG-ingress ($label)" "La til regel fra $source_sg"
  fi
}

ensure_cidr_ingress() {
  local cidr="$1"
  local label="$2"

  if [[ -z "$cidr" ]]; then
    record_status 1 "SG-ingress ($label)" "CIDR mangler"
    return
  fi

  if sg_has_cidr_ingress "$redis_sg" "$cidr"; then
    record_status 0 "SG-ingress ($label)" "Regel finnes allerede"
    return
  fi

  set +e
  aws ec2 authorize-security-group-ingress \
    --region "$REGION" \
    --group-id "$redis_sg" \
    --ip-permissions "IpProtocol=tcp,FromPort=6379,ToPort=6379,IpRanges=[{CidrIp=$cidr,Description=CloudShell}]" >/dev/null 2>&1
  auth_status=$?
  set -e

  if [[ "$auth_status" -ne 0 ]]; then
    record_status 1 "SG-ingress ($label)" "Kunne ikke legge til regel fra $cidr"
  else
    record_status 0 "SG-ingress ($label)" "La til regel fra $cidr"
  fi
}

ensure_ingress_rule "$lambda_sg" "Lambda"

if [[ ${#cloudshell_sgs[@]} -gt 0 ]]; then
  for cs_sg in "${cloudshell_sgs[@]}"; do
    ensure_ingress_rule "$cs_sg" "CloudShell"
  done
else
  cloudshell_cidr_source="$CLOUDSHELL_CIDR"

  if [[ -z "$cloudshell_cidr_source" ]]; then
    if curl_available; then
      cloudshell_ip=$(curl -fs --max-time 10 ifconfig.me || true)
      if [[ -n "$cloudshell_ip" ]]; then
        cloudshell_cidr_source="$cloudshell_ip/32"
        info "Bruker CloudShell-CIDR fra ifconfig.me: $cloudshell_cidr_source"
      else
        echo "Ingen CloudShell-SG-er ble funnet og kunne ikke hente offentlig IP fra ifconfig.me" >&2
      fi
    else
      echo "Ingen CloudShell-SG-er ble funnet og curl er ikke tilgjengelig for å hente CloudShell-IP." >&2
    fi
  else
    info "Bruker CloudShell-CIDR fra flagg: $cloudshell_cidr_source"
  fi

  if [[ -n "$cloudshell_cidr_source" ]]; then
    ensure_cidr_ingress "$cloudshell_cidr_source" "CloudShell CIDR"
  else
    echo "Ingen CloudShell-SG-er ble funnet; redis-SG-en tillater kun Lambda for øyeblikket." >&2
  fi
fi

check_routes_for_subnet() {
  local subnet_id="$1"
  local label="$2"

  local routes_json
  routes_json=$(aws ec2 describe-route-tables \
    --region "$REGION" \
    --filters Name=association.subnet-id,Values="$subnet_id" \
    --output json)

  local result
  result=$(ROUTES="$routes_json" python3 - <<'PY'
import json
import os

routes_doc = json.loads(os.environ.get("ROUTES", "{}"))
route_tables = routes_doc.get("RouteTables") or []
allowed_prefixes = ("nat-", "igw-", "eigw-", "tgw-", "pcx-", "local")

for rt in route_tables:
    for route in rt.get("Routes", []):
        if route.get("State") != "active":
            continue
        dest = route.get("DestinationCidrBlock") or route.get("DestinationIpv6CidrBlock") or ""
        target = route.get("GatewayId") or route.get("NatGatewayId") or route.get("TransitGatewayId") or route.get("VpcPeeringConnectionId") or route.get("EgressOnlyInternetGatewayId") or route.get("NetworkInterfaceId") or ""
        if dest in ("0.0.0.0/0", "::/0") and any(target.startswith(prefix) for prefix in allowed_prefixes):
            print(f"pass:{dest}->{target}")
            raise SystemExit
print("fail")
PY
  )

  if [[ "$result" == pass:* ]]; then
    record_status 0 "Rute ($label)" "${result#pass:}"
  else
    record_status 1 "Rute ($label)" "Fant ingen aktiv 0.0.0.0/0 eller ::/0-rute til NAT/IGW"
  fi
}

check_routes_for_subnet "$private_subnet1" "${private_subnet1}"
check_routes_for_subnet "$private_subnet2" "${private_subnet2}"

redis_host_hint=${redis_endpoint:-REDIS_ENDPOINT}
redis_port_hint=${redis_port:-6379}

echo "\nOppdatering fullført. Kjør redis-cli/valkey-cli med TLS mot ${redis_host_hint}:${redis_port_hint} og deretter bash scripts/cloudshell-verify.sh --trace for endelig verifisering."
