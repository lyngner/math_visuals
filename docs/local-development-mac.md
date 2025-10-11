# Lokal utvikling på Mac (steg for steg)

Denne siden er en **enkel veiledning** for å kjøre Math Visuals lokalt og sjekke at eksemplene faktisk lagres. Følg punktene i rekkefølge.

## 0. Sørg for riktig Node- og npm-versjon

`@cortex-js/compute-engine` krever minst **Node 21.7.3** og **npm 10.5.0**. Hvis du ser advarsler om «Unsupported engine», bør du oppdatere.

1. Installer [nvm](https://github.com/nvm-sh/nvm#installing-and-updating) hvis du ikke allerede har det.
2. Åpne Terminal (⌘ + Mellomrom → skriv `Terminal`).
3. Kjør:
   ```bash
   nvm install 22
   nvm use 22
   node -v && npm -v
   ```
   Output bør vise Node ≥ 22 og npm ≥ 10.5.
4. Hvis du jobber i VS Code, lukk og åpne terminalen på nytt etter `nvm use 22`, slik at den får riktig versjon.

## 1. Last ned prosjektet lokalt

1. Gå til GitHub/Vercel og last ned prosjektet som **zip**, eller klon repoet med Git.
2. Pakk ut zip-filen.
3. Inne i zip-mappen ligger ofte en ekstra undermappe, for eksempel `math_visuals-main/math_visuals`.
4. Åpne VS Code i innerste mappe (`File → Open Folder …`).

## 2. Åpne terminal i riktig mappe

1. I VS Code: `View → Terminal` (eller ``⌃` ``).
2. Skriv `pwd` for å se hele stien.
3. Skriv `ls` og sjekk at du ser `package.json` i lista. Hvis ikke: `cd` videre inn til mappen som inneholder `package.json`.
   ```bash
   cd path/til/mappen/med/packagejson
   ls
   ```

## 3. Installer avhengigheter

Kjør dette én gang etter at du har riktig Node-versjon og står i mappen med `package.json`:

```bash
npm install
```

Du kan ignorere meldinger om utdaterte pakker, men **ikke** meldingen «Unsupported engine». Hvis den fortsatt dukker opp, sjekk at `node -v` er 22.x i samme terminal.

## 4. Start utviklingsserveren

1. I terminalen kjører du:
   ```bash
   npx vercel dev
   ```
   `npx` gjør at du slipper å installere Vercel CLI globalt.
2. Første gang må du kanskje logge inn i Vercel fra terminalen. Følg instruksjonene som dukker opp.
3. Når serveren er i gang ser du en linje som ligner:
   ```
   > Ready! Available at http://localhost:3000
   ```
4. La terminalen stå åpen. Så lenge denne prosessen kjører er både front-end og API tilgjengelig lokalt.

## 5. Test at lagringen er varig

Åpne et **nytt** terminalvindu (eller fanen `+` i VS Code-terminalen), og pass på at du fortsatt er i prosjektmappen.

```bash
npm run check-examples-api
```

* Får du «varig lagring (KV)», er alt satt opp riktig.
* Får du «midlertidig minne», må du legge inn `KV_REST_API_URL` og `KV_REST_API_TOKEN` (se neste seksjon).
* Får du feilmelding om at API-et ikke svarer, kjører ikke `vercel dev`-prosessen eller du peker mot feil URL. Start `npx vercel dev` og prøv igjen.

## 6. Legg inn KV-nøkler når du trenger permanent lagring

1. I Vercel: gå til **Storage → KV → View Details → REST API**.
2. Kopier `KV_REST_API_URL` og `KV_REST_API_TOKEN`.
3. Legg dem inn som miljøvariabler i Vercel (Production/Preview) og lokalt:
   ```bash
   export KV_REST_API_URL="https://...vercel-storage.com"
   export KV_REST_API_TOKEN="kv-..."
   ```
   Bruk `.env.local` om du heller vil lagre dem i fil for `vercel dev`.
4. Start `npx vercel dev` på nytt etter at variablene er satt.
5. Kjør `npm run check-examples-api` igjen for å bekrefte at lagringen nå er «varig».

## 7. Test i nettleseren

1. Åpne `http://localhost:3000/arealmodell.html` (eller et annet verktøy).
2. Lag et eksempel og lagre det.
3. Last siden på nytt (⌘ + R). Eksemplet skal fortsatt være der hvis KV er konfigurert.

## 8. Når bør du be om hjelp?

* Du får ikke logget inn i Vercel CLI.
* `npm run check-examples-api` klarer ikke å koble til API-et.
* Du ser fortsatt «midlertidig minne» etter at du har lagt inn KV-variablene.

Del skjermdump eller terminal-output når du spør om hjelp – da er det enklere å se hva som mangler.
