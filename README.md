# Math Visuals

Dette repositoriet inneholder statiske verktøy og eksempler for Math Visuals-prosjektet. Verktøyene forventer nå at eksempeltjenesten på `/api/examples` er tilgjengelig i samme opprinnelse.

## Om prosjektet

Math Visuals samler nettbaserte undervisningsressurser som lar elever og lærere utforske matematikk visuelt. Hver app er en statisk HTML/JS-side som kan kjøres direkte fra dette repositoriet, hostes på Vercel eller legges inn i andre læringsplattformer. Mange av verktøyene kan lagre delte eksempler via `api/examples`, mens andre fungerer helt uten backend.

Koden er organisert per verktøy (én HTML-fil med tilhørende JavaScript/CSS), i tillegg til felles komponenter som `base.css`, `router.js` og støttebibliotek i `vendor/`. Dokumentasjon og driftsnotater ligger i `docs/`.

## Verktøy og apper

| Verktøy | Beskrivelse |
| --- | --- |
| [Graftegner](graftegner.html) | JSXGraph-basert graftegnebrett for funksjoner, punkter og konstruksjoner på koordinatsystemet. |
| [nKant](nkant.html) | Generator for regulære polygoner, buer og målinger i én SVG som kan eksporteres til oppgavesett. |
| [Diagram](diagram/index.html) | Lager stolpe-, linje-, sektor- og gruppediagram med støtte for fasit, oppgavetekst og UU-vennlige visninger. |
| [Brøkpizza](brøkpizza.html) | Interaktive brøksirkler («pizzaer») der du justerer teller, nevner og sammensetning for å sammenligne brøker. |
| [Brøkfigurer](brøkfigurer.html) | Bygg egne brøkrepresentasjoner med rutenett og sektorer, fargelag og alternative visninger. |
| [Figurtall](figurtall.html) | Konfigurerer mønstre av ruter og rader for å illustrere figurtall og generelle mønstre. |
| [Tenkeblokker](tenkeblokker.html) | Bar-modell-verktøy for å sette opp tenkeblokker med rader, kolonner, tallinjer og tilhørende oppgavetekster. |
| [Arealmodell](arealmodell.html) | Dynamisk arealmodell for multiplikasjon og prosent, med varianter tilpasset ulike elevnivå. |
| [Tallinje](tallinje.html) | Tilpassbar tallinje med piler, intervaller, brikker og dra-og-slipp-objekter. |
| [Perlesnor](perlesnor.html) | Visualiserer en perlesnor med flyttbare klyper, markeringer og tekstbeskrivelser. |
| [Kuler](kuler.html) | Skaper tellekuler i skål og på perlesnor for å illustrere grupper, tiere og enere. |
| [Kvikkbilder](kvikkbilder.html) | Lager raske mønstre (ti-rammer, rektangler og «monster»-mønstre) for subitisering og hoderegning. |
| [3D-figurer](trefigurer.html) | Tegner og beskriver tredimensjonale figurer som prismer, sylindre, kjegler, kuler og pyramider. |
| [Brøkvegg](brøkvegg.html) | Bygger en brøkvegg med flere rader og alternative visninger for å sammenligne likeverdige brøker. |
| [Prikk til prikk](prikktilprikk.html) | (Beta) Genererer prikk-til-prikk-oppgaver med tilpassbare rutenett, tall og fasit. |
| [Fortegnsskjema](fortegnsskjema.html) | (Beta) Setter opp fortegnsskjema med intervaller, nullpunkter og symboler for funksjonsanalyse. |
| [SVG-arkiv](svg-arkiv.html) | Viser lagrede, arkiverte og slettede figurer fra eksempeltjenesten, med snarvei tilbake til originalverktøyet. |

Andre mapper rommer tilleggsmateriell (for eksempel `kvikkbilder-monster.html`, `arealmodell0.html`, `arealmodellen1.html`) og støtteverktøy som [trash-archive-viewer](trash-archive-viewer.js) og [alt-text-ui](alt-text-ui.js).

## Eksempeltjenesten

### Kort forklart: Hvorfor forsvinner eksemplene?

* Når back-end mangler tilgang til Vercel KV (miljøvariablene `KV_REST_API_URL` og `KV_REST_API_TOKEN`), bruker den et **midlertidig minne**.
* I minnemodus ser alt ut til å virke mens serveren kjører, men data slettes hver gang serveren starter på nytt.
* Løsningen er å sette de to KV-variablene i miljøet der back-enden kjører (se [docs/examples-storage.md](docs/examples-storage.md)).

### Slik sjekker du statusen på 1–2–3

