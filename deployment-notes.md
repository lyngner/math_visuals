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
