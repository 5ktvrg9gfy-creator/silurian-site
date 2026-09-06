# Build response 5: reading the design document against what is built

From: the build session (Claude Code, marketing site repository)
To: the design session, via James
Date: 6 September 2026
Against: `docs/designdecisions.md`, third revision, sha256 `18b2a2c6...73d`

The document is committed at **`docs/designdecisions.md`**, verbatim, and is already on `main`. Nothing in it was edited to produce this reading.

**It is intent, not authority.** `CLAUDE.md` section 2 has not been amended to name it, so where it disagrees with `tokens.css`, a test, or the built site today, they win and the disagreement is raised here rather than reconciled.

---

## 1. Conflicts with what is built

Six. Each is verified against the rendered page or the file, not read off the source.

### 1.1 Item 4 says the rollout is unfinished. It is finished and enforced.

The document: "Applied to `#about` on `index.html`. The rollout to the rest of `index.html`, `forecast-risk.html` and `privacy.html` is the remaining work." And: "Enforcement, after the rollout and not before."

Built: all three pages carry no hand-written size at all, and `MarketingSiteTypeScale` fails the build if one appears, reading the `font` shorthand as well as the longhand. The status line is stale by two rounds.

### 1.2 The poster step is used twice, not once.

The document, twice: "the closing line in the accent field, that field only" and "Poster is used once on the site, on the closing accent field."

Built: `--text-poster` is on `index.html`'s `.close h3` and on `forecast-risk.html`'s `.close h2`. Both are closing accent fields and both render 56px, unchanged from live. I read "that field only" as the closing field wherever it appears. **This was asked in response 3 and is still unanswered.** If one instance site-wide was meant, `forecast-risk.html`'s closing line has no step.

### 1.3 The paragraph is 352 characters, not 349.

The document states 349 twice, and builds a capacity calculation on it. The copy shipped is byte identical to the document's own text and measures 352.

### 1.4 The left column arithmetic is out by roughly double.

The document: the paragraph plus sub-note "leave the left column about 37px short of the list", and "The services list is 257.1px tall".

Measured at 1440: the list is **277.5px** tall and the left column finishes **75.5px** above it. The measure and leading in the note are now right. The list height is the piece still carrying the old number. The intent, an uneven edge with the list the heavier side, is achieved.

### 1.5 The constraint describes the homepage brand as a link. It is not one.

The document: "The brand block in the header is one link. The mark and the wordmark sit inside a single `<a>` to `index.html`."

Built: true on `privacy.html` and `forecast-risk.html`, which the constraint names. On `index.html` the mark and wordmark sit in a plain `<div>` with no anchor at all. I did not change a page the constraint did not name.

### 1.6 Two reference mocks are cited that do not exist in this repository.

The document names `Hero Layout Options.dc.html` and `Hero Paragraph Check.dc.html` as the reference mocks. Neither is in the repository, at the root or under `docs/`. They live in the design project.

This repeats a trap already recorded in `docs/marketing-site.md`: two files from the previous session existed only on a laptop, and a reference to a file nobody can open reads as a missing file rather than as a file held elsewhere. Worth one line in the document saying they are deliberately outside this repository.

## 2. Conflicts with `CLAUDE.md`, which currently outranks the document

Two, and both mean `CLAUDE.md` is the file that is now out of date, not the site. **I have changed neither.** `CLAUDE.md` is a shared file and amending section 9 is James's to route.

### 2.1 Zero radius

`CLAUDE.md` section 9: "**Zero radius everywhere.**" Stated absolutely, and named as enforced by `test_workspace_uses_approved_visual_tokens`.

The document: "Zero border radius anywhere, with one named exception: the email and LinkedIn contact badges are round. That was agreed by James before design was involved and is not up for revision."

The badges have been round in Production throughout. So `CLAUDE.md` has been describing a state the site does not have, which is exactly the class of fault this project has twice corrected elsewhere. The design document is right about the site; `CLAUDE.md` needs the exception written into it.

### 2.2 The accent is never a status palette

`CLAUDE.md` section 9: "Orange is spent as a mark or a field, never as a status palette." Again absolute.

The document agrees with the rule and records that `forecast-risk.html` breaks it, calling the breach defensible because risk status is the page's content. Built: that page carries `--color-status-good`, `--color-status-warn` and `--color-status-bad`, live today and shared with Assay by decision.

Same shape as 2.1. The document proposes writing it down as an exception scoped to that page. Until `CLAUDE.md` carries it, the rule as written says the live site is wrong.

### 2.3 One related note, not a conflict with the document

The document's constraint list says Archivo throughout. The contact badges are set in `font-family: Arial, sans-serif`, and are the only elements on the site not in Archivo. That is already an open question in `docs/marketing-site.md` and the design document does not mention it. Flagging so it is not discovered a third time.

## 3. Cannot act on: needs a decision

Seven items. None is a defect and none is blocking anything that is live.

1. **The poster step, once or per page.** See 1.2. One line either way.
2. **The homepage brand self-link.** See 1.5. Two lines.
3. **The status palette exception.** The document says it "must be written down as an exception scoped to this page or it will leak onto the homepage" but does not say where. My recommendation is `CLAUDE.md` section 9 alongside the radius exception, since that is where the absolute rule lives, and `CLAUDE.md` is shared so James routes it.
4. **The forecasting page voice.** "Company voice means one pronoun. Pick one." The pick has not been made. The homepage is first person plural, so that is the obvious answer, but it is a copy decision and not mine.
5. **The TimesFM notice.** The document says three sentences of borrowed credibility should go. It does not supply the replacement wording, and cutting client-facing copy without a replacement is not something I will do unprompted.
6. **The 12px label step on the forecasting page.** The document says panel subtitles and the chart legend should be body at 15px and the table should not drop to 12px on a phone. That partly reverses what was just rolled out there, and stopping the table dropping re-opens the 320px overflow the cell padding was tightened to fix. It is one job with a layout consequence, and it needs confirming that reversing part of the rollout is intended.
7. **The detail lines under domains 1 and 2.** They need James's own words. Shipped as drafted, sentence case only.

## 4. Cannot act on: needs an asset that does not exist

1. **The portrait of James.** Item 5 specifies it fully, plain background, straight to camera, black and white, placed in the lower grid under the paragraph at the paragraph's column width. There is no photograph. Nothing to build until one exists, and the specification is precise enough to build from the moment it does.
2. **The two reference mocks.** See 1.6. They cannot be opened from this repository, so any instruction that resolves by looking at them cannot be followed here.

## What this session cannot verify

No access to the live site, any preview, or a real device. Every measurement above is headless Chromium against `main`, which reproduces layout and colour faithfully and does not reproduce platform control styling at all.
