# Redis / API 503 "KVUnavailable" feilsøking

Når `scripts/cloudshell-verify.sh` feiler med 503 og loggene viser
`WRONGPASS invalid username-password pair`, betyr det at Redis-klusteret
ikke aksepterer auth-tokenet som brukes av Lambda.

## 1) Les gjeldende verdier

```bash
REGION="eu-west-1"
DATA_STACK="math-visuals-data"

aws cloudformation describe-stacks \
  --region "$REGION" \
  --stack-name "$DATA_STACK" \
  --query "Stacks[0].Outputs[?OutputKey==\`RedisReplicationGroupId\`].OutputValue" \
  --output text

aws ssm get-parameter \
  --region "$REGION" \
  --name "/math-visuals/prod/redis/endpoint" \
  --query Parameter.Value --output text

aws ssm get-parameter \
  --region "$REGION" \
  --name "/math-visuals/prod/redis/port" \
  --query Parameter.Value --output text

aws secretsmanager get-secret-value \
  --region "$REGION" \
  --secret-id "math-visuals/prod/redis/password" \
  --query SecretString --output text
```

## 2) Roter tokenet (hvis du ikke kjenner det riktige)

Sett `NEW_REDIS_TOKEN` til ny verdi og oppdater både Secrets Manager og
ElastiCache-klusteret. Pass på at `RG_ID` faktisk er satt før du kjører
`modify-replication-group` (feilen `ReplicationGroupId must be provided` betyr
ofte at `RG_ID` ble tom fordi kommandoen over ikke ga utslag).

```bash
set -euo pipefail

REGION="eu-west-1"
DATA_STACK="math-visuals-data"
SECRET_NAME="math-visuals/prod/redis/password"
NEW_REDIS_TOKEN="<ny_random_token>"

# Hent ReplicationGroupId på nytt og avbryt hvis den mangler
RG_ID=$(aws cloudformation describe-stacks \
  --region "$REGION" \
  --stack-name "$DATA_STACK" \
  --query "Stacks[0].Outputs[?OutputKey=='RedisReplicationGroupId'].OutputValue" \
  --output text)
echo "RG_ID=${RG_ID}"
if [ -z "$RG_ID" ] || [ "$RG_ID" = "None" ]; then
  echo "Fant ikke RedisReplicationGroupId – avbryter." >&2
  exit 1
fi

aws secretsmanager put-secret-value \
  --region "$REGION" \
  --secret-id "$SECRET_NAME" \
  --secret-string "{\"authToken\":\"${NEW_REDIS_TOKEN}\"}"

aws elasticache modify-replication-group \
  --region "$REGION" \
  --replication-group-id "$RG_ID" \
  --auth-token "$NEW_REDIS_TOKEN" \
  --apply-immediately
```

## 3) Bekreft og oppdater Lambda-konfig

Oppdater Parameter Store (dersom endepunkt/port er endret) og tving
Lambda til å laste miljøet på nytt. Feilen "Expected: '=', received: '"'
kan oppstå hvis `--environment`-verdien ikke er JSON. Kommandoen under
henter gjeldende environment, legger til en ny `CONFIG_REFRESH`-timestamp
for å trigge ny deploy-konfig og sender inn gyldig JSON:

```bash
LAMBDA_FN="math-visuals-api-ApiFunction-o6bkBzPH7ZPu"

aws lambda get-function-configuration \
  --region "$REGION" \
  --function-name "$LAMBDA_FN" \
  --query 'Environment.Variables' \
  --output json > /tmp/env.json

# Legg til en nop-variabel for å tvinge refresh
jq '.CONFIG_REFRESH = (now | tostring)' /tmp/env.json > /tmp/env-updated.json

ENV_JSON=$(jq -c '.CONFIG_REFRESH = (now | tostring)' /tmp/env.json)

aws lambda update-function-configuration \
  --region "$REGION" \
  --function-name "$LAMBDA_FN" \
  --environment "Variables=${ENV_JSON}"
```

Hvis CloudShell mister tilkoblingen midt i en kommando (f.eks. `[exited]`),
kjør siste kommando på nytt. Det er trygt å re-kjøre `put-secret-value` og
`modify-replication-group` med samme token.

Kjør deretter `bash scripts/cloudshell-verify.sh --trace` på nytt. Hvis
/API/EXAMPLES fremdeles gir 503 med `WRONGPASS`, verifiser at auth-tokenet
på Secrets Manager og ElastiCache matcher og at Lambda har rullet ut ny
konfigurasjon.
