# Kjøre tester i Codex-miljøet

Dette prosjektet har allerede en testpakke konfigurert gjennom npm-skriptet `npm test`. Skriptet kjører først et tilpasset stil-sjekkverktøy og deretter Playwright sine ende-til-ende-tester.

## Forberedelser
1. Installer avhengigheter:
   ```bash
   npm install
   ```

2. Kjør `npm run materialize-vendor` dersom du jobber i et ferskt miljø. Skriptet kopierer inn tredjepartsressursene under `public/vendor/` slik at Playwright og andre tester finner KaTeX og tilsvarende avhengigheter.

## Kjøre testene
Kjør følgende kommando fra rotmappen til prosjektet:

```bash
npm test
```

Dette vil:
1. Kjøre `npm run materialize-vendor` automatisk via `pretest`-hooken for å sikre at vendor-filene finnes.
2. Kjør `node tests/check-shared-styles.js` for å kontrollere at delte stiler er konsistente.
3. Kjør `playwright test` for å starte Playwright-testene definert i `tests/`-mappen.

> **Tips:** Dersom Playwright ikke er installert i miljøet ennå, vil `npm install`-steget ovenfor ta seg av det.

## Feilsøking
- **Manglende nettleserbinærer:** Playwright kan be deg kjøre `npx playwright install` første gang. Det kan du trygt gjøre i Codex før du lager PR.
- **«Host system is missing dependencies»-feil:** Dersom nettleserstart feiler med denne meldingen må nødvendige systempakker installeres. `npm test` forsøker automatisk å kjøre `npx playwright install-deps` når skriptet kjøres som root (via `scripts/ensure-playwright-deps.js`), men i miljøer uten root-tilgang må kommandoen kjøres manuelt med tilstrekkelige rettigheter.
- **Treg testoppstart:** Playwright starter en lokal HTTP-server under `npm test`. I Codex skjer dette automatisk via testene.

Med dette oppsettet kan du trygt kjøre hele testpakken i Codex før du lager en PR til GitHub.
