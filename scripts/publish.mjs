import { execFileSync } from 'node:child_process';

const files = ['config.json', 'rfi-place-ids.json'];
const repositoryFiles = [...files, 'README.md', 'package.json', 'scripts/build-rfi-place-ids.mjs', 'scripts/publish.mjs'];
const message = process.argv.slice(2).join(' ').trim() || `Update Choof config ${new Date().toISOString()}`;

for (const file of files) {
  const value = JSON.parse(await (await import('node:fs/promises')).readFile(file, 'utf8'));
  if (file === 'config.json' && value.schemaVersion !== 2) throw new Error('config.json must use schemaVersion 2');
}

execFileSync('git', ['add', ...repositoryFiles], { stdio: 'inherit' });
execFileSync('git', ['commit', '-m', message], { stdio: 'inherit' });
execFileSync('git', ['push', 'origin', 'HEAD:main'], { stdio: 'inherit' });

for (const file of files) {
  const url = `https://purge.jsdelivr.net/gh/mrksoftware/choof-config@main/${file}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`jsDelivr purge failed for ${file}: HTTP ${response.status}`);
  console.log(`Purged ${file}`);
}
