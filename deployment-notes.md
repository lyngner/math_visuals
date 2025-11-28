# Deployment attempt notes

- Attempted to follow CloudShell deployment steps for static site and API distribution.
- Installed AWS CLI locally via `pip` because the binary was missing in the environment.
- Could not retrieve AWS account ID or proceed with stack lookups/deployment because AWS credentials are not configured in this environment (the AWS CLI reported `Unable to locate credentials`).
- No CloudFormation deployment or CloudFront verification was executed.

To continue, configure AWS credentials (e.g., via `aws configure`, environment variables, or an injected credentials profile) and rerun the commands from the instructions.

Redis/Lambda note:
- `scripts/configure-lambda-redis.sh` merges the current Lambda environment from `get-function-configuration` with Redis variables instead of overwriting it, so reruns should not drop unrelated configuration.

CloudShell one-liner for GitHub Actions deploy-rollen:
- Fra CloudShell kan rollen opprettes/oppdateres med én kommando (bruker standard repo/branch autodeteksjon):

```
cd math_visuals && ./scripts/cloudshell-create-oidc-role.sh
```

Dev-miljø:
- `deploy-infra-dev.yml` kjører automatisk på `push` til `dev` og oppretter dev-stakkene `math-visuals-data-dev`, `math-visuals-api-dev` og `math-visuals-static-site-dev` med egne secrets/bøtter.
- Hent CloudFront-domenet fra `CloudFrontDistributionDomainName`-outputen på `math-visuals-static-site-dev` etter første kjøring og oppdater README (dev-URL-feltet) slik at teamet vet hvor de kan teste endringene før merge til `main`.

Redis/Vercel KV for `api/examples` (prod):
- Sørg for at produksjonsmiljøet har Redis-variablene satt: `REDIS_ENDPOINT`/`REDIS_HOST`, `REDIS_PORT` og `REDIS_PASSWORD` (evt. `REDIS_URL` om Vercel KV gir én streng). For Vercel kan de legges til med `vercel env add REDIS_URL --environment=production` eller ved å bruke `REDIS_ENDPOINT`/`REDIS_PORT`/`REDIS_PASSWORD` via dashboardet. I AWS/CI-verdikjeden speiles de som GitHub Action-secrets slik at `deploy-infra.yml` kan injisere verdiene i Lambda-miljøet.
- Kjør en ny produksjonsdeploy (GitHub Actions `deploy-infra.yml` eller manuell `aws cloudformation deploy` + artefakt-opplasting). Når Lambda starter opp igjen skal `X-Examples-Store-Mode`-headeren fra `GET https://<api-host>/examples` rapportere `kv` i stedet for `memory`.
- Valider at lagringen er persistent: opprett et eksempel via POST mot `https://<api-host>/examples` (bruk liten payload), noter `path`, kjør et kontrollert restart av funksjonen (f.eks. `aws lambda update-function-configuration --function-name math-visuals-api --description "force restart"` eller kjør en ny deploy) og slå opp `GET /examples?path=<path>` etterpå. Payloaden skal fremdeles finnes, og responsen skal ha `X-Examples-Store-Mode: kv`.
