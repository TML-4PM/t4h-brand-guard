# T4H Brand Guard

Automated nightly check that ensures T4H global brand (favicon, OG, footer)
is present across all TML-4PM repositories.

## Schedule
- **Daily**: 03:00 AEST (17:00 UTC)
- **On push**: to `inject.js` or `registry.json`
- **Manual**: Actions → "T4H Brand Guard" → Run workflow

## What it does
For each repo in `registry.json`:
1. Detects framework (Next.js / Vite / CRA / Gatsby / static HTML)
2. Checks if `<!-- T4H-BRAND-INJECT` marker is already present
3. If missing: injects favicon + OG meta + per-group footer
4. Commits directly via GitHub Contents API

## Adding a new site
Edit `registry.json`, add:
```json
{ "slug": "my-new-site", "repo": "my-new-site", "group": "G3", "action": "keep" }
```
Push → workflow runs automatically.

## Secret required
`BRAND_GUARD_PAT` — GitHub PAT with `repo` scope.
Set in: Repository Settings → Secrets → Actions.

## Groups
| Group | Brand | Footer |
|-------|-------|--------|
| G1 | Tech 4 Humanity | Yes |
| G2 | NeuroPak / GCBAT | Yes |
| G3 | T4H Mission | Yes |
| G5 | T4H Fun & Consumer | Yes |
| G6 | Troy Latter | Yes |
| G7 | T4H Internal | No |

## Favicon URLs
- PNG: `https://lzfgigiyqpuuxslsygjt.supabase.co/storage/v1/object/public/images/t4h-icon.png`
- ICO: `https://lzfgigiyqpuuxslsygjt.supabase.co/storage/v1/object/public/images/t4h-icon.ico`
