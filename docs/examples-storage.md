# Eksempel-lagring

Denne siden dokumenterer hvordan `examples.js` samhandler med API-et på `/api/examples` for å lagre og hente brukergenererte eksempler.

## Arkiverte og slettede eksempler

* Når en bruker sletter et eksempel fra et verktøy, flyttes posten til arkivtjenesten (`/api/examples/trash`). Etter sletting viser statuslinjen meldingen «Slettede eksempler ligger i eksempelarkivet. Åpne svg-arkiv.html og trykk «Vis slettede figurer».».
* Eksempelarkivet åpnes via `svg-arkiv.html`. Trykk på knappen **Vis slettede figurer** for å hente listen over slettede elementer. Panelet lar deg gjenopprette, forhåndsvise eller slette oppføringer permanent.
* Siden `/examples-trash.html` finnes fortsatt, men viser kun en veiledning som peker videre til `svg-arkiv.html`. Alle faktiske trash-operasjoner håndteres nå i Eksempelarkiv-siden.

## Persistensstrategi

* Alle eksempler lagres nå i back-end via `/api/examples`. Front-end oppretter, oppdaterer og sletter poster ved å sende `PUT`/`DELETE`-forespørsler med hele datasettet for hvert verktøy.
* Når en side åpnes, henter klienten hele posten fra API-et. Hvis forespørselen lykkes, vises både innebygde og brukerlagrede eksempler direkte fra back-end.
* Hvis Redis-instansen ikke er tilgjengelig eller mangler konfigurasjon (`REDIS_ENDPOINT`, `REDIS_PORT` og `REDIS_PASSWORD`), går API-et over til et minnebasert lager. Responsene merkes med `storage: "memory"`/`mode: "memory"` og klientene viser et varsel om begrenset persistens.
* Når API-et svarer med en feil (f.eks. ekte backend-nedetid), beholder UI-et gjeldende visning og viser en statusmelding. I minnemodus kan UI-et fortsatt lagre midlertidige endringer.

## Figurbibliotek vs. SVG-arkiv

* Eksporter fra verktøyene havner i SVG-arkivet (`/api/svg`). Endepunktet har et rå-visningsgrensesnitt på `/api/svg/raw` og statiske omskrivninger for `/bildearkiv/*`.
* Figurbiblioteket bruker nå en egen lagring (`figureAsset:`-nøkler i Redis/minne) og et dedikert rå-endepunkt på `/api/figure-library/raw`. Klienter genererer forhåndsvisninger via denne URL-en i stedet for `bildearkiv`.
* Eksempelarkivet forholder seg kun til `/api/svg`. Figurbibliotekets metadata (`/api/figure-library`) og media (`/api/figure-library/raw`) påvirker ikke arkivsiden.
* Skriptet `scripts/migrate-figure-library-assets.js` flytter historiske `bibliotek-upload`-oppføringer fra `/api/svg` til den nye lagringen og rydder dem bort fra arkivet. Kjør skriptet med `--dry-run` først for å se hvilke slugs som berøres.
* Endepunktet `/api/svg` filtrerer bort figurbibliotek-resurser ved å se etter `tool`/`toolId` som matcher bibliotekopplasteren, `slug`-verdier som starter med `custom-`, samt metadatafeltene `categoryId`, `category` og `apps`. Disse kjennetegnene brukes av bibliotekklienten og sørger for at biblioteket ikke dukker opp i SVG-arkivet.

## Tilgjengelighet for eksempeltjenesten

Eksempeltjenesten er en del av back-end-distribusjonen og eksponeres som `/api/examples`. Forventninger i den nye modellen:

* Verktøyene må kjøres fra en opprinnelse som kan kontakte API-et. Lokale statiske speil uten proxy eller nedstengt back-end gir ikke lenger en fungerende lagring.
* `window.MATH_VISUALS_EXAMPLES_API_URL` kan settes manuelt for å peke mot et alternativt endepunkt (for eksempel i Playwright-tester eller ved lokal utvikling der API-et kjører på en annen port).
* Hver respons inneholder feltene `examples`, `deletedProvided` og `updatedAt`. Klienten forventer at disse feltene er arrays/ISO-strenger og tilpasser UI-et basert på dem. I tillegg sendes `storage`/`mode` sammen med en `persistent`-/`ephemeral`-indikator som forteller om lagringen er minnebasert. Når API-et kjører i minnemodus, inkluderes også feltet `limitation` med teksten "Denne instansen bruker midlertidig minnelagring. Eksempler tilbakestilles når serveren starter på nytt." for å markere at dataene er flyktige.

## Feilsøking

