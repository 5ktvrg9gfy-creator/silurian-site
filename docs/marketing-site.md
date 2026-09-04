# Silurian marketing site: intent and conventions

Recorded: 4 September 2026.

This file preserves material that existed only in the ChatGPT Codex session that built the marketing site. That session is closed. Nothing here changes the site, and no code or copy was touched to write it.

It has two parts. Section one is intent as stated by the product owner, which is the least recoverable material and explains why the site is as it is. Section two is the conventions and traps a successor will not infer from the files. A third section records three facts that live outside this repository or outside `main`.

The site itself is `index.html` and `privacy.html` at the repository root. Process for changing it stays in `MAINTENANCE.md`, and release evidence stays in `PROJECT_HANDOFF.md`.

## 1. Intent, as stated by the product owner

- **The site is an identity page for the limited company.** It exists so the company can be found and verified. It is not intended to grow into an elaborate sales site, and a change that pushes it that way should be questioned before it is built.
- **The Bedrock artwork was the visual inspiration.** The faceted stone, the flat orange field and the paper ground come from it.
- **Rejected treatments.** Two approaches to the Assay link were considered and turned down: the large logo side treatments, and the neutral product card. What was wanted was a restrained dropdown in the header beside the company name. That is what shipped in pull request 67. The dropdown itself was then removed on 4 September 2026, on preference and not on any defect, once the product owner had seen it live. The header now carries a plain text link reading AI Demand Forecasting, pointing at `forecast-risk.html` so that a public visitor lands on a page explaining the offer rather than on the Assay password gate. Assay is reached from `forecast-risk.html`, not from the header.
- **Private company information does not go on the website.** It goes to SharePoint or a similar controlled store. Do not add a website backend to hold it.
- **Email harvesting mitigation was discussed and deliberately deferred.** The contact address is a plain `mailto:` link and is therefore machine readable. That is a known, accepted position, not an oversight.
- **The LinkedIn banner experiments were abandoned.** They are not pending work.

## 2. Conventions and traps for a successor

Each point below was checked against the files on 4 September 2026.

- **CSS authority.** The homepage is governed by the `<style>` blocks and tokens embedded in the root `index.html`. `styles.css` and `ds-styles.css` sit in the repository root but the homepage does not link them. Editing a similarly named standalone stylesheet will appear to do nothing. Read the embedded styles first.

  There is a second authority rule inside the file, and it is not the same rule. The first is that the file you are reading may not be the authority. The second is that **the declaration you are reading may not be the one that wins.** `index.html` holds three `<style>` blocks and defines several tokens more than once, and the last definition is the live one. Finding a token is not the same as finding its value: read every definition of it, then confirm against a rendered pixel.

  What that costs when ignored: `--color-divider` is `color-mix(in srgb, #3f3d3b 40%, transparent)` at line 28 and plain `#3f3d3b` at line 313, so every rule on the site is drawn solid and not at 40 percent. A change made from the first definition looked correct in the diff and rendered a header seam at `#b2b1b1` against the homepage's `#3f3d3b`. Only the pixels showed it. The same second block retunes `--color-accent` to `#ec6917` and adds `--color-accent-600: #d1601a` and `--color-accent-700: #8f3f0c`.

  Checked on 4 September 2026: no page in this repository references either file. There are four tracked HTML pages. `index.html`, `privacy.html` and `forecast-app/static/index.html` carry embedded styles and link no local stylesheet at all, and `forecast-risk.html` linked only the Google Fonts stylesheet, which was replaced with the self-hosted face on 4 September 2026 and now links nothing at all. `styles.css` and `ds-styles.css` are byte identical to each other, and their tokens are not the site's: the accent is red `#ec3013` and the text is `#201e1d`, where the live site uses orange `#ec6917` and charcoal `#3f3d3b`. They are reached only from `ds-base.js`, `readme.md` and `_ds_manifest.json`, which are Claude Design export files that no page loads. As far as every page in this repository is concerned, both stylesheets are dead. That is recorded as a finding, not as a proposal to remove them. Both files also `@import` Archivo from `fonts.googleapis.com` at line 2, which is dormant only because no page loads them. Anyone who links either file would reintroduce that request. The repository map in `PROJECT_HANDOFF.md` described these files as the shared visual system until 4 September 2026 and now describes them as the export files they are.
