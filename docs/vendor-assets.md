# Lokale vendor-ressurser

For å kunne kjøre appen og testene offline speiles tredjepartsbibliotekene vi bruker
fra `node_modules/` til `public/vendor/`. Manifestet i
[`scripts/vendor-manifest.json`](../scripts/vendor-manifest.json) beskriver hvilke filer
som skal kopieres. Hver nøkkel tilsvarer et npm-pakkenavn med følgende egenskaper:

- `source`: relativ sti til katalogen i `node_modules/` hvor filene ligger
- `files`: liste over filer (og eventuelt underkataloger) som skal kopieres. Oppføringer
  kan være strenger eller et objekt `{ "name": "…", "optional": true }` for filer som
  ikke er kritiske.

Kopieringen gjøres av [`npm run materialize-vendor`](../scripts/materialize-vendor.mjs).
Skriptet kjøres automatisk av `prestart`, `pretest` og `preplaywright`, slik at
statisk server og Playwright-testene alltid har nødvendige filer tilgjengelig.

## Oppdatere vendor-filer

1. Installer eller oppdater npm-avhengighetene som leverer filene du trenger.
2. Oppdater `scripts/vendor-manifest.json` med filbanene som skal speiles.
3. Kjør `npm run materialize-vendor` for å kopiere filene til `public/vendor/`.
4. Kjør `npm run materialize-vendor -- --check` for å verifisere at manifestet og filene
   er i synk. Kommandoen feiler dersom filer mangler, er utdatert eller dersom det ligger
   ekstra filer i `public/vendor/`.

`public/vendor/` er ignorert i git og skal ikke committes. CI-kjøret legger inn en
verifisering (`npm run materialize-vendor -- --check`) før testene for å sikre at
manifestet er oppdatert.
