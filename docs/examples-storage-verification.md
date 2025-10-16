# Eksempellager-verifisering

Denne filen beskriver hvordan du kan verifisere lagringsmodusen for `/api/examples` i et distribuert miljø.

1. **Bekreft minnelager:**
   - Kjør `npm run check-examples-api -- --url=https://<ditt-domene>/api/examples`.
   - Eller send en GET-forespørsel til `https://<ditt-domene>/api/examples/trash`.
   - Kontroller at responsheaderen `X-Examples-Store-Mode` og JSON-feltet `mode` returnerer `memory`.
2. **Sett KV-variabler:**
   - I Vercel-prosjektet, legg til miljøvariablene `KV_REST_API_URL` og `KV_REST_API_TOKEN` beskrevet i `docs/examples-storage.md`.
   - Distribuer miljøendringene slik at funksjonen får dem ved oppstart.
3. **Bekreft KV-lager:**
   - Kjør `npm run check-examples-api -- --url=https://<ditt-domene>/api/examples` igjen (etter redeploy).
   - GET-forespørsler mot `https://<ditt-domene>/api/examples/trash` skal nå vise `mode`/`storage` som `kv`.
   - Slettede eksempler skal forbli arkivert selv om du oppdaterer siden, ettersom de ligger i KV-lageret.

> **Merk:** Disse trinnene krever tilgang til produksjonsdistribusjonen. I dette repo-miljøet finnes ingen deployet back-end eller tilhørende miljøvariabler, så testene må kjøres mot den faktiske produksjonsdomenet.
