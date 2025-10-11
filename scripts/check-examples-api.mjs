#!/usr/bin/env node
import process from 'node:process';

const DEFAULT_URL = 'http://localhost:3000/api/examples';

function parseArgs(argv) {
  const result = { url: DEFAULT_URL, path: null, verbose: false };
  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') {
      result.help = true;
      continue;
    }
    if (arg === '--verbose' || arg === '-v') {
      result.verbose = true;
      continue;
    }
    if (arg.startsWith('--url=')) {
      const value = arg.slice('--url='.length).trim();
      if (value) result.url = value;
      continue;
    }
    if (arg.startsWith('--path=')) {
      const value = arg.slice('--path='.length).trim();
      if (value) result.path = value;
      continue;
    }
  }
  if (result.url.endsWith('/')) {
    result.url = result.url.replace(/\/+$/, '');
  }
  return result;
}

function printHelp() {
  console.log('Slik bruker du skriptet:');
  console.log('  node scripts/check-examples-api.mjs [--url=URL] [--path=sti] [--verbose]');
  console.log('');
  console.log('Standard-URL er http://localhost:3000/api/examples.');
  console.log('Hvis du oppgir --path, sjekkes ett bestemt verktøy.');
  console.log('Bruk --verbose for å se råresponsen når noe feiler.');
}

function describeMode(mode) {
  if (!mode) return 'ukjent';
  const normalized = String(mode).trim().toLowerCase();
  if (!normalized) return 'ukjent';
  if (normalized === 'kv') return 'varig lagring (KV)';
  if (normalized === 'memory') return 'midlertidig minne';
  return normalized;
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json'
    }
  });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (_) {
    data = null;
  }
  return { response, data, text };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    process.exit(0);
    return;
  }

  let targetUrl = args.url;
  if (args.path) {
    const connector = targetUrl.includes('?') ? '&' : '?';
    targetUrl = `${targetUrl}${connector}path=${encodeURIComponent(args.path)}`;
  }

  console.log(`Sjekker ${targetUrl} ...`);

  try {
    const { response, data, text } = await fetchJson(targetUrl);
    if (!response.ok) {
      console.error(`❌ API-et svarte med status ${response.status}.`);

      const messageParts = [];
      if (data) {
        if (typeof data.error === 'string') {
          messageParts.push(data.error);
        } else if (data.error) {
          messageParts.push(JSON.stringify(data.error, null, 2));
        }
        if (typeof data.message === 'string') {
          messageParts.push(data.message);
        }
      }
      if (!messageParts.length && text) {
        const trimmed = text.trim();
        if (trimmed) messageParts.push(trimmed);
      }
      if (!messageParts.length && response.statusText) {
        messageParts.push(response.statusText);
      }

      if (messageParts.length) {
        console.error('Melding:');
        for (const part of messageParts) {
          console.error(part);
        }
      } else if (args.verbose && !text) {
        console.error('Melding: (tom respons fra serveren)');
      } else if (response.status === 404) {
        console.error('Fant ikke stien.');
      }

      if (response.status === 404 && !args.path) {
        console.error(
          'Tips: 404 uten --path betyr som regel at utviklingsserveren ikke kjører. '
            + 'Sjekk at du har et «npx vercel dev»-vindu som er aktivt, eller bruk --url for å peke til riktig server.'
        );
      } else if (response.status === 404 && args.path) {
        console.error(
          'Tips: Sjekk at verktøyet du oppga med --path faktisk har lagrede eksempler. '
            + 'Åpne siden, lagre et nytt eksempel og kjør skriptet igjen.'
        );
      }

      if (args.verbose) {
        console.error('');
        console.error('--- Detaljer ---');
        const statusText = response.statusText ? ` ${response.statusText}` : '';
        console.error(`Statuslinje: ${response.status}${statusText}`);
        const contentType = response.headers.get('content-type');
        if (contentType) {
          console.error(`Content-Type: ${contentType}`);
        }
        if (text && text.trim()) {
          console.error('Rårespons:');
          console.error(text.trim());
        } else if (!messageParts.length) {
          console.error('Rårespons: (tom)');
        }
        console.error('----------------');
      }

      process.exitCode = 1;
      return;
    }

    const mode = data && (data.mode || data.storageMode || data.storage);
    const persistent = Boolean(data && (data.persistent || mode === 'kv'));

    if (Array.isArray(data.entries)) {
      console.log(`✅ Fikk ${data.entries.length} post(er). Lagres i ${describeMode(mode)}.`);
      if (!persistent) {
        console.log('⚠️  Dette er midlertidig. Eksempler forsvinner når serveren starter på nytt.');
      }
      return;
    }

    if (data && Array.isArray(data.examples)) {
      console.log(`✅ Fikk en post med ${data.examples.length} eksempel(er). Lagres i ${describeMode(mode)}.`);
      if (!persistent) {
        console.log('⚠️  Dette er midlertidig. Eksempler forsvinner når serveren starter på nytt.');
      }
      return;
    }

    console.log('ℹ️  API-et svarte, men formatet var uventet.');
    if (data) {
      console.log(JSON.stringify(data, null, 2));
    }
    if (args.verbose && text && text.trim()) {
      console.log('Rårespons:');
      console.log(text.trim());
    }
    if (!persistent) {
      console.log('⚠️  Sjekk at KV_REST_API_URL og KV_REST_API_TOKEN er satt.');
    }
  } catch (error) {
    console.error('❌ Klarte ikke å kontakte API-et.');
    console.error(error && error.message ? error.message : error);
    console.error('Tips: Er back-end startet? Bruk --url for å peke til riktig adresse.');
    process.exitCode = 1;
  }
}

await main();
