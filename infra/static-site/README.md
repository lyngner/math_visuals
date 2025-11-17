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

| Name                   | Description                                                   |
| ---------------------- | ------------------------------------------------------------- |
| `SiteBucketName`       | Globally unique name of the S3 bucket that will host the site. |
| `ApiGatewayDomainName` | Domain name of the API Gateway stage (e.g. `abc123.execute-api.us-east-1.amazonaws.com`). |
| `ApiGatewayOriginPath` | Optional origin path that points to the API stage (default `/prod`). |
| `CloudFrontPriceClass` | CloudFront price class to use (defaults to `PriceClass_100`). |
| `CachePolicyId`        | CloudFront cache policy applied to API-backed behaviours (defaults to the managed `CachingDisabled` policy). |
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

The script reads the current parameter values for `SiteBucketName`,
`ApiGatewayDomainName`, `ApiGatewayOriginPath`, `CloudFrontPriceClass` and
`CachePolicyId` from the existing `math-visuals-static-site` stack before calling
[`aws cloudformation deploy`](https://docs.aws.amazon.com/cli/latest/reference/cloudformation/deploy/index.html)
against [`template.yaml`](./template.yaml). Passing `--force-upload` ensures
CloudFront receives the latest behaviours even when the parameter values do not
change. Override any of the values—along with `STACK_NAME`,
`SHARED_STACK_NAME`, or `TEMPLATE_FILE`—by exporting the matching environment
variables before running the script.

To override the cache policy used for API behaviours, export
`CACHE_POLICY_ID=<policy-id>` before running `scripts/deploy-static-site.sh`.
If you omit it the script reuses the value already stored on the stack (falling
back to the template default of `4135ea2d-6df8-44a3-9df3-4b5a84be39ad` when the
stack is first created) so existing deployments continue to inherit AWS's
managed "CachingDisabled" policy.

After the deployment finishes the script prints the CloudFront distribution ID
and domain so you can immediately verify the behaviour updates.

### Verification

1. Confirm that the `/api/*` behaviour still targets the API Gateway origin.
   The script prints the distribution ID at the end of the deploy. If you need
   to look it up again, read it from the stack output before calling
   `aws cloudfront get-distribution-config`:

   ```bash
   STACK_NAME=${STACK_NAME:-math-visuals-static-site}
   CLOUDFRONT_REGION=us-east-1
   CLOUDFRONT_ID=$(aws cloudformation describe-stacks \
     --stack-name "$STACK_NAME" \
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
   STACK_NAME=${STACK_NAME:-math-visuals-static-site}
   CLOUDFRONT_DOMAIN=$(aws cloudformation describe-stacks \
     --stack-name "$STACK_NAME" \
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
