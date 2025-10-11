# Math Visuals

Dette repositoriet inneholder statiske verktøy og eksempler for Math Visuals-prosjektet. Verktøyene forventer nå at eksempeltjenesten på `/api/examples` er tilgjengelig i samme opprinnelse.

## Kort forklart: Hvorfor forsvinner eksemplene?

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

Se også [docs/examples-backend-quickstart.md](docs/examples-backend-quickstart.md) for en ekstra kort steg-for-steg-guide.

## Krav til eksempeltjenesten

* Back-end må kjøre når du tester funksjonalitet som lagrer eller henter eksempler.
* Dersom du kjører verktøyene lokalt uten proxy, sett `window.MATH_VISUALS_EXAMPLES_API_URL` til adressen til API-et (for eksempel i Playwright-tester eller i nettleserkonsollen).
* Ved feil vil UI-et vise en statuslinje som forklarer hva som gikk galt. Se [docs/examples-storage.md](docs/examples-storage.md) for detaljer og feilsøking.

## Feilsøking

1. Åpne `/api/examples` i nettleseren for å bekrefte at API-et svarer.
2. Undersøk nettverkspanelet i utviklerverktøyene og se etter blokkerte forespørsler.
3. Kontroller at `EXAMPLES_ALLOWED_ORIGINS` inkluderer opprinnelsen du tester fra.
4. Verifiser at `KV_REST_API_URL` og `KV_REST_API_TOKEN` er satt i miljøet der API-et kjører.

For mer informasjon om lagringsmodellen, se dokumentasjonen i `docs/examples-storage.md`.
