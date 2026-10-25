# Blob operations, before, cold instances

| Action | Advanced | Simple | del |
|---|---:|---:|---:|
| journal open and idle for one hour, focused | 320 | 6880 | 0 |
| journal open and idle for one hour, visible, not focused | 320 | 6880 | 0 |
| journal open and idle for one hour, hidden | 0 | 0 | 0 |
| notes open and idle for one hour, on the list | 0 | 0 | 0 |
| notes open and idle for one hour, on the a note being edited | 0 | 0 | 0 |
| journal: open (page load, signed in) | 4 | 86 | 0 |
| journal: open again (a second device, or a reload) | 4 | 86 | 0 |
| journal: add an entry in Today | 1 | 0 | 0 |
| journal: move that entry to Tomorrow (keyboard buttons) | 2 | 1 | 0 |
| journal: edit an entry and tick another | 2 | 2 | 0 |
| journal: type a calendar line in Month | 1 | 0 | 0 |
| journal: make a span from that line (Until, three days) | 2 | 1 | 0 |
| journal: switch back to the window after six minutes (focus) | 36 | 810 | 0 |
| journal: switch back to the window again after one minute (focus) | 8 | 180 | 0 |
| journal: type in Quick notes for one minute | 25 | 197 | 0 |
| notes: open the list (page load, signed in) | 2 | 2 | 0 |
| notes: open a note | 2 | 3 | 0 |
| notes: type for one minute (bursts with short pauses) | 36 | 78 | 0 |
| notes: give the open note a label | 3 | 14 | 0 |
| notes: archive the open note | 7 | 47 | 0 |
| notes: go back to the list after editing (the list is asked for again) | 2 | 16 | 0 |
| notes: search for a word | 1 | 55 | 0 |
| notes: list after one note collected 8 settled revisions (cleanup) | 2 | 2 | 1 |
| notes: the same list again straight after | 1 | 1 | 0 |
| notes: one save with no cleanup due | 3 | 1 | 0 |

Typical day: advanced 301, simple 4160
