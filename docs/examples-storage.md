# Eksempel-lagring

Denne siden dokumenterer hvordan `examples.js` håndterer lagring av brukergenererte eksempler.

## Persistensstrategi

* Når nettleseren har tilgang til `localStorage`, brukes dette som primær lagring frem til eksempeltjenesten på `/api/examples` har svart minst én gang.
* Etter en vellykket respons fra back-end kalles `markBackendAvailable()` som igjen bruker `applyPersistentStoragePreference(true)` til å tvangsstyre `safeSetItem`/`safeGetItem` over i et rent minnelager. Dermed lagres ikke nye eksempler i `localStorage` når back-end er oppe (se `examples.js`).
* Hvis synkronisering mot back-end feiler (for eksempel ved nettverksbrudd eller nedetid), kalles `markBackendUnavailable()`. Denne funksjonen gjenaktiverer `localStorage`, kopierer minnebufferen tilbake slik at eksisterende eksempler overlever en sideoppdatering, og lar klienten fortsette i offline-modus til back-end er tilbake.
* Uavhengig av lokal lagring synkroniseres dataene til back-end ved hvert bruker-initiert kall til `store()`, som via `notifyBackendChange()` setter i gang en `fetch`-forespørsel (`PUT`/`DELETE`) mot API-et.

## Tilgjengelighet for eksempeltjenesten

Eksempeltjenesten er en del av back-end-distribusjonen og blir vanligvis eksponert som `/api/examples`. Koden i `resolveExamplesApiBase()` forsøker å bruke den kun når miljøet har en kjent HTTP(S)-opprinnelse eller når `window.MATH_VISUALS_EXAMPLES_API_URL` er satt manuelt. Hvis verktøyene kjøres lokalt rett fra filsystemet (`file://`), via et enkelt statisk filoppsett uten proxy til API-et, i en test med nettverk blokkert – eller back-end rett og slett er nede – får skriptet ikke kontakt og kan verken annonsere at tjenesten er tilgjengelig eller synkronisere.

Disse scenariene er grunnen til at vi fortsatt beholder støtte for nettleserens `localStorage` (eller minnebasert reserve):

* **Offline- og utviklingsmodus** – lærere og utviklere kjører ofte appene lokalt uten å starte back-end. Uten en klient-sidebuffer ville lagring av eksempler feile umiddelbart.
* **Robusthet ved nedetid** – dersom back-end midlertidig er utilgjengelig, sikrer lokal lagring at eksempler ikke mistes før synkronisering lykkes senere.
* **Sandkassemiljøer** – enkelte læringsplattformer kjører verktøyet i en streng iframe der nettverkstilgang er begrenset. Da er lokal lagring den eneste vedvarende mekanismen vi kan kontrollere.

Når back-end igjen blir tilgjengelig, fortsetter `performBackendSync()` å forsøke synkronisering. Når den lykkes, kalles `markBackendAvailable()` slik at nye endringer igjen kun havner i minnet mens serveren holder den vedvarende kopien. Den lokale bufferen beholdes i bakgrunnen og aktiveres automatisk dersom back-end faller fra senere.

## Konsekvens

Etter endringen i commit `89ee1e2` lagres eksempler fortsatt kun midlertidig i minnet på klienten når back-end er oppe; den vedvarende kopien ligger i back-end databasen. Dersom back-end ikke svarer, gjenaktiveres nettleserlagringen automatisk slik at brukeren ikke mister endringene før synkronisering er mulig igjen.