Når brukere rapporterer at eksempler ikke lagres eller listes opp, bør man sjekke følgende:

1. **API-status** – Gå til `/api/examples` i nettleseren. Får du 200 OK med JSON-innhold? Hvis ikke, må back-end startes eller loggene undersøkes.
2. **CORS og opprinnelse** – Sørg for at `EXAMPLES_ALLOWED_ORIGINS` inkluderer opprinnelsen som laster appen. Feil CORS-konfigurasjon blokkerer forespørslene.
3. **Miljøvariabler for Redis** – API-et krever `REDIS_ENDPOINT`, `REDIS_PORT` og `REDIS_PASSWORD` for vedvarende lagring. Uten disse kjører endepunktet i minnemodus, svarer med 200 OK og markerer responsene med `storage: "memory"`.
4. **Nettverksfeil i konsollen** – Åpne nettleserens utviklerverktøy og se etter blokkerte forespørsler mot `/api/examples`. Feilmeldingen gir som regel beskjed om problemet.

Dersom API-et er nede, vil statuslinjene i verktøyene forklare hva som skjedde og anbefale å kontrollere back-end i stedet for å instruere brukere om å slette lokal lagring.

### Lokalt fungerer, men ikke produksjon

Dette scenarioet betyr vanligvis at produksjonsmiljøet mangler Redis-hemmelighetene selv om du har satt dem lokalt. Slik feilsøker du:

1. Kjør `npm run check-examples-api -- --url=https://<ditt-produksjonsdomene>/api/examples` og se hva skriptet rapporterer.
   * «midlertidig minne» bekrefter at instansen ikke fant `REDIS_*`-konfigurasjonen.
2. I AWS-kontoen: kjør kommandoene under «Automatisert injisering via CloudFormation og Secrets Manager» for å verifisere at parameterne/secrets faktisk har verdier.
3. Kontroller at `infra/shared-parameters.yaml` (eller GitHub Secrets) peker til riktig Parameter Store-navn og Secrets Manager-secret, og redeploy API-stacken (`infra/api/template.yaml`).
4. Se i CloudWatch-loggene til Lambdaen. Manglende `REDIS_*` variabler logges som `Redis KV is not configured` av `kv-client`.
5. Kjør sjekkskriptet på nytt mot produksjonsadressen. Når det viser «varig lagring (kv)», skal eksemplene bestå på domenet ditt akkurat som lokalt.

## Distribusjon og miljøvariabler

Eksempeltjenesten kjører nå i AWS, og alle persistente data går gjennom ElastiCache for Redis. Hver instans (Lambda, lokal `vercel dev`, GitHub Actions osv.) må derfor hente de tre Redis-variablene fra CloudFormation-outputsene og skrive dem videre til Secrets Manager/SSM før den starter. Oversikten under viser hva de betyr og hvor de kommer fra:

| Variabel | Beskrivelse |
| --- | --- |
| `REDIS_ENDPOINT` | Vert/adresse til Redis-klyngen (f.eks. `clustercfg.math-visuals-prod.xxxxxx.memorydb.eu-north-1.amazonaws.com`). Stacken `infra/data/template.yaml` eksponerer navnet på Systems Manager-parameteren via output-en `RedisEndpointParameterName`. |
| `REDIS_PORT` | TCP-porten Redis lytter på. Hentes på samme måte som `REDIS_ENDPOINT`, men via output-en `RedisPortParameterName`. |
| `REDIS_PASSWORD` | Auth-tokenet som ble gitt til ElastiCache/MemoryDB da `infra/data/template.yaml` ble deployet. Output-en `RedisPasswordSecretName` peker på Secrets Manager-secreten som inneholder feltet `authToken`. |
| `EXAMPLES_ALLOWED_ORIGINS` | Kommaseparert liste over opprinnelser som får gjøre cross-origin-kall mot `/api/examples`. Bruk `*` under lokal utvikling eller angi eksakte produksjonsdomener. |
| `SVG_ALLOWED_ORIGINS` | Som over, men for `/api/svg`. Hvis den utelates faller tjenesten tilbake til `EXAMPLES_ALLOWED_ORIGINS`/`ALLOWED_ORIGINS`. |

> **Del aldri hemmelighetene i repoet.** I stedet for å sjekke inn `.env`-filer skal verdiene lagres som GitHub Secrets, Parameter Store-verdier eller Secrets Manager-secrets knyttet til `infra/shared-parameters.yaml`.

### Hente verdiene via CloudFormation, SSM og Secrets Manager

