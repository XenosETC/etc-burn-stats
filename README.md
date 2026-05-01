# ETC Burn Stats

Static dashboard for checking dead LP burn percentages on Ethereum Classic tokens.
It runs entirely in the browser from `index.html`, `styles.css`, and `app.js`.

## Data Source

The app reads public token data from the ETC Blockscout v2 API:

- Token metadata and holder count
- LP token total supply and holder count
- LP balances held by burn addresses

Dead LP is calculated as:

```text
(LP held by 0x0000000000000000000000000000000000000000 + 0x000000000000000000000000000000000000dEaD) / total LP supply
```

## Included Tokens

The default project list is defined in `app.js` and currently includes:

- PUPU
- PEPE
- SHIBC

## Run locally

Open `index.html` directly in a modern browser, or serve the folder with any static server:

```powershell
python -m http.server 8080
```

Then open `http://localhost:8080`.

No install, bundler, or build command is required.

You can also use the npm helpers if Node is available:

```powershell
npm run build
npm start
```

## Add Projects

Use the form in the app to add another ETC token and LP pair. Custom projects are saved in the browser's `localStorage`, so they stay local to that browser profile.

To ship a project by default, add it to `defaultProjects` in `app.js` with:

- `name`
- `label`
- `token`
- `lp`

## Deploy

This repo is Render-ready as a static site. The included `render.yaml` defines:

- Service type: Static Site (`type: web`, `runtime: static`)
- Build command: `npm run build`
- Publish directory: `./dist`
- Dependency install skip: `SKIP_INSTALL_DEPS=true`

To deploy on Render:

1. Push this folder to a GitHub/GitLab/Bitbucket repo.
2. In Render, choose Blueprint and select the repo, or choose New > Static Site.
3. If creating manually, use:
   - Build Command: `npm run build`
   - Publish Directory: `./dist`

You can also deploy the folder as static files on GitHub Pages, Netlify, Cloudflare Pages, Vercel static output, or a plain web server. Publish these files together:

- `index.html`
- `styles.css`
- `app.js`
- `render.yaml`
- `preview.png`

The deployed page needs browser access to `https://etc.blockscout.com/api/v2`.

## Notes

- This is a read-only dashboard and does not connect to a wallet.
- Values depend on Blockscout API availability and token metadata.
- Burn percentage is an LP custody signal, not a full project risk assessment.
- Always verify contract addresses before relying on the result.
