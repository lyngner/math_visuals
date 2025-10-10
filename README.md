# Math Visuals

Dette repositoriet inneholder statiske verktøy og eksempler for Math Visuals-prosjektet. Verktøyene forventer nå at eksempeltjenesten på `/api/examples` er tilgjengelig i samme opprinnelse.

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
