# Playwright HAR plugin

This plugin was added by `har env add-plugin playwright`. It registers a `browser-e2e` stage and a smoke suite adapted to this Next.js + Supabase app.

## Next steps

```bash
npm install
npx playwright install chromium
./.har/launch.sh 1
./.har/stages/browser-e2e.sh 1
```

Named handoff screenshots land in `.har/artifacts/browser-e2e/handoff/` (main checkout). Read those PNGs into the session handoff.

See `.har/stages/PLAYWRIGHT.md` for the adaptation checklist and handoff contract.
