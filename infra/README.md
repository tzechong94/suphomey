# Infrastructure (AWS CDK)

[`lib/suphomey-stack.ts`](lib/suphomey-stack.ts) defines the production deployment on AWS. Deploying
is optional for this project, and the demo runs on Vercel + Neon instead to avoid the always-on
cost (below). What is verified: the stack synthesises without warnings and its tests pass in CI.
What is not: it has not been deployed to a real AWS account, so expect first-deploy issues of the
kind synthesis cannot catch (service quotas, image build on your machine, the prefix list ID).

```
Users ──HTTPS──> CloudFront ──HTTP──> ALB (public subnets, CloudFront prefix list only)
                                        │
                                        ▼
                      ECS Fargate "web" service, 2 to 6 tasks (private subnets)
                                        │  PG* secrets from Secrets Manager, TLS verify-full
                                        ▼
                      RDS PostgreSQL 17, t4g.micro (isolated subnets)
                                        ▲
EventBridge Scheduler ── 03:00 SGT ──> ECS Fargate "ingest" task ──NAT──> data.gov.sg
```

| Concern | Choice |
|---|---|
| Compute | ECS Fargate, image built from the repo's Dockerfile (`web` target), CPU autoscaling 2 to 6 tasks, rolling deploys with circuit-breaker rollback |
| Edge | CloudFront, HTTPS only; caches by the app's `Cache-Control` headers with query strings in the key |
| Database | RDS PostgreSQL 17, encrypted, 7-day backups, deletion protection, snapshot on stack removal |
| Secrets | RDS-generated credentials in Secrets Manager, injected as `PG*` variables; the image bundles the RDS CA so TLS is verified |
| Schedule | EventBridge Scheduler, daily at 03:00 Asia/Singapore, `pnpm db:migrate && pnpm ingest`, 2 retries |
| Observability | CloudWatch logs (web 1 month, ingest 3 months), Container Insights, alarms on 5xx, unhealthy tasks, DB CPU and free storage to SNS |

## Commands

```bash
pnpm --filter infra test        # assertion tests on the synthesised template (no AWS account needed)
pnpm --filter infra synth -c cloudFrontPrefixListId=pl-xxxxxxxx
```

## Deploying

Prerequisites: AWS credentials, Docker running (CDK builds and pushes the images), and a one-time
`npx cdk bootstrap` in the target account and region.

1. Look up CloudFront's origin-facing prefix list in your region (the ALB accepts only this):

   ```bash
   aws ec2 describe-managed-prefix-lists \
     --filters Name=prefix-list-name,Values=com.amazonaws.global.cloudfront.origin-facing \
     --query 'PrefixLists[0].PrefixListId' --output text
   ```

2. Deploy (default region `ap-southeast-1`):

   ```bash
   cd infra
   npx cdk deploy -c cloudFrontPrefixListId=pl-xxxxxxxx -c alarmEmail=you@example.com
   ```

3. Load the data once, by running the ingest task with the seed command (names come from the stack
   outputs; subnets and security group from the VPC the stack created):

   ```bash
   aws ecs run-task --cluster <ClusterName> --task-definition <IngestTaskDefinition> --launch-type FARGATE \
     --network-configuration 'awsvpcConfiguration={subnets=[<private-subnet-id>],securityGroups=[<ingest-sg-id>]}' \
     --overrides '{"containerOverrides":[{"name":"ingest","command":["sh","-c","pnpm db:migrate && pnpm db:seed"]}]}'
   ```

4. Open the `Url` output.

## Deploying from GitHub Actions

[`.github/workflows/deploy-aws.yml`](../.github/workflows/deploy-aws.yml) runs the infra tests and then
`cdk deploy`. It is manual only (Actions > Deploy to AWS > Run workflow), because every deploy has a
running cost. It holds no AWS keys: GitHub signs a short-lived OIDC token for the run, and AWS trades it
for temporary credentials of a role that trusts only this repository.

One-time setup in AWS (after `cdk bootstrap`):

1. IAM > Identity providers: add `token.actions.githubusercontent.com` (audience `sts.amazonaws.com`).
2. Create a role trusted by that provider, with the condition
   `token.actions.githubusercontent.com:sub` = `repo:<owner>/<repo>:environment:aws`, allowed to
   `sts:AssumeRole` the CDK bootstrap roles (`arn:aws:iam::<account>:role/cdk-hnb659fds-*`).

Then in GitHub, create an environment named `aws` (add required reviewers there for an approval step) with
these variables: `AWS_DEPLOY_ROLE_ARN`, `CLOUDFRONT_PREFIX_LIST_ID`, and optionally `ALARM_EMAIL`.

## Cost (rough, ap-southeast-1, on demand)

The always-on parts dominate: one NAT gateway, the ALB, two small Fargate tasks and a t4g.micro RDS
instance, estimated at roughly USD 120 to 150 a month before data transfer; check the AWS
Pricing Calculator for current rates. For a demo, Vercel + Neon (as used for the live site) is far
cheaper.

## Tearing down

`npx cdk destroy` removes everything except the database, which has deletion protection on and is
snapshotted on removal. Turn off deletion protection on the instance first if you really mean it.
