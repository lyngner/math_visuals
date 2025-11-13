# Math Visuals – AWS migrasjon (Fase 1)

Denne fasen dokumenterer anbefalt målarkitektur for å flytte Math Visuals fra Vercel til AWS med statisk hosting i S3/CloudFront, API Gateway + Lambda for backend, og et Redis-kompatibelt lagringslag (MemoryDB/ElastiCache). Dokumentasjonen oppsummerer hvordan eksisterende prosjektstruktur påvirker migrasjonen og hvilke AWS-ressurser som behøves.

## 1. Statisk byggartefakt for S3

`npm run build` kaller `scripts/create-public.js`, som bygger en komplett `public/`-mappe ved å kopiere alle relevante rotmapper/-filer fra prosjektet. Skriptet ekskluderer kilde- og verktøymapper som `api`, `docs`, `node_modules`, `scripts`, `tests`, i tillegg til diverse konfigurasjonsfiler og skjulte mapper, slik at artefaktet består av HTML/CSS/JS som kan serveres direkte fra S3 uten ekstra filtrering.【F:scripts/create-public.js†L1-L77】

Skriptet kopierer også `packages/palette/dist` inn i `public/` dersom bygg-artefakten for paletten finnes. Dermed kan hele `public/` lastes opp til et versjonert S3-bucket og eksponeres via CloudFront.【F:scripts/create-public.js†L9-L10】【F:scripts/create-public.js†L79-L91】

## 2. Vercel-rewrites → CloudFront/API Gateway

Dagens URL-struktur er definert i `vercel.json`. Følgende tabell viser hvordan reglene kan oversettes til CloudFront-behaviors og API Gateway-ruter:

| Vercel rewrite | Foreslått CloudFront behavior | API Gateway/Lambda | Beskrivelse |
| --- | --- | --- | --- |
| `/bildearkiv/(.*)` → `/api/svg/raw?path=/$1` | Behavior matcher `/bildearkiv/*` og peker til API Gateway | Route `GET /api/svg/raw` (Lambda proxy) med query-parameter `path` | Beholder dynamisk SVG-generering for bildearkivet.【F:vercel.json†L4-L8】 |
| `/svg/(.*)` → `/api/svg/raw?path=/$1` | Behavior matcher `/svg/*` og peker til API Gateway | Samme Lambda-route `GET /api/svg/raw` | Sørger for at historiske `/svg/`-lenker fungerer.【F:vercel.json†L4-L8】 |
| `/figure-library/(...ext)` → `/api/figure-library/raw?path=/$1` | Behavior matcher `/figure-library/*` og sendes til API Gateway | Route `GET /api/figure-library/raw` | Returnerer SVG/PNG/JSON-ressurser fra figurbiblioteket med stier i query.【F:vercel.json†L8-L10】 |
| `/sortering` → `/sortering.html` | Behavior matcher `/sortering` og svarer med `sortering.html` fra S3 | — | CloudFront kan returnere `sortering.html` direkte fra S3 via en custom error/behavior rule.【F:vercel.json†L10-L12】 |
| `/sortering/eksempel:example([0-9]+)/?` → `/index.html` | Behavior matcher `/sortering/eksempel*` og peker til S3 | — | Sender sorterings-eksempelsider til hoved-`index.html` for SPA-routing.【F:vercel.json†L12-L14】 |
| `/sortering/(.*)` → `/sortering.html` | Behavior matcher øvrige `/sortering/*` og peker til S3 | — | Fungerer som fallback til sorteringsappen.【F:vercel.json†L14-L15】 |

For alle behaviors som peker til API Gateway må Origin Request Policy sørge for at `query`-parametere (spesielt `path`) videresendes til Lambda.

### CloudFront-domeneoppsett

I fase 1 kan CloudFront-distribusjonen lanseres med det automatisk genererte `*.cloudfront.net`-domenet. Dette reduserer behovet for ekstra sertifikater og DNS-konfigurasjon mens infrastrukturen etableres. Dersom man senere ønsker et egendefinert domene, må følgende steg gjennomføres:

1. Opprett/forny et offentlig sertifikat i AWS Certificate Manager (ACM) i regionen `us-east-1` for ønsket domene/underdomene.
2. Legg til domenet i CloudFront-distribusjonens Alternate Domain Names (CNAMEs) og knytt det til ACM-sertifikatet.
3. Opprett en Route 53 alias-ressurs-post (A/AAAA) som peker domenet til CloudFront-distribusjonens mål.

