const { spawnSync } = require('node:child_process');

const failedDuplicateMigration = '20260728051029_add_service_api_key';
const prismaExecutable = process.platform === 'win32' ? 'npx.cmd' : 'npx';

function runPrisma(args) {
  const result = spawnSync(prismaExecutable, ['prisma', ...args], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: process.env,
  });

  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }

  return result;
}

const initialDeploy = runPrisma(['migrate', 'deploy']);
if (initialDeploy.status === 0) {
  process.exit(0);
}

const deployOutput = `${initialDeploy.stdout ?? ''}\n${initialDeploy.stderr ?? ''}`;
const isKnownFailedDuplicate =
  deployOutput.includes('P3009') &&
  deployOutput.includes(failedDuplicateMigration);

if (!isKnownFailedDuplicate) {
  process.exit(initialDeploy.status ?? 1);
}

console.log(
  `Resolving known duplicate migration ${failedDuplicateMigration} as rolled back.`,
);
const resolve = runPrisma([
  'migrate',
  'resolve',
  '--rolled-back',
  failedDuplicateMigration,
]);
if (resolve.status !== 0) {
  process.exit(resolve.status ?? 1);
}

const retryDeploy = runPrisma(['migrate', 'deploy']);
process.exit(retryDeploy.status ?? 1);
