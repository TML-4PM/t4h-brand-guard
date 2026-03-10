/**
 * T4H Brand Guard — Supabase persistence step v1.1
 * GITHUB_RUN_NUMBER + SUPABASE_SERVICE_ROLE_KEY from env
 */
const https = require('https');
const fs = require('fs');

const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RUN = parseInt(process.env.GITHUB_RUN_NUMBER || '0', 10);
const FILE = '/tmp/brand-guard-results.json';

if (!KEY) { console.log('No SUPABASE_SERVICE_ROLE_KEY — skipping'); process.exit(0); }
if (!fs.existsSync(FILE)) { console.log('No results file — skipping'); process.exit(0); }

const results = JSON.parse(fs.readFileSync(FILE));
console.log(`Persisting ${results.length} rows (run #${RUN})`);

function upsert(row) {
  return new Promise((res) => {
    const body = JSON.stringify(row);
    const opts = {
      hostname: 'lzfgigiyqpuuxslsygjt.supabase.co',
      path: '/rest/v1/t4h_brand_state?on_conflict=slug',
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
    req.on('error', e => res({ status: 0, body: e.message }));
    req.write(body); req.end();
  });
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  let ok = 0, fail = 0;
  for (const r of results) {
    const injected = ['DONE','CREATED','ALREADY_DONE'].includes(r.status);
    const res = await upsert({
      slug:              r.slug,
      repo:              r.repo,
      brand_group:       r.group,
      status:            r.status,
      framework:         r.fw || null,
      brand_injected_at: injected ? new Date().toISOString() : null,
      last_checked_at:   new Date().toISOString(),
      run_number:        RUN,
      updated_at:        new Date().toISOString(),
    });
    if (res.status >= 200 && res.status < 300) {
      ok++;
    } else {
      fail++;
      console.warn(`  WARN ${r.slug}: HTTP ${res.status} — ${res.body.slice(0,120)}`);
    }
    await sleep(25);
  }
  console.log(`Supabase: ${ok} ok, ${fail} warn`);
  // Never fail the step — brand guard persists best-effort
}

main().catch(e => console.error('persist error:', e.message));
