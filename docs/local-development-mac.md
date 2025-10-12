# Lokal utvikling på Mac (steg for steg)

Denne siden er en **enkel veiledning** for å kjøre Math Visuals lokalt og sjekke at eksemplene faktisk lagres. Følg punktene i rekkefølge.

## 0. Sørg for riktig Node- og npm-versjon

`@cortex-js/compute-engine` krever minst **Node 21.7.3** og **npm 10.5.0**. Hvis du ser advarsler om «Unsupported engine», må du oppdatere Node/npm.

### 0a. Installer `nvm` (hvis du får `command not found`)

1. Åpne Terminal (⌘ + Mellomrom → skriv `Terminal`).
2. Lim inn denne linjen og trykk Enter:
   ```bash
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
   ```
3. Lukk terminalvinduet helt og åpne et nytt. (I VS Code: lukk terminalfanen og åpne `Terminal` på nytt.)
4. Sjekk at `nvm` nå finnes:
   ```bash
   command -v nvm
   ```
   Hvis du ser `nvm`, er installasjonen vellykket. Hvis den fortsatt mangler, se feilsøking nederst.

> **Alternativ uten nvm:** Hvis du foretrekker Homebrew, kan du kjøre `brew install node@22` og deretter `brew link --overwrite node@22`. Pass da på at `node -v` i terminalen din viser `v22.x` før du går videre.

### 0b. Bytt til Node 22 med `nvm`

1. I terminalen:
   ```bash
   nvm install 22
   nvm use 22
   node -v && npm -v
   ```
2. Output skal vise Node ≥ 22 og npm ≥ 10.5.
3. Hvis du jobber i VS Code, lukk og åpne terminalen på nytt etter `nvm use 22`, slik at den fanger opp riktig versjon.

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
2. Første gang må du kanskje logge inn i Vercel fra terminalen (`npx vercel login`). Følg instruksjonene som dukker opp. Når CLI-en ber om å «linke» prosjektet, kan du trygt svare ja på å knytte mappen til eksisterende Vercel-prosjekt. Hvis den ikke spør, kjører du `npx vercel link` én gang for å knytte mappen manuelt før du prøver `npx vercel dev` på nytt.
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

1. I Vercel: gå til **Storage → KV → View Details → REST API** og noter verdiene for `KV_REST_API_URL` og `KV_REST_API_TOKEN`.
2. I prosjektmappen kjører du `npx vercel login` (om nødvendig) og `npx vercel link` for å koble CLI-en til riktig prosjekt.
3. Synkroniser variablene til en lokal fil med `npx vercel env pull .env.development.local`. Kommandoen henter alle variabler for valgt miljø og skriver dem på formen `KEY="value"`, som `npx vercel dev` plukker opp automatisk. Typisk output ser slik ut:
   ```
   ✅  Created .env.development.local file
   Vercel CLI 48.2.9
   > Overwriting existing .env.development.local file
   > Downloading `development` Environment Variables for brukernavn/prosjekt

   Changes:
   + VERCEL_OIDC_TOKEN (Updated)

   ✅  Updated .env.development.local file
   ```
   ✔️ Alt betyr at filen er skrevet – du trenger ikke gjøre noe mer. Hvis du ser `cd: no such file or directory: math_visuals` rett før eller etterpå, betyr det bare at du allerede sto i riktig mappe og kan ignorere feilen.
4. Skal du lime inn verdiene manuelt i Vercel sitt webgrensesnitt, må du droppe hermetegn når du fyller inn tekstfeltene (`https://...` og `kv-...`). Lokalt kan du derimot la hermetegn stå i `.env.development.local`.
5. Start `npx vercel dev` på nytt etter at variablene er på plass.
6. Kjør `npm run check-examples-api` igjen for å bekrefte at lagringen nå er «varig».

## 7. Test i nettleseren

1. Åpne `http://localhost:3000/arealmodell.html` (eller et annet verktøy).
2. Lag et eksempel og lagre det.
3. Last siden på nytt (⌘ + R). Eksemplet skal fortsatt være der hvis KV er konfigurert.

## 8. Når bør du be om hjelp?

* Du får ikke logget inn i Vercel CLI.
* `npm run check-examples-api` klarer ikke å koble til API-et.
* Du ser fortsatt «midlertidig minne» etter at du har lagt inn KV-variablene.

Del skjermdump eller terminal-output når du spør om hjelp – da er det enklere å se hva som mangler.

## Feilsøking

**`nvm` finnes fortsatt ikke etter installasjon**

1. Sjekk at du har lagt til følgende i `~/.zshrc` eller `~/.bashrc` (installasjonsskriptet gjør det automatisk, men hvis du bruker VS Code sin innebygde terminal kan det hende du må logge helt ut/inn):
   ```bash
   export NVM_DIR="$HOME/.nvm"
   [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
   [ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"
   ```
2. Lukk alle terminalvinduer og åpne et nytt. Skriv `command -v nvm` igjen.
3. Fungerer det fortsatt ikke, prøv å installere på nytt eller bruk `brew install node@22` som midlertidig løsning.
