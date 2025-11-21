#!/usr/bin/env bash
set -euo pipefail

DEFAULT_REGION=${DEFAULT_REGION:-eu-west-1}
DEFAULT_REDIS_VPC=${DEFAULT_REDIS_VPC:-vpc-083aa020e22000b94}

usage() {
  cat <<'USAGE'
Bruk: bash scripts/cloudshell-eni-check.sh [flagg]

Tilgjengelige flagg:
  --region=REGION      Regionen CloudShell-kallet skal bruke (standard: eu-west-1)
  --redis-vpc=VPC_ID   VPC-en der Redis finnes (standard: vpc-083aa020e22000b94)
  --trace              Slå på shell tracing for feilsøking
  -h, --help           Vis denne hjelpen

Skriptet forventer at du allerede er autentisert mot AWS (aws configure / aws sso login).
USAGE
}

REGION=$DEFAULT_REGION
REDIS_VPC=$DEFAULT_REDIS_VPC
TRACE=false
SHOW_HELP=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --region=*)
      REGION="${1#*=}"
      ;;
    --redis-vpc=*)
      REDIS_VPC="${1#*=}"
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

for cmd in aws jq; do
  require_cmd "$cmd"
done

status=0

cloudshell_matches=""

log_step() {
  local label="$1"
  local message="$2"
  echo "==> $label: $message"
}

find_cloudshell_interface() {
  local filters=("Name=interface-type,Values=api_gateway_cloud_shell" "Name=status,Values=available,in-use")
  local filter_description="interface-type=api_gateway_cloud_shell og status i [available,in-use]"

  if [[ -n "$REDIS_VPC" ]]; then
    filters+=("Name=vpc-id,Values=$REDIS_VPC")
    filter_description+=", vpc-id=$REDIS_VPC"
  fi

  local eni_json
  eni_json=$(aws ec2 describe-network-interfaces \
    --region "$REGION" \
    --filters "${filters[@]}" \
    --query "NetworkInterfaces[].{eni:NetworkInterfaceId,desc:Description,sgs:Groups[].GroupId,vpc:VpcId,subnet:SubnetId,az:AvailabilityZone,status:Status}" \
    --output json)

  cloudshell_matches="$eni_json"

  local match_count
  match_count=$(jq 'length' <<<"$eni_json")

  if [[ "$match_count" -eq 0 ]]; then
    echo "Fant ingen CloudShell-ENI-er med $filter_description i region $REGION." >&2
    return 1
  fi

  jq -c --arg vpc "$REDIS_VPC" '([.[] | select(.vpc == $vpc)][0]) // .[0]' <<<"$eni_json"
}

if ! cloudshell_entry=$(find_cloudshell_interface); then
  exit 2
fi

log_step "CloudShell-kandidater" "Fant $(jq 'length' <<<"$cloudshell_matches") ENI-er med interface-type api_gateway_cloud_shell"
echo "$cloudshell_matches" | jq -r '.[] | "- " + (.eni // "<ukjent>") + " (" + (.vpc // "<ukjent VPC>") + ", " + (.subnet // "<ukjent subnet>") + ", status=" + (.status // "<ukjent>") + ")"'

eni_id=$(jq -r '.eni' <<<"$cloudshell_entry")
description=$(jq -r '.desc' <<<"$cloudshell_entry")
eni_vpc=$(jq -r '.vpc' <<<"$cloudshell_entry")
subnet_id=$(jq -r '.subnet' <<<"$cloudshell_entry")
sgs=$(jq -r '.sgs | join(",")' <<<"$cloudshell_entry")
status_str=$(jq -r '.status' <<<"$cloudshell_entry")
az=$(jq -r '.az' <<<"$cloudshell_entry")

log_step "CloudShell-ENI" "${eni_id} (${description:-<ingen beskrivelse>})"
echo "  VPC:    $eni_vpc"
echo "  Subnet: $subnet_id ($az)"
echo "  SGs:    ${sgs:-<ingen>}"
echo "  Status: $status_str"

if [[ "$eni_vpc" != "$REDIS_VPC" ]]; then
  echo "ENI-en ligger i VPC $eni_vpc, som ikke samsvarer med Redis-VPC $REDIS_VPC." >&2
  echo "Åpne CloudShell i riktig konto/VPC, eller test fra en EC2/bastion i Redis-VPC." >&2
  exit 3
fi

log_step "VPC-samsvar" "ENI ligger i Redis-VPC ($REDIS_VPC)"

log_step "Rutetabell" "Slår opp ruter for subnett $subnet_id"
rt_output=$(aws ec2 describe-route-tables \
  --filters Name=association.subnet-id,Values="$subnet_id" \
  --region "$REGION" \
  --output json)

echo "$rt_output" | jq -r '.RouteTables[] | "- " + (.RouteTableId // "<ukjent>")'

reachable_routes=$(echo "$rt_output" | jq -r '.RouteTables[].Routes[] | select(.State=="active") | [.DestinationCidrBlock, .DestinationPrefixListId] | map(select(. != null)) | .[0] as $dest | {target: (.GatewayId // .NatGatewayId // .TransitGatewayId // .VpcPeeringConnectionId // .EgressOnlyInternetGatewayId // .NetworkInterfaceId // "local"), dest: $dest} | "  " + (.dest // "<ukjent destinasjon>") + " -> " + (.target // "<ukjent mål>")' | sed '/^  null/d')

if [[ -n "$reachable_routes" ]]; then
  echo "Aktive ruter:"
  echo "$reachable_routes"
else
  echo "Fant ingen aktive ruter i rutetabellen (kontroller subnett-assosiasjoner manuelt)."
fi

log_step "Neste steg" "Hvis rutene ikke peker mot Redis-subnettene eller en NAT/IGW som når dem, flytt CloudShell til et subnett med riktige ruter eller oppdater rutetabellen. Kjør deretter redis-cli --tls ... PING på nytt."

exit "$status"
