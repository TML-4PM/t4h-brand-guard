/**
 * T4H Brand Injection Engine v2
 * Self-contained — no npm install required (uses built-in https)
 * Called by GitHub Actions with GITHUB_PAT env var
 */
const https = require('https');
const fs = require('fs');

const ORG = 'TML-4PM';
const PAT = process.env.GITHUB_PAT;
const MARKER = '<!-- T4H-BRAND-INJECT';
const FAVICON_PNG = 'https://lzfgigiyqpuuxslsygjt.supabase.co/storage/v1/object/public/images/t4h-icon.png';
const FAVICON_ICO = 'https://lzfgigiyqpuuxslsygjt.supabase.co/storage/v1/object/public/images/t4h-icon.ico';

const GROUP_BRAND = {
  G1: { accent:'#6366f1', copyright:'© 2026 Tech 4 Humanity Ltd', links:[{l:'Partner Program',h:'https://holoorg.vercel.app/wholesale'}], footer:true },
  G2: { accent:'#8b5cf6', copyright:'© 2026 Tech 4 Humanity Ltd', links:[{l:'NeuroPak',h:'https://neuropak.vercel.app'}], footer:true },
  G3: { accent:'#0ea5e9', copyright:'© 2026 Tech 4 Humanity Ltd', links:[{l:'Tech 4 Humanity',h:'https://tech4humanity.com.au'}], footer:true },
  G5: { accent:'#f59e0b', copyright:'© 2026 Tech 4 Humanity Ltd', links:[{l:'More T4H Projects',h:'https://tech4humanity.com.au'}], footer:true },
  G6: { accent:'#10b981', copyright:'© 2026 Troy Latter / Tech 4 Humanity Ltd', links:[{l:'LinkedIn',h:'https://linkedin.com/in/troylatter'}], footer:true },
  G7: { accent:'#64748b', copyright:'© 2026 Tech 4 Humanity Ltd', links:[], footer:false },
};

const SITE_REGISTRY = require('./registry.json');

