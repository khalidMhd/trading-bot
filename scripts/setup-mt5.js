const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ENV_PATH = path.join(__dirname, '..', '.env');

function findMt5Paths() {
  const found = [];
  const roots = [
    process.env.ProgramFiles,
    process.env['ProgramFiles(x86)'],
    path.join(process.env.APPDATA || '', 'MetaQuotes', 'Terminal'),
    path.join(process.env.LOCALAPPDATA || '', 'Programs'),
    'C:\\Program Files',
    'D:\\Program Files',
  ].filter(Boolean);

  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    scanDir(root, found, 0, 4);
  }

  return [...new Set(found)];
}

function scanDir(dir, found, depth, maxDepth) {
  if (depth > maxDepth) return;

  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isFile() && entry.name.toLowerCase() === 'terminal64.exe') {
      found.push(full);
      continue;
    }
    if (entry.isDirectory()) {
      const lower = entry.name.toLowerCase();
      if (['node_modules', 'windows', 'microsoft', 'cache'].includes(lower)) continue;
      if (lower.includes('meta') || lower.includes('mt5') || lower.includes('terminal') || depth < 2) {
        scanDir(full, found, depth + 1, maxDepth);
      }
    }
  }
}

function readEnv() {
  if (!fs.existsSync(ENV_PATH)) return {};
  const lines = fs.readFileSync(ENV_PATH, 'utf8').split('\n');
  const env = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx > 0) env[trimmed.slice(0, idx)] = trimmed.slice(idx + 1);
  }
  return env;
}

function writeEnv(updates) {
  const current = readEnv();
  const merged = { ...current, ...updates };
  // Never override USE_MT5=false — user chose cloud/Yahoo mode
  if (current.USE_MT5 === 'false') {
    merged.USE_MT5 = 'false';
  }
  const lines = [
    '# Gold Signal Bot configuration (auto-managed by setup)',
    `USE_MT5=${merged.USE_MT5 ?? 'true'}`,
    `MT5_SYMBOL=${merged.MT5_SYMBOL ?? 'XAUUSD'}`,
  ];
  if (merged.MT5_PATH) lines.push(`MT5_PATH=${merged.MT5_PATH}`);
  if (merged.PORT) lines.push(`PORT=${merged.PORT}`);
  if (merged.POLL_INTERVAL_MS) lines.push(`POLL_INTERVAL_MS=${merged.POLL_INTERVAL_MS}`);
  if (merged.SIGNAL_THRESHOLD) lines.push(`SIGNAL_THRESHOLD=${merged.SIGNAL_THRESHOLD}`);
  if (merged.ADX_MIN) lines.push(`ADX_MIN=${merged.ADX_MIN}`);
  if (merged.MIN_CONFLUENCE) lines.push(`MIN_CONFLUENCE=${merged.MIN_CONFLUENCE}`);
  if (merged.MIN_EDGE) lines.push(`MIN_EDGE=${merged.MIN_EDGE}`);
  if (merged.USE_H1_FILTER != null) lines.push(`USE_H1_FILTER=${merged.USE_H1_FILTER}`);
  if (merged.TWELVE_DATA_API_KEY) lines.push(`TWELVE_DATA_API_KEY=${merged.TWELVE_DATA_API_KEY}`);
  if (merged.OANDA_API_TOKEN) lines.push(`OANDA_API_TOKEN=${merged.OANDA_API_TOKEN}`);
  fs.writeFileSync(ENV_PATH, lines.join('\n') + '\n');
}

function isMt5Running() {
  try {
    const out = execSync('tasklist /FI "IMAGENAME eq terminal64.exe" /NH', { encoding: 'utf8' });
    return out.toLowerCase().includes('terminal64.exe');
  } catch {
    return false;
  }
}

function main() {
  const env = readEnv();
  if (env.USE_MT5 === 'false') {
    console.log('=== MT5 Setup Skipped ===');
    console.log('USE_MT5=false in .env — using Yahoo/OANDA cloud prices.');
    return;
  }

  const paths = findMt5Paths();
  const running = isMt5Running();

  console.log('=== MT5 Setup Check ===');
  console.log(`MT5 running: ${running ? 'YES' : 'NO'}`);
  console.log(`MT5 installs found: ${paths.length}`);

  if (paths.length > 0) {
    paths.forEach((p, i) => console.log(`  ${i + 1}. ${p}`));
    writeEnv({ USE_MT5: 'true', MT5_PATH: paths[0] });
    console.log(`\nUpdated .env with MT5_PATH=${paths[0]}`);
  } else {
    console.log('\nMT5 is NOT installed on this PC.');
    console.log('Download from: https://www.metatrader5.com/en/download');
    console.log('After install: open MT5, log in, then run START.bat again.');
    try {
      execSync('start https://www.metatrader5.com/en/download', { shell: true });
      console.log('Opened MT5 download page in your browser.');
    } catch {}
  }

  if (!running && paths.length > 0) {
    console.log('\nStarting MetaTrader 5...');
    try {
      execSync(`start "" "${paths[0]}"`, { shell: true });
      console.log('MT5 launched. Log in to your broker account, then run START.bat');
    } catch (err) {
      console.log('Could not auto-start MT5:', err.message);
    }
  }
}

main();
