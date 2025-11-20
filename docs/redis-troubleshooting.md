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

# Alternativ kommando som henter ID fra stack-ressursene
RG_ID_RESOURCES=$(aws cloudformation describe-stack-resources \
  --region "$REGION" \
  --stack-name "$DATA_STACK" \
  --query "StackResources[?ResourceType=='AWS::ElastiCache::ReplicationGroup'].PhysicalResourceId" \
  --output text)
echo "RG_ID_RESOURCES=${RG_ID_RESOURCES}"

# Avbryt hvis ID er tom eller placeholder – vi må være sikre på at modify-replication-group får en gyldig ID
if [ -z "$RG_ID_RESOURCES" ] || [ "$RG_ID_RESOURCES" = "None" ] || [[ "$RG_ID_RESOURCES" == *"<"*">"* ]]; then
  echo "Fant ikke gyldig ReplicationGroupId i describe-stack-resources – avbryter." >&2
  exit 1
fi

RG_ID=${RG_ID_RESOURCES:-$RG_ID}
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
for å trigge ny deploy-konfig og konstruerer et valid JSON-objekt på
formen `{"Variables":{...}}` slik AWS CLI forventer:

```bash
LAMBDA_FN="math-visuals-api-ApiFunction-o6bkBzPH7ZPu"

aws lambda get-function-configuration \
  --region "$REGION" \
  --function-name "$LAMBDA_FN" \
  --query 'Environment.Variables' \
  --output json > /tmp/env.json

# Legg til en nop-variabel for å tvinge refresh og bygg JSON som CLI-en forventer
ENV_JSON=$(jq -c '{Variables:(. + {CONFIG_REFRESH:(now|tostring)})}' /tmp/env.json)

aws lambda update-function-configuration \
  --region "$REGION" \
  --function-name "$LAMBDA_FN" \
  --environment "$ENV_JSON"

# (Alternativt med eksplisitt escaped JSON hvis du foretrekker hele strengen
# inline, f.eks.: --environment '{"Variables":{"CONFIG_REFRESH":"1700000000"}}')

Denne varianten samsvarer med `aws lambda update-function-configuration` sine
forventninger til JSON og unngår parse-feilen som kan oppstå med `Variables=`-
prefikset.
```


Hvis du bare trenger å rulle Lambda på nytt etter en secret-endring (uten å
huske parametrene til stacken), kan du bruke helperen som pakker alle
ParameterKey-er som `UsePreviousValue=true` og kaller `update-stack` med
forrige template:

```bash
bash scripts/cloudshell-redeploy-api.sh --region="$REGION" --stack="math-visuals-api"
```

Hvis CloudShell mister tilkoblingen midt i en kommando (f.eks. `[exited]`),
kjør siste kommando på nytt. Det er trygt å re-kjøre `put-secret-value` og
`modify-replication-group` med samme token.

Kjør deretter `bash scripts/cloudshell-verify.sh --trace` på nytt. Hvis
/API/EXAMPLES fremdeles gir 503 med `WRONGPASS`, verifiser at auth-tokenet
på Secrets Manager og ElastiCache matcher og at Lambda har rullet ut ny
konfigurasjon.
