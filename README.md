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

For en komplett «teskje»-guide til lokal kjøring på Mac (inkludert riktig Node-versjon, `npx vercel dev` og hvor du skal kjøre kommandoene), se [docs/local-development-mac.md](docs/local-development-mac.md).

## Krav til eksempeltjenesten

* Back-end må kjøre når du tester funksjonalitet som lagrer eller henter eksempler.
* Dersom du kjører verktøyene lokalt uten proxy, sett `window.MATH_VISUALS_EXAMPLES_API_URL` til adressen til API-et (for eksempel i Playwright-tester eller i nettleserkonsollen).
* Ved feil vil UI-et vise en statuslinje som forklarer hva som gikk galt. Se [docs/examples-storage.md](docs/examples-storage.md) for detaljer og feilsøking.

## Feilsøking

1. Åpne `/api/examples` i nettleseren for å bekrefte at API-et svarer. En tom `entries: []` betyr at KV-tilkoblingen fungerer, men at databasen er tom; etter at du lagrer et eksempel skal du se posten din under `entries`.
2. Undersøk nettverkspanelet i utviklerverktøyene og se etter blokkerte forespørsler.
3. Kontroller at `EXAMPLES_ALLOWED_ORIGINS` inkluderer opprinnelsen du tester fra.
4. Verifiser at `KV_REST_API_URL` og `KV_REST_API_TOKEN` er satt i miljøet der API-et kjører. Husk at Vercel har egne sett med variabler for **Development**, **Preview** og **Production** – legg dem inn i den/de miljøene som skal bruke permanent lagring, og redeployer etterpå.
   * I Vercel sitt webgrensesnitt skal verdiene limes inn **uten** anførselstegn. Hvis du skriver `"https://..."` i stedet for `https://...`, blir hermetegnene en del av verdien og klienten får ikke koblet til.
   * Skal du bruke de samme verdiene lokalt, kobler du CLI-en til prosjektet (`npx vercel login` etterfulgt av `npx vercel link`) og kjører `npx vercel env pull .env.development.local`. Kommandoen henter alle miljøvariabler for valgt miljø og skriver dem til en `.env`-fil som `vercel dev` leser automatisk. Endre eller slett filen når du er ferdig – den er med i `.gitignore` og bør ikke sjekkes inn.
5. Hvis det kun feiler i en distribuert versjon, kjør `npm run check-examples-api -- --url=https://ditt-domene/api/examples` for å bekrefte om back-end rapporterer «midlertidig minne». Det betyr at den kjørende instansen ikke finner KV-nøklene sine.
6. Får du `404` med feilen `FUNCTION_NOT_FOUND`, betyr det at distribusjonen mangler serverless-funksjonen. Sjekk at Vercel-prosjektet ikke er satt opp som «Other» med en statisk *Output Directory* som utelater `api/`, og redeployer uten denne overstyringen.

> **Merk:** Det er bare `KV_REST_API_URL` og `KV_REST_API_TOKEN` som brukes av `/api/examples`. Andre nøkler som `KV_URL`, `REDIS_URL` eller `KV_REST_API_READ_ONLY_TOKEN` kan ignoreres dersom du ikke har andre tjenester som trenger dem – men del aldri de faktiske verdiene i klartekst utenfor sikre miljøvariabler.

For mer informasjon om lagringsmodellen, se dokumentasjonen i `docs/examples-storage.md`.
