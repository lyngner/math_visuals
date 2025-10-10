# Eksempel-lagring

Denne siden dokumenterer hvordan `examples.js` samhandler med API-et på `/api/examples` for å lagre og hente brukergenererte eksempler.

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

## Distribusjon og miljøvariabler

Eksempeltjenesten krever at følgende miljøvariabler er satt i distribusjonsmiljøet:

| Variabel | Beskrivelse |
| --- | --- |
| `KV_REST_API_URL` | Base-URL til Vercel KV REST-API-et. |
| `KV_REST_API_TOKEN` | API-tokenet som gir skrivetilgang til KV-instansen. |
| `EXAMPLES_ALLOWED_ORIGINS` | Kommaseparert liste over opprinnelser som kan gjøre cross-origin-kall mot `/api/examples`. Bruk `*` for å åpne for alle. |

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