## 3. Backend-handlere og Lambda-adapter

Backend-koden er skrevet med Node sitt `req`/`res`-grensesnitt. Eksempelvis bruker `/api/examples/index.js` `res.setHeader`, `res.statusCode`, `res.end` og leser request-body via `req.on('data')`, i tillegg til å sette CORS-headere basert på `req.headers.origin`. For å flytte handleren til Lambda uten større omskriving anbefales en Express-kompatibel adapter som `@vendia/serverless-express`, som oversetter API Gateway-eventer til det samme `req`/`res`-objektet handleren forventer.【F:api/examples/index.js†L1-L121】

Adapteren må bevare:
- `Access-Control-Allow-*`-headere og `OPTIONS`-håndtering.
- `req.url`, `req.method` og `req.headers` slik at query-parametere (`?path=`) og `x-forwarded-proto` fungerer.
- Strømming av request-body (JSON) og bruk av `URL`-klassen for parsing.

Ved å samle alle `/api/*`-endepunkter i et lite Express-program kan samme Lambda-funksjon håndtere flere ruter, noe som forenkler distribusjon og logging.

## 4. Krav til Redis-kompatibelt lagringslag

`api/_lib/examples-store.js` viser at dagens lagring bygger på Redis-lignende operasjoner:

- En prefiksstrategi (`examples:`) med egen index-key (`examples:__paths__`) og papirkurv-key (`examples:__trash__`).【F:api/_lib/examples-store.js†L1-L19】
- Persistens av komplekse verdier via serialisering/deserialisering som støtter `Map`, `Set`, `Date`, `RegExp` osv., hvilket må beholdes når data lagres i MemoryDB/ElastiCache.【F:api/_lib/examples-store.js†L21-L121】
- Operasjoner som `kv.set`, `kv.sadd`, `kv.smembers`, `kv.srem` og `kv.get` for å skrive/lese oppføringer, oppdatere indeks, og vedlikeholde papirkurv. Et Redis-endepunkt må støtte de samme kommandoene for å gi identisk oppførsel.【F:api/_lib/examples-store.js†L424-L479】【F:api/_lib/examples-store.js†L506-L616】

MemoryDB/ElastiCache kan erstatte `@vercel/kv` så lenge Lambda får nettverkstilgang (VPC). Adapterlaget må:
- Initialisere en Redis-klient (f.eks. `ioredis`).
- Mappe `getEntry`, `setEntry`, `deleteEntry`, `listEntries` osv. til Redis-kommandoer.
- Sikre at `MAX_TRASH_ENTRIES` respekteres og at metadatafelt (`storage`, `persistent`, `ephemeral`, `limitation`) fortsatt injiseres i responsen.

## 5. AWS-ressurser og secrets

Fase 1 anbefaler å etablere følgende ressurser i mål-arkitekturen:

- **S3 bucket** for `public/`-artefakter (statisk hosting) og opplastede figurfiler.
- **CloudFront-distribusjon** foran S3 og API Gateway, med behaviors som speiler Vercel-rewritene og forwarder query-parametere (egendefinert DNS er valgfritt utover minimumsoppsettet).
- **API Gateway (HTTP API)** som ruter `/api/*` til en eller flere Lambda-funksjoner med Lambda-proxy-integrasjon.
- **Lambda-funksjon(er)** som kjører Express-adapteren og gjenbruker eksisterende `/api`-logikk.
- **Amazon MemoryDB eller ElastiCache for Redis** som persistent lagring for eksempler/SVG-indekser.

Miljøvariabler og secrets må oppdateres slik at de gamle Vercel KV-verdiene erstattes av Redis-tilkoblingsdetaljer (host, port, passord/TLS) og eventuelle nye konfigurasjonsnøkler (f.eks. `REDIS_ENDPOINT`, `REDIS_PASSWORD`). Frontend-relaterte variabler som `EXAMPLES_ALLOWED_ORIGINS` og `SVG_ALLOWED_ORIGINS` beholdes og injiseres i Lambda/CloudFront-konfigurasjonen.

