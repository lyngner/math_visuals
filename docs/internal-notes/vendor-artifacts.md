# Vendor-artefakter i PR-er

- `public/vendor/` er kun et kjøremiljø for filer som genereres av `npm run materialize-vendor`.
- Kjør `npm run materialize-vendor` lokalt ved behov, men ikke legg de genererte filene i Git. De er minifiserte, endrer seg ofte og skaper unødvendige konflikter i PR-er.
- Bruk `npm run materialize-vendor -- --check` før du åpner en PR hvis du er usikker på om manifestet er oppdatert. Kommandoen feiler hvis noen filer må regenereres.
- CI håndhever samme sjekk og stanser PR-er der vendor-manifestet er utdatert.