1. Deploy datastrukturen i [`infra/data/template.yaml`](../infra/data/template.yaml). Stacken eksponerer parameter- og secret-navn for Redis via outputsene `RedisEndpointParameterName`, `RedisPortParameterName` og `RedisPasswordSecretName`.
2. Hent navnene (eller la GitHub Actions gjøre det) med `aws cloudformation describe-stacks --stack-name <data-stack> --query 'Stacks[0].Outputs'`.
3. Slå opp verdiene fra Systems Manager/Secrets Manager og eksporter dem til shell-et eller GitHub Secrets. Eksempel:
   ```bash
   REGION="eu-north-1"
   DATA_STACK="math-visuals-data"

   REDIS_ENDPOINT_PARAMETER=$(aws cloudformation describe-stacks \
     --region "$REGION" \
     --stack-name "$DATA_STACK" \
     --query 'Stacks[0].Outputs[?OutputKey==`RedisEndpointParameterName`].OutputValue' \
     --output text)

   REDIS_PORT_PARAMETER=$(aws cloudformation describe-stacks \
     --region "$REGION" \
     --stack-name "$DATA_STACK" \
     --query 'Stacks[0].Outputs[?OutputKey==`RedisPortParameterName`].OutputValue' \
     --output text)

   export REDIS_ENDPOINT=$(aws ssm get-parameter \
     --region "$REGION" \
     --name "$REDIS_ENDPOINT_PARAMETER" \
     --query 'Parameter.Value' \
     --output text)
   export REDIS_PORT=$(aws ssm get-parameter \
     --region "$REGION" \
     --name "$REDIS_PORT_PARAMETER" \
     --query 'Parameter.Value' \
     --output text)

   REDIS_PASSWORD_SECRET=$(aws cloudformation describe-stacks \
     --region "$REGION" \
     --stack-name "$DATA_STACK" \
     --query 'Stacks[0].Outputs[?OutputKey==`RedisPasswordSecretName`].OutputValue' \
     --output text)

   export REDIS_PASSWORD=$(aws secretsmanager get-secret-value \
     --region "$REGION" \
     --secret-id "$REDIS_PASSWORD_SECRET" \
     --query 'SecretString' \
     --output text | jq -r '.authToken')
   ```
   > Tips: `REGION`, `DATA_STACK` og `API_URL` bør stå i anførselstegn slik at copy/paste fungerer selv før du erstatter plassholderne.

   **CloudShell-snarvei:** I stedet for å lime inn blokken manuelt kan du be skriptet [`scripts/cloudshell-check-examples.sh`](../scripts/cloudshell-check-examples.sh) hente verdiene og kjøre `npm run check-examples-api` for deg:

   ```bash
   REGION="eu-west-1" \
   DATA_STACK="math-visuals-data" \
   API_URL="https://<ditt-domene>/api/examples" \
   bash scripts/cloudshell-check-examples.sh
   ```

   Skriptet stopper med en tydelig feilmelding dersom stacken ikke finnes i regionen eller hvis secrets mangler `authToken`-feltet, i stedet for bare å avslutte med «exit».
4. Injiser verdiene i Lambda (via `infra/shared-parameters.yaml`), GitHub Secrets eller lokalt shell, og redeploy API-stacken i [`infra/api/template.yaml`](../infra/api/template.yaml). For lokal utvikling holder det å legge verdiene i `.env.local` og starte `npx vercel dev` på nytt.
5. Workflowen `.github/workflows/deploy-infra.yml` gjør de samme stegene automatisk: den leser outputsene, oppdaterer Secrets Manager/Parameter Store og kjører seeding/vedlikehold med `REDIS_*`-verdiene tilgjengelig.

### Avvikle den gamle Vercel-instansen

Når AWS-stacken er bekreftet i drift bør Vercel-miljøet fjernes for å unngå misvisende klienter og ekstra kostnader:

1. Sett produksjonsdomenet til å peke på CloudFront-distribusjonen i stedet for Vercel og bekreft at `/api/examples` svarer med `mode: "kv"` (som betyr Redis i denne konteksten).
2. Ta et siste eksport av eventuelle resterende elevdata fra Vercel ved å bruke `examples-viewer` eller egne `curl`-kall mot `/api/examples?path=...`.
3. I Vercel-konsollen: fjern Upstash-integrasjonen, slett KV-databasen og fjern prosjektet. Dette sørger for at gamle serverless-URL-er returnerer 404.
4. Oppdater dokumentasjon og varsle teamet om at det ikke finnes en fungerende Vercel-forekomst lenger (det er nå AWS som er kilden).
5. Lukk eventuelle DNS-oppføringer som fortsatt peker til Vercel (`*.vercel.app` eller `*.vercel-storage.com`) slik at trafikk ikke havner der ved en feil.

