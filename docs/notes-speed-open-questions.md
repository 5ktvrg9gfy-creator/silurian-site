# Notes speed: open questions

Branch `notes-speed`, 20 October 2026. Each question says what it blocks, the recommended default, and the cost if the default is wrong.

## Q1. Which region is the Blob store in?

**Blocks:** whether the London pin on the notes functions (commit "Notes speed (a)") should be merged as it is.

The notes functions now run in London (`lhr1`). Before, `vercel.json` set no region, so they ran in Vercel's default, Washington DC (`iad1`). Every note read and write is a call from the function to the Blob store. If the store is in London, the pin removes an Atlantic crossing from each of those calls. **If the store is in the US, the pin makes each call slower, not faster.** The code cannot tell which; only the Vercel dashboard can (steps in the build report).

**Recommended default:** James checks the store's region on the Preview before anything is merged. London store: merge as built. US store: drop commit (a) from the merge, or create a new store in London and move the notes, which is a separate job. The commit is on its own so it can be taken out alone.

**Cost if wrong:** merging the pin with a US store makes every action slower by roughly one Atlantic round trip per Blob call. The index and the page memory below still help. Undone by one line in `vercel.json`.

## Q2. First list after the deploy is slow once

**Blocks:** nothing.

The metadata index (`notes-index.json`) does not exist until the first list after the deploy. That list reads every note's metadata file once, as the old code did on every list, then writes the index. Every list after that reads the index and one listing. **Default:** accept it. **Cost if wrong:** one slow list, once.

## Q3. After a 401 the editor box still holds the last opened note

**Blocks:** nothing.

The new memory (rows and opened notes) is dropped on a 401, on sign out and when the page is left, and `browser-check-speed.mjs` proves it by searching the page's heap. Spotted while writing that check: on a 401 (not on Sign out) the existing code leaves the hidden note box and the open note's state as they were, so the last opened note's text stays in the page until it is left. That is how the page has always behaved and changing it could lose unsaved typing, so it is not touched. **Default:** leave it. **Cost if wrong:** text of one note stays in a hidden box on a page that is showing the sign-in screen, until the tab is closed or navigated.

## Q4. CLAUDE.md section 3 does not yet describe the index or the page memory

**Blocks:** nothing; documentation only.

Section 3 says notes are "two files per note" and lists `labels.json`. There is now a third file, `notes-index.json`, outside the `notes/` prefix: a copy of every note's metadata, checked against a fresh listing on every list (so it can cost a read but cannot show a stale row), never used for a version check. The page also asks for the whole list once (`view=all`) and cuts Notes, Archive and a label from it. **Default:** add one bullet to section 3 saying so, after James has seen the Preview. Not done here because the brief did not ask for a change to `CLAUDE.md`. **Cost if wrong:** the next session reads an incomplete description of the storage.

## Q5. Spotted, not built: first load asks for the session, then the list, one after the other

**Blocks:** nothing.

On opening `/notes` the page calls `/api/session`, waits, and only then asks for the list. The list answer is itself proof of a good session (the gate runs first), so both could be sent together and the page painted from the list answer. It would save one full round trip, including one function start, on every cold open. Not built: the brief names what to change, and the sign-out fix ("nothing painted before the session is confirmed") is the part of this page most worth leaving alone without a decision. **Default:** do it in its own change, with the sign-out browser check run against it. **Cost if wrong:** none; it is an opportunity.

## Q6. Spotted, not built: search still reads every note

**Blocks:** nothing.

Search went from 3N+1 Blob calls to N+2 (one listing, one index read, one text read per note). It cannot go lower without a copy of every note's text in another file, which would double what the store holds and put note text in a file the 1 MB limit and the conflict checks do not know about. **Default:** leave it. **Cost if wrong:** search stays the slowest action on a store with hundreds of notes.

## Q7. Spotted, not built: a text save is still four or five calls in a row

**Blocks:** nothing.

A save reads the version (two calls together), the label list when the note has labels, then writes the text and then the metadata. The two writes cannot go together without changing what a half-failed save leaves behind (a metadata file saying a newer time than the text), which would turn a failed save into a false "changed on another device". The conflict checks are to stay exactly as they are, so this is left. **Default:** leave it. **Cost if wrong:** typing saves take a little longer in the background; nothing waits for them.