> Når Redis-stacken er bekreftet i drift, følg avviklingslisten i [`docs/examples-storage.md`](../examples-storage.md#avvikle-den-gamle-vercel-instansen) for å slå av Vercel/Upstash helt. Dokumentet beskriver også hvordan `REDIS_*`-verdiene hentes fra CloudFormation og hvilke skript (`npm run seed-examples`, `scripts/check-examples-api.mjs`) som brukes i den nye workflowen.

## 6. Praktiske CLI-instruksjoner

Følgende AWS CLI-kommandoer og steg dokumenterer hvordan infrastrukturen i fase 1 kan settes opp fra CloudShell. Erstatter du
plassholdere (`<...>`) med konkrete verdier kan resultatet brukes direkte i fase 2 for automatisering.

### CloudShell hurtigkommandoer (må re-eksporteres i hver økt)

CloudShell nullstiller miljøet mellom økter. Eksporter derfor variabler på nytt hver gang, og husk at alle `aws cloudfront`-kall
må kjøres i regionen `us-east-1` (CloudFront er globalt, men API-endepunktet forventer `us-east-1`). Bruk for eksempel:

```bash
export AWS_REGION=eu-west-1          # region for S3, Lambda, API Gateway
export AWS_PAGER=""
export CLOUDFRONT_REGION=us-east-1   # eksplisitt for cloudfront-kommandoene
ACCOUNT_ID=$(aws sts get-caller-identity --query 'Account' --output text)
export ACCOUNT_ID
```

#### S3-sync og OAC-basert bucket-policy

```bash
BUCKET_NAME=<bucket-navn>
aws s3api create-bucket \
  --bucket "$BUCKET_NAME" \
  --create-bucket-configuration LocationConstraint="$AWS_REGION"

aws s3api put-bucket-versioning \
  --bucket "$BUCKET_NAME" \
  --versioning-configuration Status=Enabled

aws s3 sync public/ "s3://$BUCKET_NAME/" --delete
```

Sett `DISTRIBUTION_ID` til en eksisterende distribusjon (eller hopp over til du har opprettet den). Opprett deretter (eller gjenbruk)
en Origin Access Control (OAC) og begrens bucket-policyen til distribusjonen som eier den:

```bash
OAC_ID=$(aws cloudfront create-origin-access-control \
  --origin-access-control-config 'Name=MathVisualsOAC,SigningProtocol=sigv4,SigningBehavior=always,OriginAccessControlOriginType=s3' \
  --region "$CLOUDFRONT_REGION" \
  --query 'OriginAccessControl.Id' --output text)

DISTRIBUTION_ARN="arn:aws:cloudfront::$ACCOUNT_ID:distribution/$DISTRIBUTION_ID"

cat <<'POLICY' > bucket-policy.json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowCloudFrontRead",
      "Effect": "Allow",
      "Principal": {
        "Service": "cloudfront.amazonaws.com"
      },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::<bucket-navn>/*",
      "Condition": {
        "StringEquals": {
          "AWS:SourceArn": "arn:aws:cloudfront::<account-id>:distribution/<distribution-id>"
        }
      }
    }
  ]
}
POLICY

sed -i "s/<bucket-navn>/$BUCKET_NAME/g" bucket-policy.json
sed -i "s|arn:aws:cloudfront::<account-id>:distribution/<distribution-id>|$DISTRIBUTION_ARN|" bucket-policy.json

aws s3api put-bucket-policy --bucket "$BUCKET_NAME" --policy file://bucket-policy.json
```

`AWS:SourceArn` begrenser lesetilgangen til akkurat den CloudFront-distribusjonen du har satt i `DISTRIBUTION_ARN`, slik at andre
distribusjoner (selv med samme OAC) ikke kan hente objekter fra bucketen.

#### Lambda-pakking og API Gateway-variabler

```bash
LAMBDA_ZIP=function.zip
npm install --omit=dev
zip -r "$LAMBDA_ZIP" api/ node_modules/ package.json package-lock.json

aws lambda update-function-code \
  --function-name math-visuals-api \
  --zip-file fileb://"$LAMBDA_ZIP"

export API_NAME=math-visuals-http
API_ID=$(aws apigatewayv2 get-apis --query "Items[?Name=='$API_NAME'].ApiId" --output text)
export API_ID
export API_STAGE=prod
export API_EXEC_ARN="arn:aws:execute-api:$AWS_REGION:<account-id>:$API_ID/*/*/*"

aws lambda add-permission \
  --function-name math-visuals-api \
  --statement-id apigw \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "$API_EXEC_ARN"

aws apigatewayv2 create-stage \
  --api-id "$API_ID" \
  --stage-name "$API_STAGE" \
  --auto-deploy

API_GATEWAY_DOMAIN=$(aws apigatewayv2 get-api --api-id "$API_ID" --query "ApiEndpoint" --output text)
echo "API Gateway URL: $API_GATEWAY_DOMAIN"
```

#### CloudFront-distribusjon (us-east-1)

```bash
# Hent distributions-ID og domenenavn automatisk
aws cloudfront list-distributions \
  --region "$CLOUDFRONT_REGION" \
  > cf-list.json

DISTRIBUTION_ID=$(jq -r ".DistributionList.Items[] | select(.Origins.Items[].DomainName | contains(\"$BUCKET_NAME\")) | .Id" cf-list.json | head -n1)
export DISTRIBUTION_ID
DIST_DOMAIN=$(jq -r ".DistributionList.Items[] | select(.Id==\"$DISTRIBUTION_ID\") | .DomainName" cf-list.json)
echo "CloudFront distribution: $DISTRIBUTION_ID ($DIST_DOMAIN)"

aws cloudfront get-distribution-config \
  --id "$DISTRIBUTION_ID" \
  --region "$CLOUDFRONT_REGION" \
  > cf.json

ETAG=$(jq -r '.ETag' cf.json)
cat cf.json | jq '.DistributionConfig' > cf-config.json

# Rediger cf-config.json manuelt og sett OriginAccessControlId til $OAC_ID før oppdateringen

aws cloudfront update-distribution \
  --id "$DISTRIBUTION_ID" \
  --if-match "$ETAG" \
  --distribution-config file://cf-config.json \
  --region "$CLOUDFRONT_REGION"
```

Hvis distribusjonen mangler, kan du i stedet bruke `aws cloudfront create-distribution` og inkludere `--distribution-config` med
behaviors/origins som beskrevet tidligere.

### MemoryDB eller ElastiCache

```bash
aws memorydb create-subnet-group \
  --subnet-group-name math-visuals-subnets \
  --subnet-ids <subnet-id-1> <subnet-id-2>

aws memorydb create-cluster \
  --cluster-name math-visuals \
  --node-type db.t4g.small \
  --subnet-group-name math-visuals-subnets \
  --security-group-ids <sg-id> \
  --tls-enabled \
  --acl-name open-access

# Alternativt for ElastiCache
aws elasticache create-replication-group \
  --replication-group-id math-visuals \
  --replication-group-description "Math Visuals Redis" \
  --engine redis \
  --cache-node-type cache.t3.small \
  --num-node-groups 1 \
  --replicas-per-node-group 1 \
  --security-group-ids <sg-id> \
  --cache-subnet-group-name <cache-subnet-gruppe>
```

Når klyngen er opprettet, hent `PrimaryEndpoint` (`ConfigurationEndpoint` for MemoryDB) for å fylle secrets/parametere under.

### Secrets Manager og Parameter Store

Legg inn Redis-tilkobling og CORS-opprinnelser slik at Lambda kan hente dem ved oppstart:

```bash
aws secretsmanager create-secret \
  --name math-visuals/redis \
  --secret-string '{"host":"<redis-endpoint>","port":6379,"password":"<passord>"}'

aws ssm put-parameter \
  --name /math-visuals/cors/examples \
  --type StringList \
  --value "https://mathvisuals.no,https://app.mathvisuals.no"

aws ssm put-parameter \
  --name /math-visuals/cors/svg \
  --type StringList \
  --value "https://mathvisuals.no,https://app.mathvisuals.no"
```

Gi Lambda-funksjonen IAM-policyer for å lese `math-visuals/redis` og relevante SSM-parametere. Verdiene kan lastes inn ved hjelp av
`AWS.SecretsManager` og `AWS.SSM` i Lambda-koden eller gjennom miljøvariabler under `aws lambda update-function-configuration`.

---

**Status:** Fase 1 inkluderer nå både målarkitektur og konkrete CLI-instruksjoner som grunnlag for fase 2-automatisering og
implementering.
