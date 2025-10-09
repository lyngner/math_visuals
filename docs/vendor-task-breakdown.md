# Vendor-artefakter og materialisering

Dette repoet sjekker ikke inn minifiserte eller tredjepartsbygg fra `node_modules`. I stedet beskriver `scripts/vendor-manifest.json` hvilke filer vi trenger i `public/vendor/`, og vi genererer dem lokalt eller i byggpipelines når det trengs.

Årsaken til at vi **ikke** sjekker inn de ferdigbygde filene er todelt:

1. Minifiserte vendor-filer er store og støyende i Git-historikken, og det er vanskelig å kodegjennomgå diffs av dem.
2. Vi vil unngå at repoet driver med «bit-rot» når upstream oppdaterer filene – manifestet peker alltid på én kildeversjon i `node_modules`.

## Generere filer lokalt

Kjør følgende kommando etter `npm install` når du trenger vendor-filer for lokal testing eller utvikling:

```bash
npm run materialize-vendor
```

Skriptet kopierer filene som er listet opp i manifestet til `public/vendor/`. Valgfrie filer (for eksempel kartfiler som ikke alltid følger med i pakken) logges, men stopper ikke skriptet.

## Verifisere at manifestet er gyldig

I CI brukes en kontrollmodus for å sikre at manifestet fortsatt stemmer, og at vi ikke har sjekket inn genererte artefakter:

```bash
npm run materialize-vendor -- --check
# eller kortversjonen
npm run check:vendor
```

`--check` gjør tre ting:

- Den kjører materialiseringen og bekrefter at alle obligatoriske filer faktisk kan kopieres fra `node_modules`.
- Den verifiserer at `public/vendor/` kun inneholder filene som er definert i manifestet.
- Den feiler hvis `public/vendor/` inneholder sporede filer i Git (det skal kun ligge en `.gitignore` der).

Dersom du kun ønsker å bekrefte at filene finnes uten å gjøre Git-sjekken, kan du bruke `--verify`:

```bash
npm run materialize-vendor -- --verify
```

Denne varianten er nyttig i byggmiljøer (f.eks. Vercel) der Git ikke er tilgjengelig, men vi likevel må forsikre oss om at filene er generert før vi eksporterer statiske ressurser.

## Når bør jeg kjøre skriptet?

- **Lokal utvikling:** Kjør `npm run materialize-vendor` én gang etter `npm install`. Kjør på nytt hvis du oppdaterer `vendor-manifest.json` eller avhengighetene i `package.json`.
- **CI og bygg:** Bruk `--check` i CI for å sikre at manifestet stemmer, og `--verify` i byggsteg som produserer distribuerbare artefakter.

Husk at pull requests **ikke** skal inkludere filer under `public/vendor/` – la skriptet materialisere dem i miljøet som trenger dem.

## Vercel-builds

`package.json` definerer et `vercel-build`-skript som Vercel plukker opp automatisk. Skriptet kjører `npm run materialize-vendor -- --verify`, slik at de genererte filene ligger i `public/vendor/` når Vercel gjør statisk eksport. På den måten publiseres vendor-ressursene uten at vi trenger å sjekke dem inn i Git.