- **Structure.** In order: header, `#about` introduction and service lists, the large inline logo, the orange `#contact` section, footer. `privacy.html` is a separate page with its own embedded styles.
- **Logo duplication.** There are two separate representations of the mark. The large hero logo is inline SVG inside `index.html`. The header and the footer both use `logo-stone.svg`, which is also the favicon. Changing one does not change every instance. Check all three before calling a logo change complete.
- **Mobile.** Below 720px the large hero logo is hidden on purpose. It is not a broken image or a layout bug, and it should not be restored without asking. The service lists collapse to a single column at the same width, and the header navigation may wrap beneath the company name on narrow screens. That wrap is accepted behaviour.
- **Typography.** Archivo is self hosted from `assets/fonts/Archivo-Variable.ttf` and its SIL Open Font Licence is retained at `assets/fonts/OFL.txt`. Keep both. The header link is set at 15.5px to match the real service text on the page, not at the 12px used in the mockup. The mockup is not the reference for size. That 15.5px carried over from the dropdown it replaced.
- **Auditing colour.** A hex scan is not a colour scan. The same value can be written as a hex, as `rgb()` or `rgba()`, inside a `color-mix()`, or as a canvas literal in script, and a search for `#ee7623` finds none of the others. Correcting this page's accent meant changing two hex occurrences and two `rgba(238,118,35, ...)` occurrences that a hex scan had already reported as clean. Sample the rendered pixels to confirm a colour change, on both the page and, where a canvas is involved, after the drawing has run.
- **Status colours are a cross-product decision.** `forecast-risk.html` uses `#356b46` good, `#9a5a12` warn and `#a52a1f` bad. These three have no equivalent in the site token set, they appear nowhere in the Claude Design export, and Assay uses the same three values in `forecast-app/static/index.html`. They are therefore a deliberate choice shared across both products, not a stray import. Changing them on one side without the other splits the pair, so decide both together and record it. The four remaining unmapped values on this page, `#66615f` muted, `#77716e` inventory line, `#d1cdca` gridlines and `#e3dfdd` reversed copy, are likewise held by decision on 4 September 2026 and are not oversights.
- **The homepage runs no JavaScript.** `index.html` contains no `<script>` of any kind, since the header dropdown that needed one was removed on 4 September 2026. That is worth keeping. The page needs no framework, no analytics and no interaction handler to do its job, and every script added is something a visitor downloads and a reviewer has to reason about. Add one deliberately, with a stated reason, or not at all.
- **Deployment.** The marketing site deploys from the Vercel project `silurian-site`: repository root, framework preset Other, no build command, production branch `main`. Assay deploys separately from `forecast-app/` through the project `silurian-forecast-diagnostic`. A pull request therefore shows two Vercel checks. The second is expected and is not an accidental duplicate. Confirm the check that belongs to the component you changed.
- **Preview verification.** An anonymous request to a Vercel preview URL can return the Vercel login page with HTTP 200. A 200 alone does not prove the preview loaded. Check the returned content, not the status code. Verify previews in a signed in browser.
- **Source of truth is GitHub.** Not a local checkout, and not a design export. Transfer intended changes into a branch rather than overwriting the repository with an export.

## 3. Facts that are not visible in a clone

### Archived branch, kept deliberately

Branch `archive/story-1-2-local-5e994d5`, at commit `5e994d55a279bc2d5d935eb28bf42d4c522f63a6`, holds a commit that existed only on the product owner's laptop. It was pushed under a new name during the Codex shutdown because the original branch had diverged. It is unreviewed, it is unmerged, and its content has not been reconciled against `main`.

It is kept on purpose. Do not merge it, do not delete it, and do not treat it as stale housekeeping.

### Two files that exist outside Git

Two files live on the product owner's laptop under a Codex session folder and are not in this repository. They will not follow a clone and are not recoverable from GitHub:

- `assay-link-options.html`, the dropdown mockup.
- `check-assay-header.cjs`, a browser check script for the header.

They are recorded here so that a reference to either is recognised rather than searched for.
