# CloudShell verifier task stubs

:::task-stub{title="Surface helper diagnostics in verifier runs"}
- Update `scripts/cloudshell-verify.sh` so output from `cloudshell_check_examples` is always shown (stdout/stderr), even when it exits non-zero, and emit a short summary before failing.
- Add a `--trace` description in the usage/help text and ensure the flag is accepted so operators can see every step without modifying the script.
- Keep the top-level wrapper `cloudshell-verify.sh` propagating the exit code, but add start/end markers so users know whether the helper actually ran.
:::

:::task-stub{title="Diagnose tidlig exit i CloudShell-helsesjekken"}
- Utvid `scripts/cloudshell-verify.sh` med et `--trace`-flagg som aktiverer `set -x` og sørger for at både helperen og de påfølgende CloudFront-/curl-stegene logges i samme kjøring.
- Pakk `cloudshell_check_examples`-kallet i en blokk som alltid viser stdout/stderr (f.eks. `|& tee`), og legg til en kort feilmelding som sier hvilket steg som stoppet (CloudFormation, SSM/Secrets eller `npm run check-examples-api`).
- Sørg for at wrapperen `cloudshell-verify.sh` propagere exit-koden, men også skriver “starter/verifier ferdig” rundt helper-kallet så brukere ser at skriptet faktisk kjørte.
- Dokumenter det nye `--trace`-flagget og den forbedrede feillogginen i avsnittet om CloudShell-helsesjekk i `docs/examples-storage.md`, med en kopier-og-lim-kommando for standard stack-navn.
:::

:::task-stub{title="Handle missing CloudFront outputs gracefully"}
- Allow an `--api-url` override to skip CloudFront lookup when stack outputs are absent, and reuse the parsed host for downstream curl and CloudFront-origin checks when possible.
- When neither `--api-url` nor CloudFront outputs yield a domain, print a clear warning and skip the CloudFront/sortering checks instead of exiting silently.
- Document the override flow in `docs/examples-storage.md` under the CloudShell health check section, including a copy/paste example with all relevant flags.
:::

:::task-stub{title="Implement --trace flag and fail-loud helper output"}
- Extend `scripts/cloudshell-verify.sh` argument parsing to accept `--trace` and toggle `set -x` so operators can see each AWS/SSM/Secrets/curl step without editing the script.
- Ensure the helper invocation prints stdout/stderr even under `set -e`, and emit a short summary before exiting non-zero so runs don’t appear to succeed silently.
- Update the usage/help text (and the “Full helsesjekk i CloudShell” section of `docs/examples-storage.md`) to include `--trace` with a copy/paste example.
:::
