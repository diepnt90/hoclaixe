# hoclaixe - Cloudflare Worker reverse proxy

Reverse proxy for `https://sanlaisuat.netlify.app` at `https://meo600caulythuyetlaixe.store`.

## Deploy

1. Ensure the zone `meo600caulythuyetlaixe.store` is active in your Cloudflare account and you are authorized to proxy the upstream content.
2. Install Node.js then run `npx wrangler login`.
3. Run `npx wrangler deploy` from the repository root.
4. Test the home page, nested URLs, CSS/JS, images, video playback, forms and API requests using the browser network tab.

The Wrangler custom-domain route creates/manages the Worker domain mapping (including DNS and TLS) where permitted by the account/zone configuration.

## Important limitations

- This is an HTTP reverse proxy. URLs on sanlaisuat.netlify.app itself can be rewritten, but cross-domain fetches or dynamically constructed URLs may still call external hosts.
- Site security policies, upstream anti-bot protections, service workers, signed URLs, browser storage, WebSockets, some binary manifests and third-party integrations can require extra changes.
- Rewriting textual assets buffers them and removes the upstream Content-Security-Policy, so use only when authorized and review your security posture. No promise of a fully faithful mirror.
- Authentication/cookies and submitted form data pass through the proxy; disclose this to users and don't deploy this for third-party credential collection.
- No caching of rewritten text is enabled.

## Files

- `src/index.js`: proxy logic
- `wrangler.jsonc`: Cloudflare Workers configuration
