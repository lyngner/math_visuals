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
- **CloudFront-distribusjon** foran S3 og API Gateway, med behaviors som speiler Vercel-rewritene og forwarder query-parametere.
- **API Gateway (HTTP API)** som ruter `/api/*` til en eller flere Lambda-funksjoner med Lambda-proxy-integrasjon.
- **Lambda-funksjon(er)** som kjører Express-adapteren og gjenbruker eksisterende `/api`-logikk.
- **Amazon MemoryDB eller ElastiCache for Redis** som persistent lagring for eksempler/SVG-indekser.

Miljøvariabler og secrets må oppdateres slik at `KV_REST_API_URL`/`KV_REST_API_TOKEN` erstattes av Redis-tilkoblingsdetaljer (host, port, passord/TLS) og eventuelle nye konfigurasjonsnøkler (f.eks. `REDIS_ENDPOINT`, `REDIS_PASSWORD`). Frontend-relaterte variabler som `EXAMPLES_ALLOWED_ORIGINS` og `SVG_ALLOWED_ORIGINS` beholdes og injiseres i Lambda/CloudFront-konfigurasjonen.

## 6. Praktiske CLI-instruksjoner

Følgende AWS CLI-kommandoer og steg dokumenterer hvordan infrastrukturen i fase 1 kan settes opp fra CloudShell. Erstatter du
plassholdere (`<...>`) med konkrete verdier kan resultatet brukes direkte i fase 2 for automatisering.

### S3 bucket for statiske artefakter

```bash
aws s3api create-bucket \
  --bucket <bucket-navn> \
  --create-bucket-configuration LocationConstraint=$(aws configure get region)

aws s3api put-bucket-versioning \
  --bucket <bucket-navn> \
  --versioning-configuration Status=Enabled

aws s3 sync public/ s3://<bucket-navn>/ --delete
```

Opprett en Origin Access Control (OAC) på forhånd, eller gjenbruk eksisterende OAC-ID som referanse i CloudFront-trinnet under.

### CloudFront-distribusjon med eksisterende OAC

1. Hent distributions-ID og nåværende konfigurasjon:

   ```bash
   DISTRIBUTION_ID=<cloudfront-distribution-id>
   aws cloudfront get-distribution-config --id "$DISTRIBUTION_ID" > cf.json
   ```

2. Oppdater `cf.json` manuelt slik at S3-origin peker til `s3://<bucket-navn>` med `OriginAccessControlId=<oac-id>` og legg
   inn behaviors for `/bildearkiv/*`, `/svg/*`, `/figure-library/*`, `/sortering`, `/sortering/*` med riktige origins (API Gateway
   vs. S3) og `CachePolicyId`/`OriginRequestPolicyId` som forwarder query-parametere (`AllViewerExceptHostHeader` + egendefinert
   request-policy som inkluderer `QueryStrings` og `Headers: Origin`).

3. Lagre versjons-taggen fra `ETag`-feltet og oppdater distribusjonen:

   ```bash
   ETAG=$(jq -r '.ETag' cf.json)
   cat cf.json | jq '.DistributionConfig' > cf-config.json
   aws cloudfront update-distribution \
     --id "$DISTRIBUTION_ID" \
     --if-match "$ETAG" \
     --distribution-config file://cf-config.json
   ```

### API Gateway + Lambda

```bash
# Bygg Lambda-pakken lokalt (samme artefakt kan lastes opp med aws lambda update-function-code)
npm install --omit=dev
zip -r function.zip api/ node_modules/ package.json package-lock.json

aws lambda create-function \
  --function-name math-visuals-api \
  --runtime nodejs18.x \
  --handler api/index.handler \
  --role <lambda-execution-role-arn> \
  --timeout 30 \
  --memory-size 1024 \
  --zip-file fileb://function.zip

aws apigatewayv2 create-api \
  --name math-visuals-http \
  --protocol-type HTTP \
  --target arn:aws:lambda:<region>:<account-id>:function:math-visuals-api

API_ID=$(aws apigatewayv2 get-apis --query "Items[?Name=='math-visuals-http'].ApiId" --output text)
aws lambda add-permission \
  --function-name math-visuals-api \
  --statement-id apigw \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn arn:aws:execute-api:<region>:<account-id>:$API_ID/*/*/*

aws apigatewayv2 create-stage \
  --api-id $API_ID \
  --stage-name prod \
  --auto-deploy

API_GATEWAY_DOMAIN=$(aws apigatewayv2 get-api --api-id $API_ID --query "ApiEndpoint" --output text)
echo "API Gateway URL: $API_GATEWAY_DOMAIN"
```

Når du har `API_GATEWAY_DOMAIN`, oppdater CloudFront-behavioren(e) som peker til API Gateway slik at origin host settes til dette
domene-navnet og `OriginPath` samsvarer med valgt stage (`/prod`).

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
