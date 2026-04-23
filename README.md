# Cloudflare Deployment

This folder contains a Cloudflare Workers version of the Business Planner app.

## Files

- `src/index.js`
  - Worker backend
  - serves `/api/providers`
  - serves `/api/generate`
  - serves static frontend assets through the `ASSETS` binding
- `public/`
  - current frontend files copied from the local app
- `wrangler.jsonc`
  - Worker configuration
- `package.json`
  - Wrangler scripts

## What you need to deploy

You need one of these:

1. `wrangler login`
2. or a Cloudflare API token with Workers deployment access

If you want me to deploy it for you, I need:

- `CLOUDFLARE_API_TOKEN`
- your Cloudflare `account_id`
- the Worker name you want, or confirmation to use `business-planner-ai`

Optional if you want a custom domain later:

- the domain already managed in Cloudflare

## Secrets to set in Cloudflare

Set only the ones you want to use:

- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `GEMINI_API_KEY`
- `GEMINI_MODEL`
- `GEMINI_FALLBACK_MODEL`
- `ANTHROPIC_API_KEY`
- `ANTHROPIC_MODEL`
- `CUSTOM_OPENAI_BASE_URL`
- `CUSTOM_OPENAI_API_KEY`
- `CUSTOM_OPENAI_MODEL`
- `CUSTOM_OPENAI_LABEL`

## Deploy commands

From this folder:

```powershell
npm.cmd install
npx wrangler login
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put GEMINI_API_KEY
npx wrangler deploy
```

If PowerShell blocks `npm`, use `npm.cmd` instead of `npm`.

## Auto deploy with GitHub

This project now includes a GitHub Actions workflow:

- [deploy.yml](C:\Users\QUIKCARE%20COMPUTERS\Documents\Codex\2026-04-21-i-want-to-create-an-ai\cloudflare-app\.github\workflows\deploy.yml)

When this folder is the root of a GitHub repository, every push to `main` will run `wrangler deploy`.

### GitHub repository secrets required

Add these in GitHub:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

### Recommended flow

1. Put `cloudflare-app` in its own GitHub repository
2. Add the two GitHub repository secrets above
3. Push to `main`
4. GitHub Actions will auto deploy to Cloudflare Workers

Cloudflare Worker secrets such as `OPENAI_API_KEY` and `GEMINI_API_KEY` stay in Cloudflare and do not need to be stored in GitHub if they are already set on the deployed Worker.

## Notes

- The Worker uses the same API shape as the local app, so the frontend should work with minimal changes.
- Secrets should be stored in Cloudflare, not committed in `.env`.
- Because the frontend relies on CDN-hosted libraries, the deployed app still expects normal internet access in the browser.