Alle nye miljøer bør sette `REDIS_*`-hemmelighetene før Lambda-prosessen starter. Uten dem havner API-et i minnemodus, og data går tapt når funksjonen skalerer ned.

## Såing av standardeksempler

Standardeksemplene ligger nå i Redis-instansen som driftes av `infra/data`-stacken. Det betyr at seeding alltid må skje i et miljø som har tilgang til samme hemmeligheter som Lambdaen og bruker API-et i AWS-stacken:

1. Følg fremgangsmåten i avsnittet over for å hente `REDIS_ENDPOINT`, `REDIS_PORT` og `REDIS_PASSWORD` (typisk i AWS CloudShell, GitHub Actions eller et lokalt shell som logger mot AWS CLI).
   Under lokale forsøk kan du eksportere verdiene rett i terminalen eller skrive dem til en midlertidig `.env.local` som **ikke** sjekkes inn.
2. Start API-et (enten via `npm run dev`, `npx vercel dev` eller ved å redeploye Lambdaen) med de samme variablene. Seeding fungerer kun hvis API-et svarer med `mode: "kv"`.
3. Kjør `npm run seed-examples` fra samme miljø. Skriptet verifiserer at `REDIS_*` er satt, sjekker at lagringen svarer med `mode: "kv"` og leser datasettet fra `docs/examples-seed.json` (kan overstyres via `--dataset=sti/fil.json`). Filen er git-ignorert slik at reelle elevdata ikke sjekkes inn. Start med `cp docs/examples-seed.sample.json docs/examples-seed.json` dersom du trenger et utgangspunkt lokalt. Bruk `--dry-run` for å validere datasettet uten å skrive til Redis. Skriptet avslutter med en ikke-null exit-kode hvis en enkelt oppføring eller papirkurven ikke kan skrives, slik at CI/CD stopper ved feil.
4. Fyll datasettet gjennom den nye AWS-stacken – enten ved å bruke `examples-viewer` (som kan eksportere/importere JSON) eller ved å sende `PUT`-kall direkte mot `/api/examples?path=...`. Legg eksporten i `docs/examples-seed.json` (eller oppgi din egen fil via `--dataset`) før du kjører seeding.
5. Verifiser resultatet med `npm run check-examples-api -- --url=https://<ditt-domene>/api/examples`. Responsene skal vise `mode: "kv"`, og `storage` skal være `kv`/`persistent: true`.

> **GitHub Actions:** Workflowen i `.github/workflows/deploy-infra.yml` har egne steg for å hente verdiene fra CloudFormation-outputs, synkronisere dem til Secrets Manager/Parameter Store og kjøre vedlikeholdsskript (inkludert seeding). Bruk den for produksjon slik at prosessen blir deterministisk og reproduserbar.
>
> **Manuell import:** Dersom du må migrere data fra Vercel én gang til, eksporter JSON fra `examples-viewer`, sett `REDIS_*`-verdiene i CloudShell og gjenbruk API-endepunktene (`PUT /api/examples?path=...`) for å skrive datasettene inn i Redis. Unngå å koble gamle KV-nøkler direkte; all ny data skal via AWS-stacken.

Når Redis er fylt i ett miljø, deles data automatisk av alle instanser som peker til samme `REDIS_*`-verdier. Nye miljøer (f.eks. `preview`) må enten peke til den samme klyngen eller kjøre seeding-prosessen over på nytt.

### Datasettformat

Standarddatasettet i repoet er representert gjennom `docs/examples-seed.sample.json`. Den viser hvordan `npm run seed-examples` forventer at en eksport ser ut og består av en JSON-struktur med to nøkler:

- `entries`: Liste over verktøy som skal fylles. Hver oppføring har:
  - `path`: Normalisert `/tool-path` (for eksempel `/diagram`).
  - `examples`: Hele listen av eksempler som skal skrives til Redis. Struktur og felt innad bestemmes av verktøyet, men `description`, `exampleNumber`, `isDefault` og `config` er vanlige.
  - `deletedProvided`: (valgfritt) Liste over eksempler som skal markeres som slettet av systemet.
- `trash`: Liste som brukes av `setTrashEntries` for å speile papirkurven i backenden.

Skriptet forventer at `docs/examples-seed.json` inneholder den reelle eksporten du skal skrive. Filen er ignorert i Git, så kopier sample-filen eller eksporter data fra `examples-viewer` og lagre dem lokalt før du kjører `npm run seed-examples -- --dataset=/sti/til/eksport.json`.

