import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import { beforeAll, describe, expect, it } from 'vitest';
import { SuphomeyStack } from '../lib/suphomey-stack';

let template: Template;

beforeAll(() => {
  const app = new App();
  const stack = new SuphomeyStack(app, 'Test', {
    env: { account: '123456789012', region: 'ap-southeast-1' },
    cloudFrontPrefixListId: 'pl-0123456789abcdef0',
    alarmEmail: 'ops@example.com',
    // Skip Docker builds in unit tests.
    image: { web: ecs.ContainerImage.fromRegistry('web:test'), ingest: ecs.ContainerImage.fromRegistry('ingest:test') },
  });
  template = Template.fromStack(stack);
});

describe('database', () => {
  it('is private, encrypted, backed up and protected from deletion', () => {
    template.hasResourceProperties('AWS::RDS::DBInstance', {
      Engine: 'postgres',
      PubliclyAccessible: false,
      StorageEncrypted: true,
      DeletionProtection: true,
      BackupRetentionPeriod: 7,
    });
  });

  it('only accepts connections from the web and ingest tasks', () => {
    const rules = template.findResources('AWS::EC2::SecurityGroupIngress', { Properties: { FromPort: 5432 } });
    expect(Object.keys(rules)).toHaveLength(2);
    for (const rule of Object.values(rules)) {
      expect(rule.Properties.SourceSecurityGroupId).toBeDefined();
      expect(rule.Properties.CidrIp).toBeUndefined();
    }
  });
});

describe('secrets', () => {
  it('injects database credentials from Secrets Manager, never as plain environment variables', () => {
    const tasks = template.findResources('AWS::ECS::TaskDefinition');
    expect(Object.keys(tasks)).toHaveLength(2);
    for (const task of Object.values(tasks)) {
      const container = task.Properties.ContainerDefinitions[0];
      const plainNames = (container.Environment ?? []).map((e: { Name: string }) => e.Name);
      const secretNames = (container.Secrets ?? []).map((s: { Name: string }) => s.Name);
      expect(plainNames).not.toContain('PGPASSWORD');
      expect(secretNames).toEqual(expect.arrayContaining(['PGHOST', 'PGUSER', 'PGPASSWORD', 'PGDATABASE', 'PGPORT']));
      expect(container.Environment).toEqual(expect.arrayContaining([{ Name: 'PGSSLMODE', Value: 'verify-full' }]));
    }
  });
});

describe('edge', () => {
  it('lets only CloudFront reach the load balancer', () => {
    // No inline "open to the world" rule on the load balancer's security group...
    const lbGroups = template.findResources('AWS::EC2::SecurityGroup', { Properties: { GroupDescription: Match.stringLikeRegexp('LB') } });
    expect(Object.keys(lbGroups)).toHaveLength(1);
    expect(JSON.stringify(lbGroups)).not.toContain('0.0.0.0/0');
    // ...and its only port-80 rule allows CloudFront's origin-facing prefix list.
    const [lbGroupId] = Object.keys(lbGroups);
    const rules = Object.values(template.findResources('AWS::EC2::SecurityGroupIngress', { Properties: { FromPort: 80 } }));
    expect(rules).toHaveLength(1);
    expect(rules[0]?.Properties).toMatchObject({ SourcePrefixListId: 'pl-0123456789abcdef0', GroupId: { 'Fn::GetAtt': [lbGroupId, 'GroupId'] } });
  });

  it('serves over HTTPS and caches by the app’s Cache-Control headers', () => {
    template.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: Match.objectLike({
        DefaultCacheBehavior: Match.objectLike({
          ViewerProtocolPolicy: 'redirect-to-https',
          // AWS managed policy "UseOriginCacheControlHeaders-QueryStrings".
          CachePolicyId: '4cc15a8a-d715-48a4-82b8-cc0b614638fe',
        }),
      }),
    });
  });

  it('checks app health on /api/health', () => {
    template.hasResourceProperties('AWS::ElasticLoadBalancingV2::TargetGroup', { HealthCheckPath: '/api/health', Port: 80 });
  });
});

describe('daily refresh', () => {
  it('runs the ingest task at 3am Singapore time with retries', () => {
    template.hasResourceProperties('AWS::Scheduler::Schedule', {
      ScheduleExpression: 'cron(0 3 * * ? *)',
      ScheduleExpressionTimezone: 'Asia/Singapore',
      Target: Match.objectLike({ RetryPolicy: Match.objectLike({ MaximumRetryAttempts: 2 }) }),
    });
  });

  it('migrates before refreshing', () => {
    template.hasResourceProperties('AWS::ECS::TaskDefinition', {
      ContainerDefinitions: [Match.objectLike({ Command: ['sh', '-c', 'pnpm db:migrate && pnpm ingest'] })],
    });
  });
});

describe('alarms', () => {
  it('notify by email on errors, unhealthy tasks and database pressure', () => {
    template.resourceCountIs('AWS::CloudWatch::Alarm', 4);
    template.hasResourceProperties('AWS::SNS::Subscription', { Protocol: 'email', Endpoint: 'ops@example.com' });
    template.hasResourceProperties('AWS::CloudWatch::Alarm', { MetricName: 'FreeStorageSpace', ComparisonOperator: 'LessThanThreshold', Threshold: 2 * 1024 ** 3 });
  });
});
