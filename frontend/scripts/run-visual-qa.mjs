import { spawnSync } from 'node:child_process';

const runs = [
  { label: 'build', command: 'npm', args: ['run', 'build'], env: {} },
  {
    label: 'playwright desktop',
    command: 'npx',
    args: ['playwright', 'test', '--config=playwright.config.ts', '--project=desktop', '--reporter=dot'],
    env: { PLAYWRIGHT_PORT: '5173' },
  },
  {
    label: 'playwright mobile',
    command: 'npx',
    args: ['playwright', 'test', '--config=playwright.config.ts', '--project=mobile', '--reporter=dot'],
    env: { PLAYWRIGHT_PORT: '5174' },
  },
];

for (const run of runs) {
  console.log(`\n> ${run.label}`);
  const command = process.platform === 'win32' ? [run.command, ...run.args].join(' ') : run.command;
  const args = process.platform === 'win32' ? [] : run.args;
  const result = spawnSync(command, args, {
    env: { ...process.env, ...run.env },
    shell: process.platform === 'win32',
    stdio: 'inherit',
  });

  if (result.error) {
    console.error(result.error.message);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
