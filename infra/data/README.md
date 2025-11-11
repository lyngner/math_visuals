# Data plane infrastructure

Denne mappen inneholder en CloudFormation-mal (`template.yaml`) som beskriver en
fullisolert dataplattform for Redis i AWS. Malen etablerer

- en VPC med to private subnett for kjøring av Lambda-funksjoner og Redis,
- dedikerte sikkerhetsgrupper for Lambda og Redis, og
- en ElastiCache for Redis-replikasjonsgruppe med TLS og autentisering aktivert.

## Deployering

Bruk AWS CLI eller CloudFormation-konsollet for å opprette et stack basert på
`template.yaml`. Parameterne lar deg tilpasse CIDR-blokker, instanstype, antall
noder og vedlikeholdsvinduer. `RedisAuthToken`-parameteren skal leveres som en
[dynamic reference](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/dynamic-references.html)
til Secrets Manager slik at selve tokenet ikke sjekkes inn i koden.

Når stacken er opprettet eksponerer den følgende outputs som kan deles på tvers
av prosjekter ved hjelp av `Fn::ImportValue` eller ved å lese direkte fra
CloudFormation-responsen:

- `VpcId`, `PrivateSubnetIds` og `LambdaSecurityGroupId` brukes når Lambdaer
  må kjøres inne i VPC-en med nettverkstilgang til Redis.
- `RedisPrimaryEndpoint`, `RedisReaderEndpoint`, `RedisPort` og
  `RedisTlsRequired` beskriver hvordan klienter kobler seg til klyngen.

## Lambda-konfigurasjon

Lambda-funksjoner som skal snakke med Redis må kjøre inne i VPC-en og bruke
sikkerhetsgruppen som ble opprettet for formålet:

1. Sett `VpcConfig` på Lambda-funksjonen til å inkludere subnettene fra
   `PrivateSubnetIds` og sikkerhetsgruppen `LambdaSecurityGroupId`.
2. Sørg for at Lambda-rollen har tillatelse til å lese hemmeligheter fra Secrets
   Manager/Parameter Store ved å gi den policyer tilsvarende `secretsmanager:GetSecretValue`
   eller `ssm:GetParameter`.

### Miljøvariabler

Applikasjonskoden forventer følgende miljøvariabler:

- `REDIS_ENDPOINT`
- `REDIS_PORT`
- `REDIS_PASSWORD`

Disse bør **ikke** hardkodes. Følg i stedet dette mønsteret:

1. Legg inn Redis-endpointet og porten som CloudFormation-outputs og hent dem i
   utrullingspipen (for eksempel via `aws cloudformation describe-stacks`).
2. Lagre passordet i AWS Secrets Manager eller Systems Manager Parameter Store.
   Bruk samme hemmelighet som mates inn i `RedisAuthToken`-parameteren.
3. Når Lambdaen deployes, injiser miljøvariablene ved å
   - lese CloudFormation-outputene programmatisk og sette `REDIS_ENDPOINT` og
     `REDIS_PORT`, og
   - hente hemmeligheten med `aws secretsmanager get-secret-value` (eller via
     IaC-verktøy/SAM/Serverless Framework) og sette `REDIS_PASSWORD`.

Eksempel på kommandoer i et CI/CD-script:

```bash
STACK_NAME=math-visuals-data
REGION=eu-north-1

REDIS_ENDPOINT=$(aws cloudformation describe-stacks \
  --region "$REGION" \
  --stack-name "$STACK_NAME" \
  --query 'Stacks[0].Outputs[?OutputKey==`RedisPrimaryEndpoint`].OutputValue' \
  --output text)

REDIS_PORT=$(aws cloudformation describe-stacks \
  --region "$REGION" \
  --stack-name "$STACK_NAME" \
  --query 'Stacks[0].Outputs[?OutputKey==`RedisPort`].OutputValue' \
  --output text)

REDIS_PASSWORD=$(aws secretsmanager get-secret-value \
  --region "$REGION" \
  --secret-id redis/auth \
  --query 'SecretString' \
  --output text | jq -r '.authToken')

aws lambda update-function-configuration \
  --function-name math-visuals-api \
  --vpc-config SubnetIds=$(aws cloudformation \
      describe-stacks --region "$REGION" --stack-name "$STACK_NAME" \
      --query 'Stacks[0].Outputs[?OutputKey==`PrivateSubnetIds`].OutputValue' \
      --output text),SecurityGroupIds=$(aws cloudformation \
      describe-stacks --region "$REGION" --stack-name "$STACK_NAME" \
      --query 'Stacks[0].Outputs[?OutputKey==`LambdaSecurityGroupId`].OutputValue' \
      --output text) \
  --environment "Variables={REDIS_ENDPOINT=$REDIS_ENDPOINT,REDIS_PORT=$REDIS_PORT,REDIS_PASSWORD=$REDIS_PASSWORD}"
```

CI/CD-systemer som SAM, CDK eller Serverless Framework kan gjøre denne
miljøvariabelinjiseringen mer deklarativt, men prinsippet er det samme: hent
verdiene fra CloudFormation-outputs og Secrets Manager/Parameter Store i stedet
for å hardkode dem.
