# Silurian Consulting Limited

Static one-page site. No build step, no dependencies to install.

## Files

- `index.html` — the whole page
- `logo-stone.svg` — the mark, used in the masthead, the footer and the favicon
- `ds-base.js` — loads the design system stylesheet and bundle
- `_ds/modernist-92159db2-5872-4fbd-a307-0240b1312438/` — the Modernist design system (stylesheet, tokens, components)

Archivo is loaded from Google Fonts at runtime.

## Deploy

1. Create a GitHub repository and push the contents of this folder to the root of the default branch.
2. In Vercel, New Project, import the repository.
3. Framework preset: Other. Build command: leave empty. Output directory: leave empty (root).
4. Deploy.

Vercel serves `index.html` at the root. Add a custom domain under Project Settings, Domains.

## Before going public

- Replace the email address in the contact banner.
- Add the company number and registered office in the footer.
