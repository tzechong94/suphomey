# Infrastructure (AWS CDK)

[`lib/suphomey-stack.ts`](lib/suphomey-stack.ts) defines the production deployment on AWS. Deploying
is optional for this project (the live demo runs on Vercel + Neon), but the stack synthesises,
is unit tested, and is deployable as is.

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

## Cost (rough, ap-southeast-1, on demand)

The always-on parts dominate: one NAT gateway, the ALB, two small Fargate tasks and a t4g.micro RDS
instance, estimated at roughly USD 120 to 150 a month before data transfer; check the AWS
Pricing Calculator for current rates. For a demo, Vercel + Neon (as used for the live site) is far
cheaper.

## Tearing down

`npx cdk destroy` removes everything except the database, which has deletion protection on and is
snapshotted on removal. Turn off deletion protection on the instance first if you really mean it.
