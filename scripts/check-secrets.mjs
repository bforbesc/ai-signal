import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// Reports locations/categories only; never print a matched credential.
const patterns = [
  ['private key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['Google client secret', /GOCSPX-[A-Za-z0-9_-]{15,}/],
  ['Google access or refresh token', /(?:ya29\.[A-Za-z0-9_-]{25,}|1\/\/[A-Za-z0-9_-]{35,})/],
  ['GitHub token', /(?:gh[pousr]_[A-Za-z0-9]{25,}|github_pat_[A-Za-z0-9_]{30,})/],
  ['Google API key', /AIza[A-Za-z0-9_-]{35}/],
  ['AWS access key', /(?:AKIA|ASIA)[A-Z0-9]{16}/],
];
const git = (...args) => execFileSync('git', args, { maxBuffer: 30 * 1024 * 1024 });
const extra = [];
if (process.argv.includes('--stdin-values')) {
  if (process.stdin.isTTY) process.stdin.setRawMode(true);
  process.stdout.write('Ready for private scan values on stdin (input hidden).\n');
  const input = await new Promise(resolve => {
    let value = ''; process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => { value += chunk; if (value.includes('\n')) { process.stdin.pause(); resolve(value.split('\n')[0]); } });
  });
  if (process.stdin.isTTY) process.stdin.setRawMode(false);
  extra.push(...JSON.parse(input).filter(value => typeof value === 'string' && value.length >= 16));
}
const findings = [];
let checked = 0;
function scan(buffer, location) {
  checked++;
  const value = buffer.toString('utf8');
  for (const [kind, pattern] of patterns) if (pattern.test(value)) findings.push({ location, kind });
  if (extra.some(secret => value.includes(secret))) findings.push({ location, kind: 'configured secret value' });
}
const paths = git('ls-files', '--cached', '--others', '--exclude-standard', '-z').toString().split('\0').filter(Boolean);
for (const path of new Set(paths)) { try { scan(readFileSync(path), path); } catch (error) { if (error.code !== 'ENOENT' && error.code !== 'EISDIR') throw error; } }
if (process.argv.includes('--bundle')) {
  function walk(path) { for (const entry of readdirSync(path, { withFileTypes: true })) { const child = join(path, entry.name); if (entry.isDirectory()) walk(child); else if (entry.isFile()) scan(readFileSync(child), child); } }
  walk('dist/client');
}
if (process.argv.includes('--history')) {
  const objects = git('rev-list', '--objects', '--all').toString().split('\n').filter(Boolean);
  for (const object of objects) {
    const [id, ...path] = object.split(' ');
    if (git('cat-file', '-t', id).toString().trim() === 'blob') scan(git('cat-file', 'blob', id), `history:${id.slice(0,8)}:${path.join(' ')}`);
  }
}
console.log(JSON.stringify({ checked, findings }, null, 2));
if (findings.length) process.exitCode = 1;
