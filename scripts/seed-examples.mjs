#!/usr/bin/env node

const requiredKeys = ['REDIS_ENDPOINT', 'REDIS_PORT', 'REDIS_PASSWORD'];
const missing = requiredKeys.filter(key => !process.env[key]);

console.log('Eksempeltjenesten seedes nå via Redis-instansen i AWS.');
console.log('Følg fremgangsmåten beskrevet i docs/examples-storage.md for å hente hemmelighetene og kjør deretter API-et med de samme variablene.');
console.log('Når `REDIS_*` er satt kan du bruke scripts/check-examples-api.mjs eller examples-viewer for å skrive standarddatasettene.');
if (missing.length) {
  console.log('');
  console.log(`Mangler miljøvariabler: ${missing.join(', ')}.`);
  console.log('Hent verdiene via infra/data-template-outputs (CloudFormation/SSM/Secrets Manager) før du prøver igjen.');
  process.exitCode = 1;
} else {
  console.log('');
  console.log('Alle påkrevde miljøvariabler er satt. Kjør API-et/Lambda med disse verdiene og importer eksemplene via `/api/examples`.');
}
