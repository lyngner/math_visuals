# Vendor-oppgaver

Denne prosessen sørger for at tredjepartsbibliotek som KaTeX blir kopiert fra `node_modules/` og inn i `public/vendor/` når de trengs i produksjon.

## Generere vendor-artefakter

Kjør følgende når du trenger at statiske ressurser er tilgjengelige lokalt (f.eks. for `npm start`, Playwright eller et manuelt build):

```bash
npm run materialize-vendor
```

Skriptet leser `scripts/vendor-manifest.json` og kopierer hver fil inn til `public/vendor/<pakkenavn>/`. Resultatet git-ignores automatisk av `public/vendor/.gitignore`, så Codex og pull requests skal **ikke** sjekke inn de minifiserte filene. Grunnen er at de allerede finnes i `node_modules/`, og vi unngår både lisensduplikater og store, støyende diffs i PR-er.

## Verifisere at repoet er oppdatert

Når du har kjørt kommandoen én gang, kan du senere sjekke om manifestet fremdeles er i synk med
`public/vendor/` uten å skrive til disk:

```bash
npm run materialize-vendor -- --check
```

Dette er en «dry run» som feiler hvis noen av filene må regenereres. Dersom du ønsker å bekrefte at nødvendige filer faktisk finnes (f.eks. før deploy) kan du kjøre:

```bash
npm run materialize-vendor -- --verify
```

Verifiseringsmodusen gjør ingen kopiering, men den feiler hvis en obligatorisk fil mangler i `public/vendor/`.

## I CI

GitHub Actions kjører både `npm run materialize-vendor` og den ovennevnte sjekken for å fange opp utestående oppdateringer. På den måten sikrer vi at `scripts/vendor-manifest.json` er gyldig og at ingen genererte artefakter havner i Git diffen.

## Før deploy

Vercel (og andre build-pipelines) kjører `npm run build`, som igjen materialiserer vendor-filer. Dermed blir `public/vendor/` fylt opp før statiske filer eksporteres og de genererte ressursene blir tilgjengelige i deploy-mappen.
