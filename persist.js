/**
 * T4H Brand Guard — Supabase persistence step
 * Called as: SUPABASE_SERVICE_ROLE_KEY=... GITHUB_RUN_NUMBER=... node persist.js
 */
const https = require('https');
const fs = require('fs');

const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RUN = parseInt(process.env.GITHUB_RUN_NUMBER || '0', 10);
const RESULTS_FILE = '/tmp/brand-guard-results.json';

if (!KEY) { console.log('No SUPABASE_SERVICE_ROLE_KEY — skipping persistence'); process.exit(0); }
if (!fs.existsSync(RESULTS_FILE)) { console.log('No results file — skipping persistence'); process.exit(0); }

const results = JSON.parse(fs.readFileSync(RESULTS_FILE));
console.log(`Persisting ${results.length} brand state rows to Supabase (run #${RUN})`);

function upsert(row) {
  return new Promise((res, rej) => {
    const body = JSON.stringify(row);
    const opts = {
      hostname: 'lzfgigiyqpuuxslsygjt.supabase.co',
      path: '/rest/v1/t4h_brand_state',
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + KEY,
        'apikey': KEY,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=minimal',
        'Content-Length': Buffer.byteLength(body),
      }
    };
    const req = https.request(opts, r => {
      let d = ''; r.on('data', c => d += c);
      r.on('end', () => res({ status: r.statusCode, body: d }));
    });
    req.on('error', rej);
    req.write(body); req.end();
  });
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  let ok = 0, fail = 0;
  for (const r of results) {
    const injected = ['DONE','CREATED','ALREADY_DONE'].includes(r.status);
    try {
      const res = await upsert({
        slug: r.slug,
        repo: r.repo,
        brand_group: r.group,
        status: r.status,
        framework: r.fw || null,
        brand_injected_at: injected ? new Date().toISOString() : null,
        last_checked_at: new Date().toISOString(),
        run_number: RUN,
        updated_at: new Date().toISOString(),
      });
      if (res.status < 300) ok++;
      else { fail++; console.error(`Failed ${r.slug}: ${res.status} ${res.body}`); }
    } catch(e) {
      fail++;
      console.error(`Error ${r.slug}: ${e.message}`);
    }
    await sleep(30); // avoid Supabase rate limit
  }
  console.log(`Done: ${ok} ok, ${fail} failed`);
  if (fail > 0) process.exitCode = 1;
}

main().catch(e => { console.error(e); process.exit(1); });
