# Back-end raskstart (enkle steg)

Denne siden forklarer **enkelt** hva du må gjøre for at eksempler du lager i Math Visuals skal bli lagret.

## 0. Last ned prosjektet lokalt

Alt som ligger på GitHub eller Vercel er på nett. For å kjøre kommandoene må du ha en **lokal kopi** av prosjektet på Mac-en din:

1. Åpne Terminal og velg en mappe der du vil ha prosjektet.
2. Kjør `git clone https://github.com/<ditt-prosjektnavn>/math_visuals.git` (bruk din egen URL hvis prosjektet ligger et annet sted).
3. Gå inn i mappen med `cd math_visuals`.

Hvis du har fått prosjektet via nedlasting fra Vercel/GitHub (zip-fil), pakker du ut zip-filen og går inn i mappen i Terminal. Etter dette kan du følge stegene under.

## 1. Start serveren

* Åpne **Terminal** på Mac (Spotlight → skriv `Terminal`).
* Kjør `npm install` én gang i prosjektmappen (`cd path/til/math_visuals`).
* Start deretter både front-end og back-end. Den vanligste måten er å kjøre `vercel dev` i samme terminal.
  * Bruker du en annen løsning (for eksempel et eget Express-API), starter du den på tilsvarende måte.
* Test i nettleseren at siden åpner seg.

Hvis du kjører front-end på en annen port enn API-et, må du sette `window.MATH_VISUALS_EXAMPLES_API_URL` til adressen til API-et (kan gjøres i nettleserkonsollen før du bruker verktøyene).

## 2. Sett innloggingsdetaljene til KV (varig lagring)

1. Finn `KV_REST_API_URL` og `KV_REST_API_TOKEN` i Vercel-prosjektet ditt under **Storage → KV → View Details → REST API**.
2. Legg dem inn som miljøvariabler der back-enden kjører (Production/Preview/Development).
3. Deploy eller start back-enden på nytt slik at variablene blir lest.

Uten disse verdiene bruker API-et et midlertidig minne, og alle eksempler forsvinner når prosessen stopper.

## 3. Sjekk at alt virker

I **samme Terminal-vindu** (eller et nytt vindu i prosjektmappen) kjører du skriptet vi la til for deg:

```bash
npm run check-examples-api
```

* Du skal se «varig lagring (KV)» i terminalen.
* Hvis du ser «midlertidig minne», mangler KV-variablene fremdeles.
* Hvis det kommer en feil, kjører ikke back-enden eller adressen er feil. Bruk `--url=` for å teste mot riktig host.

## 4. Lagre et eksempel for å teste

1. Åpne et verktøy (for eksempel `https://localhost:3000/arealmodell.html`).
2. Lag et nytt eksempel og lagre det.
3. Last siden på nytt. Eksemplet skal fortsatt være der.
4. Hvis det forsvinner, kjør sjekkskriptet en gang til og se om du fremdeles er i minnemodus.

## Når bør du be om hjelp?

* Du får ikke tak i KV-url/token i Vercel.
* Sjekkskriptet sier at API-et ikke svarer.
* Du har satt variablene, men ser fortsatt «midlertidig minne».

Da kan du dele feilmeldingen fra skriptet eller skjermbilde av miljøvariablene – det gjør det enklere å hjelpe deg videre.
