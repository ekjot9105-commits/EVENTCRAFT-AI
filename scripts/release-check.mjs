// Checks the invariants required before creating a deployment or submission build.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const packageJson = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
const failures = [];

function fail(message) {
  failures.push(message);
}

const requiredScripts = ['verify', 'test:e2e', 'test:a11y', 'build'];
for (const script of requiredScripts) {
  if (!packageJson.scripts?.[script]) fail(`package.json is missing the ${script} script`);
}

const envExample = path.join(root, '.env.example');
if (!existsSync(envExample)) {
  fail('.env.example is missing');
} else {
  const envText = readFileSync(envExample, 'utf8');
  for (const variable of ['DATABASE_PROVIDER', 'AI_PROVIDER', 'NODE_ENV', 'DEMO_MODE', 'AUTH_ENABLED', 'DEMO_ALLOW_CLIENT_SESSION_ID']) {
    if (!new RegExp(`^${variable}=`, 'm').test(envText)) fail(`.env.example is missing ${variable}`);
  }
}

try {
  const trackedFiles = execFileSync('git', ['ls-files'], { encoding: 'utf8' })
    .split(/\r?\n/)
    .filter(Boolean);
  const allowedEnvironmentTemplates = new Set(['.env.example', '.env.demo.example', '.env.production.example', '.env.test.example']);
  const forbiddenTrackedFiles = trackedFiles.filter((file) => !allowedEnvironmentTemplates.has(file) && /(^|\/)\.env(?:\.|$)/i.test(file));
  for (const file of forbiddenTrackedFiles) fail(`environment file is tracked: ${file}`);

  const secretPatterns = [
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
    /AIza[0-9A-Za-z_-]{20,}/,
    /eyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/,
  ];
  for (const relativeFile of trackedFiles) {
    if (!/\.(?:js|jsx|ts|tsx|mjs|json|md|yml|yaml|env|sql)$/i.test(relativeFile)) continue;
    if (allowedEnvironmentTemplates.has(relativeFile)) continue;
    const content = readFileSync(path.join(root, relativeFile), 'utf8');
    if (secretPatterns.some((pattern) => pattern.test(content))) fail(`secret-like value found in tracked file: ${relativeFile}`);
  }
} catch (error) {
  fail(`could not inspect tracked files: ${error instanceof Error ? error.message : String(error)}`);
}

const clientDist = path.join(root, 'dist', 'client');
const indexHtml = path.join(clientDist, 'index.html');
if (!existsSync(indexHtml)) {
  fail('dist/client/index.html is missing; run npm run build first');
} else {
  const entryChunks = readdirSync(path.join(clientDist, 'assets'))
    .filter((file) => /^index-[^/]+\.js$/.test(file));
  if (entryChunks.length !== 1) {
    fail(`expected one client entry chunk, found ${entryChunks.length}`);
  } else {
    const entryPath = path.join(clientDist, 'assets', entryChunks[0]);
    const entryBytes = readFileSync(entryPath).byteLength;
    const entryLimit = 450 * 1024;
    if (entryBytes > entryLimit) fail(`client entry chunk is ${entryBytes} bytes; limit is ${entryLimit} bytes`);
    else process.stdout.write(`Release check: client entry ${entryBytes} bytes (limit ${entryLimit})\n`);
  }
}

if (failures.length > 0) {
  process.stderr.write(`Release check failed:\n${failures.map((failure) => `- ${failure}`).join('\n')}\n`);
  process.exit(1);
}

process.stdout.write('Release check passed: scripts, environment contract, secret hygiene, and production artifacts are ready.\n');
