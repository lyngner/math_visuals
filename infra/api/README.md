# API infrastructure

Dette kataloget inneholder en AWS SAM-mal som oppretter en Node.js 18 Lambda-funksjon og eksponerer den via en HTTP API (API Gateway). Lambdaen bruker `@vendia/serverless-express` til å montere alle handlerne i [`api/`](../../api), slik at eksisterende Vercel-endepunkter kan kjøres uendret i AWS.

## Hva malen oppretter

- IAM-rolle med CloudWatch-loggføring og leseadgang til Secrets Manager og Parameter Store.
- Lambda-funksjon som kjører `infra/api/runtime/index.js` (aggregerer alle `/api`-ruter).
- API Gateway HTTP API med `ANY`-ruter for `/api/examples`, `/api/examples/{proxy+}`,
  `/api/svg/raw`, `/api/figure-library/raw`, `/svg`, `/svg/{proxy+}`, `/bildearkiv`,
  `/bildearkiv/{proxy+}`, `/figure-library` og `/figure-library/{proxy+}` slik at
  vennlige URL-er treffer samme Lambda som `/api`-endepunktene.
- CORS-oppsett som tillater at `Access-Control-Allow-*`-headerne som settes i handlerne videreformidles til klientene.

## Pakking av Lambda-koden

Lambda-artefakten består av tre deler: runtime-filen (`infra/api/runtime/index.js`), `api/`-mappen og avhengighetene som er definert i `infra/api/lambda/package.json`. Følgende skript viser hvordan du kan produsere en zip-fil klar for opplasting til S3:

```bash
# Installer bare produksjonsavhengighetene for Lambda-runtime
npm ci --omit=dev --prefix infra/api/lambda

# Bygg en isolert mappe med runtime, avhengigheter og api/
rm -rf infra/api/build
mkdir -p infra/api/build/palette
# Inkluderer hele `palette/` slik at `palette-config.js` og hjelpetjenestene er tilgjengelige i `/var/task/palette/`
cp infra/api/runtime/index.js infra/api/build/index.js
cp infra/api/lambda/package.json infra/api/build/package.json
cp infra/api/lambda/package-lock.json infra/api/build/package-lock.json 2>/dev/null || true
cp -R infra/api/lambda/node_modules infra/api/build/node_modules
rsync -a --exclude 'node_modules' api/ infra/api/build/api/
rsync -a palette/ infra/api/build/palette/

# Verifiser at `palette-config.js` ble kopiert
test -f infra/api/build/palette/palette-config.js

# Lag en zip som kan lastes opp til S3
cd infra/api/build
zip -r ../api-lambda.zip .
cd -
```

Disse stegene finnes også automatisert i `scripts/package-api-lambda.sh`, som brukes til å produsere en zip hvor `palette/`-mappen alltid er inkludert.

Last opp `infra/api/api-lambda.zip` til ønsket S3-bucket og nøkkel, og bruk deretter CloudFormation/SAM til å deploye:

```bash
aws s3 cp infra/api/api-lambda.zip s3://<artefakt-bucket>/<sti>/api-lambda.zip

aws cloudformation deploy \
  --stack-name math-visuals-api \
  --template-file infra/api/template.yaml \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides \
      LambdaCodeS3Bucket=<artefakt-bucket> \
      LambdaCodeS3Key=<sti>/api-lambda.zip \
      StageName=prod \
      DataStackName=math-visuals-data \
      SharedParametersStackName=math-visuals-shared
```

Hvis du bruker versjonerte objekter i S3, kan du sette `LambdaCodeS3ObjectVersion=<versjon-id>` i `--parameter-overrides`.

`DataStackName` må peke på stacken som deployes fra `infra/data`. Denne verdien
brukes til å importere VPC-ID, private subnett, Lambda-sikkerhetsgruppen og
Redis-endepunkter slik at Lambdaen kan kjøre bak samme nettverk/firewall som
Redis.

`SharedParametersStackName` gjør at malen kan importere Secrets Manager- og
Parameter Store-navn fra `infra/shared-parameters.yaml`. Sørg for at
shared-stacken er deployet og at verdiene er oppdatert før du kjører kommandoen.

Etter deploy kan API-endepunktet finnes i stack-utsnittene:

```bash
aws cloudformation describe-stacks \
  --stack-name math-visuals-api \
  --query 'Stacks[0].Outputs'
```