function ghReq(method, path, body) {
  return new Promise((res, rej) => {
    const opts = {
      hostname: 'api.github.com', path, method,
      headers: {
        'Authorization': `Bearer ${PAT}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'T4H-Brand-Guard/2.0',
        'Content-Type': 'application/json',
      }
    };
    const req = https.request(opts, r => {
      let d = '';
      r.on('data', c => d += c);
      r.on('end', () => { try { res({ status: r.statusCode, body: JSON.parse(d) }); } catch { res({ status: r.statusCode, body: d }); }});
    });
    req.on('error', rej);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function getFile(repo, path) {
  const { status, body } = await ghReq('GET', `/repos/${ORG}/${repo}/contents/${path}`);
  if (status !== 200) return null;
  return { content: Buffer.from(body.content, 'base64').toString('utf8'), sha: body.sha, path };
}

async function putFile(repo, path, content, sha, msg) {
  const { status, body } = await ghReq('PUT', `/repos/${ORG}/${repo}/contents/${path}`, {
    message: msg, content: Buffer.from(content).toString('base64'), ...(sha ? { sha } : {})
  });
  return { ok: [200,201].includes(status), err: body.message || '' };
}

async function getPkgDeps(repo) {
  const f = await getFile(repo, 'package.json');
  if (!f) return [];
  try { const p = JSON.parse(f.content); return Object.keys({...p.dependencies,...p.devDependencies}); } catch { return []; }
}

async function detectAndGetFile(repo, deps) {
  const d = new Set(deps);
  const tryFiles = async (files) => { for (const f of files) { const r = await getFile(repo, f); if (r) return r; } return null; };
  if (d.has('next')) {
    const f = await tryFiles(['app/layout.tsx','app/layout.jsx','pages/_document.tsx','pages/_document.js']);
    return { fw: 'nextjs', file: f, create: !f ? 'pages/_document.tsx' : null };
  }
  if (d.has('vite') || d.has('@vitejs/plugin-react')) {
    return { fw: 'vite', file: await tryFiles(['index.html','src/index.html']) };
  }
  if (d.has('react-scripts')) {
    return { fw: 'cra', file: await tryFiles(['public/index.html']) };
  }
  if (d.has('gatsby')) {
    return { fw: 'gatsby', file: await tryFiles(['src/html.js']) };
  }
  return { fw: 'static', file: await tryFiles(['index.html','src/index.html','public/index.html','index']) };
}

function headHtml(group) {
  return `${MARKER} v1 group=${group} -->
<link rel="icon" type="image/png" sizes="32x32" href="${FAVICON_PNG}">
<link rel="icon" type="image/x-icon" href="${FAVICON_ICO}">
<link rel="apple-touch-icon" href="${FAVICON_PNG}">
<meta property="og:image" content="${FAVICON_PNG}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${FAVICON_PNG}">
<!-- /T4H-BRAND-INJECT -->`;
}

function headJsx(group) {
  return `        {/* ${MARKER} v1 group=${group} */}
        <link rel="icon" type="image/png" sizes="32x32" href="${FAVICON_PNG}" />
        <link rel="icon" type="image/x-icon" href="${FAVICON_ICO}" />
        <link rel="apple-touch-icon" href="${FAVICON_PNG}" />
        <meta property="og:image" content="${FAVICON_PNG}" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:image" content="${FAVICON_PNG}" />
        {/* /T4H-BRAND-INJECT */}`;
}

function footerHtml(brand) {
  if (!brand.footer) return '';
  const links = brand.links.map(l => `  <a href="${l.h}" style="color:${brand.accent};margin:0 12px;text-decoration:none">${l.l}</a>`).join('\n');
  return `${MARKER}-FOOTER v1 -->
<footer style="background:#0f0f0f;color:#888;padding:32px 20px;text-align:center;font-size:13px;margin-top:40px;border-top:1px solid #222">
${links}
  <div style="margin-top:16px;font-size:11px;opacity:0.6">${brand.copyright}</div>
</footer>
<!-- /T4H-BRAND-INJECT-FOOTER -->`;
}

function buildNextjsDoc(group) {
  return `import { Html, Head, Main, NextScript } from 'next/document'
export default function Document() {
  return (
    <Html lang="en">
      <Head>
${headJsx(group)}
      </Head>
      <body><Main /><NextScript /></body>
    </Html>
  )
}
`;
}

function patchHtml(content, group, brand) {
  if (content.includes(MARKER)) return null;
  let n = content.replace(/(< \/head>)/i, `${headHtml(group)}\n$1`).replace(/<\/head>/i, `${headHtml(group)}\n</head>`);
  const ft = footerHtml(brand);
  if (ft) n = n.replace(/<\/body>/i, `${ft}\n</body>`);
  return n !== content ? n : null;
}

function patchJsx(content, group) {
  if (content.includes(MARKER)) return null;
  const n = content.replace(/(<[Hh]ead[^>]*>)/, `$1\n${headJsx(group)}`);
  return n !== content ? n : null;
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function processRepo(repo, group) {
  const brand = GROUP_BRAND[group] || GROUP_BRAND.G1;
  const deps = await getPkgDeps(repo); await sleep(100);
  const { fw, file, create } = await detectAndGetFile(repo, deps); await sleep(100);

  if (create) {
    const doc = buildNextjsDoc(group);
    const r = await putFile(repo, create, doc, null, `feat: add T4H global brand [${group}]`);
    await sleep(250);
    return { status: r.ok ? 'CREATED' : 'ERROR', fw, detail: r.ok ? create : r.err };
  }
  if (!file) return { status: 'NO_FILE', fw };
  if (file.content.includes(MARKER)) return { status: 'ALREADY_DONE', fw };

  const patched = fw === 'nextjs' ? patchJsx(file.content, group) : patchHtml(file.content, group, brand);
  if (!patched) return { status: 'PATCH_FAILED', fw, detail: file.path };

  const r = await putFile(repo, file.path, patched, file.sha, `feat: add T4H global brand (favicon+OG+footer) [${group}]`);
  await sleep(250);
  return { status: r.ok ? 'DONE' : 'ERROR', fw, detail: r.ok ? file.path : r.err };
}

async function main() {
  if (!PAT) { console.error('GITHUB_PAT not set'); process.exit(1); }

  // Get all org repos for cross-check
  let orgRepos = new Set();
  let page = 1;
  while (true) {
    const { body } = await ghReq('GET', `/user/repos?per_page=100&page=${page}&type=owner`);
    if (!Array.isArray(body) || !body.length) break;
    body.forEach(r => orgRepos.add(r.name));
    if (body.length < 100) break;
    page++;
    await sleep(200);
  }

  const results = [];
  const sites = SITE_REGISTRY.filter(s => s.action === 'keep' && s.repo);
  console.log(`\nT4H Brand Guard — checking ${sites.length} repos\n`);

  for (let i = 0; i < sites.length; i++) {
    const { slug, repo, group } = sites[i];
    if (!orgRepos.has(repo)) {
      console.log(`[${i+1}/${sites.length}] ${repo} SKIP (not in org)`);
      results.push({ slug, repo, status: 'NOT_IN_ORG', group });
      continue;
    }
    process.stdout.write(`[${i+1}/${sites.length}] ${repo} (${group}) ... `);
    const r = await processRepo(repo, group);
    results.push({ slug, repo, group, ...r });
    const icon = {DONE:'✅',CREATED:'✅',ALREADY_DONE:'⏭',NOT_IN_ORG:'🔍',NO_FILE:'❓',PATCH_FAILED:'⚠️',ERROR:'❌'}[r.status]||'?';
    console.log(`${icon} ${r.status} [${r.fw||'?'}] ${r.detail||''}`);
  }

  // Write summary
  const counts = results.reduce((a,r)=>{a[r.status]=(a[r.status]||0)+1;return a},{});
  console.log('\n--- SUMMARY ---');
  Object.entries(counts).forEach(([k,v])=>console.log(`  ${k}: ${v}`));

  const failed = results.filter(r=>['ERROR','PATCH_FAILED','NO_FILE'].includes(r.status));
  if (failed.length) {
    console.log('\nNeeds attention:');
    failed.forEach(r=>console.log(`  ${r.repo}: ${r.status} ${r.detail||''}`));
    process.exitCode = 1;
  }

  fs.writeFileSync('/tmp/brand-guard-results.json', JSON.stringify(results, null, 2));
}

main().catch(e=>{ console.error(e); process.exit(1); });
