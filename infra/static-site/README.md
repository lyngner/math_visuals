# Static site infrastructure

This directory contains an AWS CloudFormation template for provisioning the
infrastructure required to host the math visuals static site.

## What the template creates

The [`template.yaml`](./template.yaml) file configures the following resources:

- A versioned S3 bucket for storing the compiled `public/` artefacts.
- A CloudFront distribution fronting the bucket, including an origin access
  identity so that the bucket can remain private.
- Behaviours that route API-backed paths to an API Gateway origin while letting
  `/sortering` paths resolve to S3 objects.

### CloudFront behaviours

| Path pattern          | Origin             | Query string forwarding |
| --------------------- | ------------------ | ----------------------- |
| Default (`*`)         | S3 static assets   | No                      |
| `/sortering*`         | S3 static assets   | Yes                     |
| `/bildearkiv/*`       | API Gateway origin | Yes                     |
| `/svg/*`              | API Gateway origin | Yes                     |
| `/figure-library/*`   | API Gateway origin | Yes                     |

## Parameters

| Name                  | Description                                                   |
| --------------------- | ------------------------------------------------------------- |
| `SiteBucketName`      | Globally unique name of the S3 bucket that will host the site. |
| `ApiGatewayDomainName`| Domain name of the API Gateway stage (e.g. `abc123.execute-api.us-east-1.amazonaws.com`). |
| `ApiGatewayOriginPath`| Optional origin path that points to the API stage (default `/prod`). |
| `CloudFrontPriceClass`| CloudFront price class to use (defaults to `PriceClass_100`). |

## Outputs

The stack exports the following values for reuse by other stacks or deployment
steps:

- `StaticSiteBucketName` – the bucket that stores the static assets.
- `CloudFrontDistributionId` – identifier of the CloudFront distribution.
- `CloudFrontDistributionDomainName` – domain used to reach the distribution.

## Deploying the stack

To deploy the infrastructure, use the AWS CLI's CloudFormation deploy command.
Replace the parameter values with ones that match your environment:

```bash
aws cloudformation deploy \
  --stack-name math-visuals-static-site \
  --template-file infra/static-site/template.yaml \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
      SiteBucketName=my-unique-math-visuals-site-bucket \
      ApiGatewayDomainName=abc123.execute-api.us-east-1.amazonaws.com \
      ApiGatewayOriginPath=/prod
```

After the deployment completes, you can retrieve the outputs with:

```bash
aws cloudformation describe-stacks \
  --stack-name math-visuals-static-site \
  --query 'Stacks[0].Outputs'
```
