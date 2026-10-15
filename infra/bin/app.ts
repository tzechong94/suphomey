import { App } from 'aws-cdk-lib';
import { SuphomeyStack } from '../lib/suphomey-stack';

const app = new App();

// Region-specific; find it with:
//   aws ec2 describe-managed-prefix-lists --filters Name=prefix-list-name,Values=com.amazonaws.global.cloudfront.origin-facing
const cloudFrontPrefixListId = app.node.tryGetContext('cloudFrontPrefixListId') as string | undefined;
if (!cloudFrontPrefixListId) {
  throw new Error('Pass -c cloudFrontPrefixListId=pl-xxxxxxxx (see infra/README.md).');
}

new SuphomeyStack(app, 'Suphomey', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION ?? 'ap-southeast-1' },
  cloudFrontPrefixListId,
  alarmEmail: app.node.tryGetContext('alarmEmail') as string | undefined,
});
