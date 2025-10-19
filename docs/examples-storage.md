# Eksempel-lagring

Denne siden dokumenterer hvordan `examples.js` samhandler med API-et på `/api/examples` for å lagre og hente brukergenererte eksempler.

## Arkiverte og slettede eksempler

* Når en bruker sletter et eksempel fra et verktøy, flyttes posten til arkivtjenesten (`/api/examples/trash`). Etter sletting viser statuslinjen meldingen «Slettede eksempler ligger i arkivet. Åpne svg-arkiv.html og trykk «Vis slettede figurer».».
* Arkivet åpnes via `svg-arkiv.html`. Trykk på knappen **Vis slettede figurer** for å hente listen over slettede elementer. Panelet lar deg gjenopprette, forhåndsvise eller slette oppføringer permanent.
* Siden `/examples-trash.html` finnes fortsatt, men viser kun en veiledning som peker videre til `svg-arkiv.html`. Alle faktiske trash-operasjoner håndteres nå i Arkiv-siden.

## Persistensstrategi

* Alle eksempler lagres nå i back-end via `/api/examples`. Front-end oppretter, oppdaterer og sletter poster ved å sende `PUT`/`DELETE`-forespørsler med hele datasettet for hvert verktøy.
* Når en side åpnes, henter klienten hele posten fra API-et. Hvis forespørselen lykkes, vises både innebygde og brukerlagrede eksempler direkte fra back-end.
* Hvis Vercel KV ikke er tilgjengelig eller mangler konfigurasjon, går API-et over til et minnebasert lager. Responsene merkes med `storage: "memory"`/`mode: "memory"` og klientene viser et varsel om begrenset persistens.
* Når API-et svarer med en feil (f.eks. ekte backend-nedetid), beholder UI-et gjeldende visning og viser en statusmelding. I minnemodus kan UI-et fortsatt lagre midlertidige endringer.

## Tilgjengelighet for eksempeltjenesten

Eksempeltjenesten er en del av back-end-distribusjonen og eksponeres som `/api/examples`. Forventninger i den nye modellen:

* Verktøyene må kjøres fra en opprinnelse som kan kontakte API-et. Lokale statiske speil uten proxy eller nedstengt back-end gir ikke lenger en fungerende lagring.
* `window.MATH_VISUALS_EXAMPLES_API_URL` kan settes manuelt for å peke mot et alternativt endepunkt (for eksempel i Playwright-tester eller ved lokal utvikling der API-et kjører på en annen port).
* Hver respons inneholder feltene `examples`, `deletedProvided` og `updatedAt`. Klienten forventer at disse feltene er arrays/ISO-strenger og tilpasser UI-et basert på dem. I tillegg sendes `storage`/`mode` sammen med en `persistent`-/`ephemeral`-indikator som forteller om lagringen er minnebasert. Når API-et kjører i minnemodus, inkluderes også feltet `limitation` med teksten "Denne instansen bruker midlertidig minnelagring. Eksempler tilbakestilles når serveren starter på nytt." for å markere at dataene er flyktige.

## Feilsøking

Når brukere rapporterer at eksempler ikke lagres eller listes opp, bør man sjekke følgende:

1. **API-status** – Gå til `/api/examples` i nettleseren. Får du 200 OK med JSON-innhold? Hvis ikke, må back-end startes eller loggene undersøkes.
2. **CORS og opprinnelse** – Sørg for at `EXAMPLES_ALLOWED_ORIGINS` inkluderer opprinnelsen som laster appen. Feil CORS-konfigurasjon blokkerer forespørslene.
3. **Miljøvariabler for KV** – API-et krever `KV_REST_API_URL` og `KV_REST_API_TOKEN` for vedvarende lagring. Uten disse kjører endepunktet i minnemodus, svarer med 200 OK og markerer responsene med `storage: "memory"`.
4. **Nettverksfeil i konsollen** – Åpne nettleserens utviklerverktøy og se etter blokkerte forespørsler mot `/api/examples`. Feilmeldingen gir som regel beskjed om problemet.

Dersom API-et er nede, vil statuslinjene i verktøyene forklare hva som skjedde og anbefale å kontrollere back-end i stedet for å instruere brukere om å slette lokal lagring.

### Lokalt fungerer, men ikke produksjon

Dette scenarioet betyr vanligvis at produksjonsmiljøet mangler KV-nøklene, selv om de er satt lokalt. Slik feilsøker du:

1. Kjør `npm run check-examples-api -- --url=https://<ditt-produksjonsdomene>/api/examples` og se hva skriptet rapporterer.
   * «midlertidig minne» bekrefter at instansen ikke fant KV-konfigurasjonen.
2. Logg inn på Vercel og åpne **Settings → Environment Variables** for prosjektet.
3. Kontroller at både `KV_REST_API_URL` og `KV_REST_API_TOKEN` er satt for miljøet som kjører distribusjonen (vanligvis **Production**, men sett dem også for **Preview** om du ønsker vedvarende lagring der).
4. Lagre endringene og redeployer (`vercel --prod` eller via dashbordet). Serverless-funksjonen henter bare miljøvariablene ved oppstart.
5. Kjør sjekkskriptet på nytt mot produksjonsadressen. Når det viser «varig lagring (KV)», skal eksemplene bestå på `https://...` akkurat som lokalt.

## Distribusjon og miljøvariabler

Eksempeltjenesten krever at følgende miljøvariabler er satt i distribusjonsmiljøet:

| Variabel | Beskrivelse |
| --- | --- |
| `KV_REST_API_URL` | Base-URL til Vercel KV REST-API-et. I Vercel-prosjektet: gå til **Storage → KV**, og velg **View Details → REST API**. Hvis du i stedet ser siden «Create a database», klikker du **Create** på «Upstash (Serverless DB)» for å opprette KV-integrasjonen først. |
| `KV_REST_API_TOKEN` | API-tokenet som gir skrivetilgang til KV-instansen. Opprett eller kopier et token fra samme KV-side i Vercel (eventuelt etter at du har opprettet Upstash-integrasjonen som over). |
| `EXAMPLES_ALLOWED_ORIGINS` | Kommaseparert liste over opprinnelser som kan gjøre cross-origin-kall mot `/api/examples`. Bruk `*` for å åpne for alle, eller legg inn konkrete URL-er (f.eks. `https://mathvisuals.no,https://admin.mathvisuals.no`). |
| `SVG_ALLOWED_ORIGINS` | Kommaseparert liste over opprinnelser som kan gjøre cross-origin-kall mot `/api/svg`. Arver fra `ALLOWED_ORIGINS`/`EXAMPLES_ALLOWED_ORIGINS` dersom den ikke er satt. |

> **Hvilke variabler trenger jeg egentlig?**
>
> * API-et leser kun `KV_REST_API_URL` og `KV_REST_API_TOKEN`. Disse to må være satt for hvert Vercel-miljø som skal ha varig lagring (Development, Preview og/eller Production).
> * Variabler som `KV_URL`, `REDIS_URL` eller `KV_REST_API_READ_ONLY_TOKEN` kan også dukke opp i Vercel/Upstash-panelet, men de brukes ikke av `/api/examples`. Det er helt greit å la dem stå tomme dersom du ikke har andre tjenester som trenger dem.
> * Del aldri de faktiske verdiene offentlig eller i Git-commits. Lim dem inn som Environment Variables i Vercel-konsollen eller legg dem i en lokal `.env.local` som er med i `.gitignore`.

> **Merk om Upstash:** Du trenger ikke å opprette en separat Upstash Redis-instans via "Databases"-seksjonen. Det du trenger er Vercel sin KV-integrasjon. I prosjektet ditt: åpne **Storage**. Hvis du allerede har opprettet KV, vises den direkte. Hvis ikke, velger du **Create a database → Upstash (Serverless DB)**. Dette oppretter Vercel KV-instansen, og miljøvariablene over skal peke til den.
>
> **Ikke bruk Blob eller Edge Config:** Disse tjenestene mangler funksjonene vi trenger (atomiske skriver, TTL-er og oppslag via REST med skrivetilgang). Eksempel-API-et forventer en ren KV-backend, så konfigurer miljøvariablene mot den samme **Storage → KV**-instansen og ikke mot Blob Storage eller Edge Config.

### Slik fyller du inn miljøvariablene i Vercel

1. Åpne Vercel-prosjektet som hoster Math Visuals og gå til **Settings → Environment Variables**.
2. Legg til en ny variabel `KV_REST_API_URL` og lim inn verdien fra KV-sidens REST API-panel (ser vanligvis ut som `https://...vercel-storage.com`).
3. Legg til en ny variabel `KV_REST_API_TOKEN`. Bruk et eksisterende token eller klikk «Create Token» på KV-siden for å generere en ny streng. Lim tokenet inn som verdi.
4. (Valgfritt) Opprett `EXAMPLES_ALLOWED_ORIGINS` hvis du vil begrense opprinnelser. Skriv `*` for å tillate alle, eller angi en kommaseparert liste over fullstendige opprinnelser.
5. (Valgfritt) Opprett `SVG_ALLOWED_ORIGINS` for å kontrollere hvilke klienter som kan lagre/hente SVG-er via `/api/svg`. Samme format som over.
6. Lagre endringene og redeployer prosjektet slik at funksjonene (`/api/examples`, `/api/svg`) får tilgang til de nye variablene.

Etter at du har lagret, skal listen under **Environment Variables** vise både `KV_REST_API_URL` og `KV_REST_API_TOKEN` med de miljøene du aktiverte (f.eks. Production, Preview og Development). URL-en skal peke på ditt prosjekt (ser typisk ut som `https://<slug>.vercel-storage.com`), og tokenet er en lang streng med bokstaver og tall. Hvis oversikten ser slik ut, har du konfigurert variablene riktig.

Begge KV-variablene bør være konfigurert før serverless-funksjonen starter for å få vedvarende lagring. Uten dem havner API-et i minnemodus og data går tapt når prosessen avsluttes.

## Såing av standardeksempler

For at back-end skal inneholde de avtalte standardeksemplene må KV-databasen seedes. Skriptet `scripts/seed-examples.mjs` skriver disse postene direkte til Vercel KV og **må derfor bare kjøres når du har satt `KV_REST_API_URL` og `KV_REST_API_TOKEN` til en gyldig instans.**

Kjøring lokalt (merk at dette gjør faktiske KV-skrivinger):

```bash
node scripts/seed-examples.mjs
```

Prosjektet har også en npm-kommando som wrapper skriptet:

```bash
npm run seed-examples
```

Begge variantene forventer at miljøvariablene over (pluss eventuelle proxyer for å treffe KV) er konfigurert. Hvis skriptet mislykkes logges første feil og prosessen avsluttes med en ikke-null exit-kode.
