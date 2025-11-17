# Static site infrastructure

This directory contains an AWS CloudFormation template for provisioning the
infrastructure required to host the math visuals static site.

## What the template creates

The [`template.yaml`](./template.yaml) file configures the following resources:

- A versioned S3 bucket for storing the compiled `public/` artefacts.
- A CloudFront distribution fronting the bucket, including an origin access
  control so that the bucket can remain private without exposing public ACLs.
- Behaviours that route API-backed paths to an API Gateway origin while letting
  `/sortering` paths resolve to S3 objects.

### CloudFront behaviours

| Path pattern            | Origin             | Query string forwarding |
| ----------------------- | ------------------ | ----------------------- |
| Default (`*`)           | S3 static assets   | No                      |
| `/sortering/eksempel*`  | S3 static assets   | Yes                     |
| `/sortering*`           | S3 static assets   | Yes                     |
| `/bildearkiv/*`         | API Gateway origin | Yes                     |
| `/svg/*`                | API Gateway origin | Yes                     |
| `/figure-library/*.js`  | S3 static assets   | No                      |
| `/figure-library/*`     | API Gateway origin | Yes                     |

Viewer request rewrites are handled by an attached CloudFront Function that
normalises "friendly" app routes (for example `/tenkeblokker/eksempel1`) to
their underlying HTML assets before the request reaches S3. This keeps deep
links to individual tools working even when the path omits the `.html`
extension or includes an example slug.

## Parameters

| Name                  | Description                                                   |
| --------------------- | ------------------------------------------------------------- |
| `SiteBucketName`      | Globally unique name of the S3 bucket that will host the site. |
| `ApiGatewayDomainName`| Domain name of the API Gateway stage (e.g. `abc123.execute-api.us-east-1.amazonaws.com`). |
| `ApiGatewayOriginPath`| Optional origin path that points to the API stage (default `/prod`). |
| `CloudFrontPriceClass`| CloudFront price class to use (defaults to `PriceClass_100`). |
| `SharedParametersStackName` | Name of the stack created from `infra/shared-parameters.yaml`. |

## Outputs

The stack exports the following values for reuse by other stacks or deployment
steps:

- `StaticSiteBucketName` – the bucket that stores the static assets.
- `CloudFrontDistributionId` – identifier of the CloudFront distribution.
- `CloudFrontDistributionDomainName` – domain used to reach the distribution.

## Deploying the stack

Use the helper script to redeploy the stack with the latest template changes and
the parameter values that were already provisioned in AWS:

```bash
# From the repository root
scripts/deploy-static-site.sh
```

The script reads the existing values for `SiteBucketName`,
`ApiGatewayDomainName`, `ApiGatewayOriginPath` and `CloudFrontPriceClass` from
the `math-visuals-static-site` stack and redeploys
[`template.yaml`](./template.yaml) with `--force-upload` so that CloudFront
receives the latest behaviours even when the parameters are unchanged. Override
any of the values (or the stack names) by exporting the matching environment
variables before running the script.

### Verification

1. Confirm that the `/api/*` behaviour still targets the API Gateway origin:

   ```bash
   CLOUDFRONT_REGION=us-east-1
   CLOUDFRONT_ID=$(aws cloudformation describe-stacks \
     --stack-name math-visuals-static-site \
     --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontDistributionId`].OutputValue' \
     --output text)

   aws cloudfront get-distribution-config \
     --region "$CLOUDFRONT_REGION" \
     --id "$CLOUDFRONT_ID" \
     --query "DistributionConfig.CacheBehaviors.Items[?PathPattern=='/api/*'].{PathPattern:PathPattern,TargetOriginId:TargetOriginId}" \
     --output table
   ```

   The table must show `PathPattern` `/api/*` with `TargetOriginId`
   `ApiGatewayOrigin`.

2. Run the verification curls against the deployed CloudFront domain:

   ```bash
   CLOUDFRONT_DOMAIN=$(aws cloudformation describe-stacks \
     --stack-name math-visuals-static-site \
     --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontDistributionDomainName`].OutputValue' \
     --output text)

   curl "https://$CLOUDFRONT_DOMAIN/api/examples" | jq '.mode'
   curl -I "https://$CLOUDFRONT_DOMAIN/sortering/eksempel1"
   ```

   The `/api/examples` call should return the API response (JSON containing
   `mode`), and the `/sortering/eksempel1` request should return a `200 OK` from
   the S3 origin.

The outputs `ExamplesAllowedOriginsParameterName` and
`SvgAllowedOriginsParameterName` mirror the shared stack so that deployment
pipelines can retrieve the allow-list parameter names alongside the CloudFront
distribution metadata.