1. Åpne en terminal i prosjektmappen.
2. Kjør `npm run check-examples-api`. (Bruk `--url=https://din-side/api/examples` hvis serveren kjører et annet sted.)
3. Les meldingen:
   * «varig lagring (KV)» betyr at lagringen er riktig konfigurert.
   * «midlertidig minne» betyr at eksemplene bare lever til neste omstart.

Skriptet finnes i `scripts/check-examples-api.mjs` og kan også vise hvor mange eksempler som ligger lagret. Hvis API-et ikke svarer i det hele tatt får du en klar feilmelding som peker på at back-enden ikke kjører eller er utilgjengelig.

For en komplett «teskje»-guide til lokal kjøring på Mac (inkludert riktig Node-versjon, `npx vercel dev` og hvor du skal kjøre kommandoene), se [docs/local-development-mac.md](docs/local-development-mac.md).

### Krav til eksempeltjenesten

* Back-end må kjøre når du tester funksjonalitet som lagrer eller henter eksempler.
* Dersom du kjører verktøyene lokalt uten proxy, sett `window.MATH_VISUALS_EXAMPLES_API_URL` til adressen til API-et (for eksempel i Playwright-tester eller i nettleserkonsollen).
* Ved feil vil UI-et vise en statuslinje som forklarer hva som gikk galt. Se [docs/examples-storage.md](docs/examples-storage.md) for detaljer og feilsøking.

### Feilsøking

1. Åpne `/api/examples` i nettleseren for å bekrefte at API-et svarer.
2. Hvis Vercel returnerer `FUNCTION_NOT_FOUND`, er prosjektet distribuert som ren statisk hosting. Fjern eventuell manuelt satt «Output Directory»/override slik at `api/`-mappen tas med, og redeployer med serverless-funksjoner aktivert.
3. Undersøk nettverkspanelet i utviklerverktøyene og se etter blokkerte forespørsler.
4. Kontroller at `EXAMPLES_ALLOWED_ORIGINS` (og eventuelt `SVG_ALLOWED_ORIGINS`) inkluderer opprinnelsen du tester fra.
5. Verifiser at `KV_REST_API_URL` og `KV_REST_API_TOKEN` er satt i miljøet der API-et kjører. Husk at Vercel har egne sett med variabler for **Development**, **Preview** og **Production** – legg dem inn i den/de miljøene som skal bruke permanent lagring, og redeployer etterpå.
6. Hvis det kun feiler i en distribuert versjon, kjør `npm run check-examples-api -- --url=https://ditt-domene/api/examples` for å bekrefte om back-end rapporterer «midlertidig minne». Det betyr at den kjørende instansen ikke finner KV-nøklene sine.

> **Merk:** Det er bare `KV_REST_API_URL` og `KV_REST_API_TOKEN` som brukes av `/api/examples`. Andre nøkler som `KV_URL`, `REDIS_URL` eller `KV_REST_API_READ_ONLY_TOKEN` kan ignoreres dersom du ikke har andre tjenester som trenger dem – men del aldri de faktiske verdiene i klartekst utenfor sikre miljøvariabler.

For mer informasjon om lagringsmodellen, se dokumentasjonen i `docs/examples-storage.md`.

## Tester før utrulling

Kjør følgende tester før du distribuerer endringer til produksjon:

1. `npx playwright test tests/examples-api-entries.spec.js`
   * Som standard bruker testen Playwright-konfigurasjonens `baseURL` (`http://127.0.0.1:4173`) og starter en lokal `http-server` automatisk.
   * Testen feiler hvis en side returnerer 404, mangler `STATE/CFG/CONFIG/SIMPLE`-bindingene eller loggfører JavaScript-feil i konsollen.
   * For å kjøre mot produksjon må du eksplisitt sette både `EXAMPLES_API_ENABLE_PRODUCTION=1` og `EXAMPLES_API_BASE_URL=https://math-visuals.vercel.app/` (eventuelt `EXAMPLES_BASE_URL` dersom HTML-en serveres fra en annen opprinnelse). Uten disse variablene hoppes produksjonsløpet over.

### Tips for lokale Playwright-tester

På Linux-miljøer må Playwright ha en del systembiblioteker tilgjengelig for å starte Chromium/Firefox/WebKit. Kjør `npx playwright install-deps` én gang etter `npm install` for å installere dem automatisk. Deretter kan du kjøre

```
npm run pretest
npm test
```

`npm run pretest` materialiserer vendortillegg og sjekker at Playwright-avhengighetene er installert før selve testene kjøres.

I CI kan du gjenbruke den samme kommandoen. Sett `EXAMPLES_API_BASE_URL` og `EXAMPLES_API_ENABLE_PRODUCTION=1` i byggmiljøet for å validere mot produksjon; hvis API-et ikke svarer vil testen avbrytes med `test.skip` i stedet for å krasje.
