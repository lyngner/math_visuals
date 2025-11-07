# Math Visuals

Math Visuals er en samling digitale matematikklaboratorier utviklet for klasserom. Prosjektet springer ut av behovet for fleksible, visuelt rike representasjoner som kan tilpasses ulike undervisningssituasjoner uten å være bundet til én bestemt plattform. Repositoriet samler både selve appene og støttebibliotekene som trengs for å bygge, dele og videreutvikle disse ressursene.

## Visjon og designprinsipper

* **Tilgjengelighet og universell utforming.** Appene skal fungere med tastatur, skjermleser og høy kontrast, og alternative tekstbeskrivelser genereres automatisk der det er mulig.
* **Åpen og modulær arkitektur.** Hver modul kan brukes alene eller kombineres med andre i samme økosystem, noe som gjør det enkelt å plukke og tilpasse elementer til ulike læringsplattformer.
* **Utforskende matematikk.** Visualiseringene er bygget for å støtte samtale, hypotesetesting og resonnering heller enn forhåndsdefinerte løypeplaner.

## Arkitektur

### Statiske apper

De fleste ressursene er statiske HTML/JS/CSS-applikasjoner i rotmappen. Felles komponenter ligger i `base.css`, `router.js`, `description-renderer.js` og `vendor/`, slik at hvert verktøy kan rendres både direkte i nettleseren og som innebygde komponenter i læringsplattformer.

### Delte pakker

Mapper under `packages/` inneholder gjenbrukbare moduler som distribueres som både ESM og CommonJS via Rollup. Dokumentasjonen i [`docs/shared-packages.md`](docs/shared-packages.md) beskriver hvordan disse modulene organiseres, og hvordan de er tenkt brukt i og utenfor prosjektet.

### Serverløse funksjoner

`api/`-mappen rommer Vercel Functions som håndterer datalagring, generering av dynamiske SVG-er, alternativ tekst og tilpasset konfigurasjon. `api/examples` er kjernen for lagrede elevprodukter og deler en lagringsmodell beskrevet i [`docs/examples-storage.md`](docs/examples-storage.md). Øvrige endepunkter forsyner appene med analyser, beskrivelser og eksportmuligheter.

## Domenespesifikke verktøy

Appene er gruppert etter matematiske hovedområder, men kan fint brukes på tvers av temaer:

* **Tallforståelse og aritmetikk** – Brøkpizza, Brøkfigurer, Brøkvegg, Figurtall, Kvikkbilder, Tenkeblokker, Tallinje, Perlesnor, Kuler, Prikk til prikk og Sortering dekker representasjoner av brøk, strukturering av tall, kombinatorikk og klassifisering.
* **Geometri, måling og visualisering** – Graftegner, nKant, Diagram, Arealmodell-serien, Trefigurer, Fortegnsskjema, Måling og SVG-arkiv utforsker koordinatsystemer, regulære figurer, datasett, flateinnhold, romgeometri og funksjonsanalyse.
* **Støtteverktøy** – Bibliotek, Settings, Alt-tekst UI, Trash archive viewer og Examples viewer gir administrativ oversikt, styring av brukerprofiler og direkte innsikt i lagrede datasett.

Flere apper har historiske eller eksperimentelle varianter som bevares side om side med hovedversjonen for å dokumentere utviklingsløp og alternative arbeidsmåter.

## Dataflyt og lagring

Eksempeltjenesten er navet som binder appene sammen. Den gjør det mulig å lagre elevprodukter, hente dem opp igjen og eksportere dem som JSON eller SVG. Når miljøvariablene `KV_REST_API_URL` og `KV_REST_API_TOKEN` er satt, brukes Vercel KV som varig lagring; uten disse nøklene faller tjenesten tilbake til et midlertidig minne som er egnet for lokale prototyper. Flere funksjoner (for eksempel `api/diagram-alt-text.js` og `api/figurtall-alt-text.js`) bygger videre på de lagrede dataene for å gjøre materialet tilgjengelig i universelle utformingskontekster.

## Teknologivalg

* **Frontend:** Vanilla HTML, CSS og JavaScript supplert med JSXGraph, MathLive og skreddersydde UI-komponenter.
* **Bygg og deling:** Rollup for pakkene i `packages/`, `npm`-skript for utvikleropplevelsen og Vercel for distribusjon av både statiske filer og serverløse funksjoner.
* **Testing og kvalitet:** Playwright-scenarier og interne verktøy i `scripts/` sikrer at appene leverer konsistent oppførsel og at API-kontraktene opprettholdes.
## Videre arbeid

Math Visuals videreutvikles i tett dialog med lærere, elever og spesialpedagoger. Nye konsepter prototypers ofte i dedikerte mapper (`old_projects/`, `kvikkbilder`, `tallinje` m.fl.) før de flyttes inn i hovedkatalogen. Prosjektet søker å balansere eksperimentell utforskning med robuste, dokumenterte verktøy, og inviterer til samskaping gjennom issues, pull requests og deling av undervisningsopplegg.
