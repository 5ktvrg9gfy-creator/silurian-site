# Site public allowlist: open questions

Branch `site-public-allowlist`. Format per CLAUDE.md section 1. Two questions are waiting. Q1 was answered yes by the product owner on 18 October 2026 and built: one line in CLAUDE.md section 3.

## Q1. CLAUDE.md section 3 does not yet say that new public files need the allowlist (ANSWERED, done)

- **Blocks:** nothing built. A future session adding a page or an asset will find it answers 404 until it is added to `site-allowlist.txt` and to `PUBLIC_FILES` in `forecast-app/tests/test_marketing_deploy_allowlist.py`. The tests say so when they fail, but a rule in section 3 would say it first. The brief did not ask for a CLAUDE.md change.
- **Recommended default:** add two sentences to section 3 in this branch or the next small one.
- **Cost if wrong:** one failed build and a read of the test message.

## Q2. Rebasing the notes page onto this fix needs three things

- **Blocks:** the `notes-page` branch, not this one. (a) Both branches add a root `vercel.json`, so the keys merge: this fix's build settings plus the notes rewrite and headers. (b) `notes-tests/site.test.js` pins the `vercel.json` keys to exactly three and must allow the two new ones. (c) `notes/` goes into `site-allowlist.txt` and `PUBLIC_FILES`.
- **Unverified:** that the root `api/` functions still deploy when `outputDirectory` is `public`. Vercel builds functions from `api/` separately from static output, so it should, but it has not been seen. The notes Preview is where it shows.
- **Cost if wrong:** the notes routes 404 on the first Preview and the fix is a `vercel.json` setting.

## Q3. The Vercel dashboard may have project settings that disagree

- **Blocks:** nothing built. `vercel.json` settings override the project's dashboard settings, so a stale Output Directory or Build Command there should not matter. It was not visible from here.
- **Check:** on the Preview, `/CLAUDE.md` answers 404. That settles it.
- **Cost if wrong:** the dashboard setting has to be cleared by hand.
