# Towpath Studio

A browser site builder with an AI assistant: a Monaco code editor, a sandboxed live preview with Desktop, Tablet, and Mobile views, version history, and a chat that creates and edits the open project's files. Plain HTML, CSS, and JavaScript with no build step. Part of Kendall Clark's portfolio.

Case study: https://kendallclarkdesign.github.io/portfolio/case-study-towpath-studio

## How it works

- **Editor and preview.** Monaco loads from a CDN. The preview runs in a sandboxed iframe.
- **Projects and history.** Stored in the browser. `js/store.js` is the one file to swap for a database.
- **Chat.** `netlify/edge-functions/chat.mjs` streams model responses. An edge function is used because standard serverless functions cut long responses at about 30 seconds.
- **Keys stay on the server.** The browser never sees an API key. A server-side allowlist decides which models can be called, and a passphrase gates the chat.

## Run it

```
python3 -m http.server 8140
```

Chat needs the edge function, so use `netlify dev` for the full experience. Set these in your Netlify environment:

- `STUDIO_PASSPHRASE` (required)
- `OPENROUTER_API_KEY`, or `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`, depending on which engines you enable

## Status

A private tool, not a product. It has not been tested with other users.
