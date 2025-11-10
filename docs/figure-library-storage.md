# Figurbibliotek-lagring

Denne siden dokumenterer hvordan `/api/figure-library` lagrer figurer, hvilke miljøvariabler som kreves for vedvarende lagring og
hvordan klienter bør tolke API-responsene.

## Lagringsmoduser

* **KV (vedvarende):** Når både `KV_REST_API_URL` og `KV_REST_API_TOKEN` er satt, bruker API-et Vercel KV til å lagre både SVG-da
ta og figurbibliotek-metadata. Responsene markeres med `storage: "kv"`, `mode: "kv"` og `persistent: true`. Headerne `X-Figure-L
ibrary-Store-Mode` og `X-Figure-Library-Storage-Result` settes til `kv`.
* **Minnemodus:** Uten KV-variablene faller API-et tilbake til et delt in-memory-lager. Responsene inneholder `storage: "memory"
`, `ephemeral: true` og feltet `limitation` med teksten «Denne instansen bruker midlertidig minnelagring. Figurer tilbakestilles 
når serveren starter på nytt.». Headerne rapporterer `memory`.
* **KV-feil:** Hvis KV er konfigurert, men kallet mot Vercel feiler, svarer API-et med `502` og samme metadatafelt slik at UI kan v
ise en feilmelding, samtidig som lagrede data fortsatt hentes fra minnet dersom de finnes.

## Miljøvariabler

| Variabel | Effekt |
| --- | --- |
| `KV_REST_API_URL` | Base-URL for Vercel KV REST-API. Må settes for at `/api/figure-library` skal bruke vedvarende lagring. |
| `KV_REST_API_TOKEN` | Skrivetoken for KV. Kreves sammen med URL-en over. |
| `FIGURE_LIBRARY_ALLOWED_ORIGINS` | Kommaseparert liste over opprinnelser som får CORS-tilgang. Faller tilbake til `SVG_ALLOWED_ORIGINS`, `ALLOWED_ORIGINS` eller `EXAMPLES_ALLOWED_ORIGINS` hvis den ikke er satt. Bruk `*` for å tillate alle opprinnelser under lokal utvikling. |

> **Tips:** Sett både URL og token for alle miljøer (Preview, Production, eventuelt Development) du vil at biblioteket skal huske 
opplastinger i. Uten disse verdiene er biblioteket nytt ved hver serverstart.

## API-kontrakt

`/api/figure-library` aksepterer og returnerer JSON. Alle responser inneholder metadata om lagringsmodus (`storage`, `mode`, `persi
stent`, `ephemeral`, `limitation`) i tillegg til selve dataene.

### `GET /api/figure-library`

* Uten query-parametere returnerer den hele biblioteket:
  ```json
  {
    "entries": [
      {
        "slug": "custom/figur",
        "title": "Tilpasset figur",
        "svg": "<svg …>",
        "png": "data:image/png;base64,…",
        "pngWidth": 120,
        "pngHeight": 90,
        "tags": ["geometri"],
        "category": {
          "id": "geometri",
          "label": "Geometri"
        }
      }
    ],
    "categories": [
      {
        "id": "geometri",
        "label": "Geometri",
        "figureSlugs": ["custom/figur"]
      }
    ],
    "storage": "kv",
    "persistent": true
  }
  ```
* Med `?slug=...` returnerer API-et én enkelt figur (404 dersom den ikke finnes).

### `POST /api/figure-library`

Oppretter en ny figur. Krav:

* `slug` – streng som identifiserer figuren. Normaliseres (små bokstaver, fjerner `.svg`/`.png`).
* `svg` – gyldig SVG-markup.
* `png` – data-URL (`data:image/png;base64,…`). Både streng og objekt `{ dataUrl, width, height }` støttes.
* `title`, `tool`, `summary`, `tags` og `category` er valgfrie, men brukes til å bygge bibliotekvisningen.

Responsen inneholder `entry` (det lagrede objektet), oppdatert `categories`-liste og lagringsmetadata.

### `PATCH /api/figure-library`

Oppdaterer en eksisterende figur. Bruk `slug` for å identifisere posten. Felter som sendes blir oppdatert – `png` kan utelates ved
 metadataendringer. Hvis `category` eller `categoryId` endres, flyttes figuren automatisk mellom kategorier.

### `DELETE /api/figure-library`

Sletter en figur. Du kan sende `slug` som query-parameter eller i JSON-body. Svaret inneholder `deleted.slug` samt en oppdatert k
ategoriliste.

## Fallback og klientatferd

* UI-et (`bibliotek.js`) leser `storage`/`mode` og viser en tydelig advarsel basert på `limitation` når data er flyktige.
* Headerne `X-Figure-Library-Store-Mode` og `X-Figure-Library-Storage-Result` gjør det enkelt å logge hvilken modus instansen kj
ører i (f.eks. i Vercel-loggene).
* Når kategorier endres via API-et (oppretting, oppdatering eller sletting), sørger back-end for at figurene oppdateres. Klienter
 trenger ikke å håndtere referanseoppdatering manuelt – det holder å refreshe listen.
* Minnemodus deler tilstand på tvers av alle forespørsler i samme prosess. Når serverless-funksjonen skalerer til null eller rede
ployes, startes denne tilstanden på nytt. Sørg derfor for å aktivere KV i miljøer hvor du forventer at opplastinger skal bevares.

## Lokal testing

Playwright-testene `tests/figure-library-api.spec.js` og `tests/figure-library-ui.spec.js` dekker begge modusene. De bruker en inj
isert KV-klient (`tests/helpers/kv-mock.js`) for å simulere Vercel KV og et in-memory-fallbakkscenario. Kjør `npx playwright test
tests/figure-library-api.spec.js tests/figure-library-ui.spec.js` for å verifisere at både back-end og UI fungerer med den ønskede
lagringskonfigurasjonen.

## Populere lagringen med standardfigurer

Skriptet `scripts/seed-figure-library.mjs` leser manifestene fra `figure-library/all.js` og pakkene i `packages/figures` og oppretter kategorier og figurer i lagringen.

* For å se hva som ville blitt skrevet uten å gjøre endringer: `node scripts/seed-figure-library.mjs --dry-run`.
* For å fylle den delte minnelagringen lokalt holder det å kjøre `node scripts/seed-figure-library.mjs` (uten KV-variabler).
* For å skrive direkte til Vercel KV setter du `KV_REST_API_URL` og `KV_REST_API_TOKEN` i samme shell før skriptet kjøres, f.eks. `KV_REST_API_URL=… KV_REST_API_TOKEN=… node scripts/seed-figure-library.mjs`.

Skriptet logger hver kategori og figur som behandles, og gir en oppsummering på slutten. Alle figurer får SVG-data fra repoet, og PNG-data inkluderes automatisk dersom tilsvarende filer finnes.
