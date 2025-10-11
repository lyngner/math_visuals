# Back-end raskstart (enkle steg)

Denne siden forklarer **enkelt** hva du må gjøre for at eksempler du lager i Math Visuals skal bli lagret.

## 1. Start serveren

* Kjør `npm install` én gang.
* Start deretter både front-end og back-end (for eksempel med `vercel dev` eller den løsningen du allerede bruker).
* Test i nettleseren at siden åpner seg.

Hvis du kjører front-end på en annen port enn API-et, må du sette `window.MATH_VISUALS_EXAMPLES_API_URL` til adressen til API-et (kan gjøres i nettleserkonsollen før du bruker verktøyene).

## 2. Sett innloggingsdetaljene til KV (varig lagring)

1. Finn `KV_REST_API_URL` og `KV_REST_API_TOKEN` i Vercel-prosjektet ditt under **Storage → KV → View Details → REST API**.
2. Legg dem inn som miljøvariabler der back-enden kjører (Production/Preview/Development).
3. Deploy eller start back-enden på nytt slik at variablene blir lest.

Uten disse verdiene bruker API-et et midlertidig minne, og alle eksempler forsvinner når prosessen stopper.

## 3. Sjekk at alt virker

Kjør skriptet vi la til for deg:

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
