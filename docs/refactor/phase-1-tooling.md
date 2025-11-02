# Phase 1 – Tooling and shared packages

Denne fasen etablerer et arbeidsområde for delt kode og en konsistent prosess for å bygge pakkene som gradvis erstatter legacy-filene.

## Struktur

- `packages/*/src` inneholder kildekoden som skrives i moduler (ESM).
- `packages/*/dist` inneholder bundlet utdata som kan brukes av legacy-sidene.
- Hver pakke definerer `exports`, `main` (CJS) og `module` (ESM) i `package.json` slik at både nye og gamle konsumenter får korrekt inngangspunkt.

## Byggeverktøy

Rollup er konfigurert via `rollup.config.mjs` til å finne alle mapper i `packages/` som har en `src/index.js` og bygge to utgaver:

- `dist/index.mjs` – ES-modul med sourcemap
- `dist/index.cjs` – CommonJS-modul med sourcemap

Kommandoer tilgjengelig i rotens `package.json`:

- `npm run build` – én engangskjøring som bygger alle pakker.
- `npm run build:watch` – holder Rollup i watch-modus og rebuilder når filer endres.

## Konsumering i legacy-kode

Legacy-filene forventer fortsatt å kunne hente forhåndsbundlede vendor-filer. Etter at pakkene er bygget må utdata materialiseres via eksisterende script:

1. `npm run build`
2. `npm run materialize-vendor`

`scripts/materialize-vendor.mjs` leser bundlene i `packages/**/dist` og publiserer dem til `vendor/` slik at dagens byggløp og statiske HTML-filer kan fortsette å konsumere samme inngangspunkt. `npm run verify-vendor` kan brukes i CI for å sikre at `vendor/`-artefaktene er oppdaterte.

## Videre arbeid

Når nye pakker etableres skal de legges under `packages/` og følge samme konvensjoner. Legacy-sider kan etter hvert importere fra `vendor/`-versjonene til migrasjonen er ferdig.
