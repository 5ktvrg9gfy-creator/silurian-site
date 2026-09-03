# The access gate

A single password in front of the whole Forecast Diagnostic. Vercel's own
password protection is a paid feature, so this is the unpaid substitute. It is
deliberately small.

## How it behaves

The application reads the environment variable `SILURIAN_ACCESS_PASSWORD` on
every request.

- **Variable unset or blank.** The application runs exactly as before. Local
  development and the test suite are unaffected.
- **Variable set.** Nothing is served until the password is entered. The
  landing page, every upload and analysis endpoint, both sample CSV files, the
  health endpoint and the stone mark all answer 401. A browser gets the gate
  screen. A request to a path under `/api/` gets `{"detail": "Access is
  restricted"}` as JSON, so a fetch fails cleanly instead of parsing a login
  page as a result.

Entering the correct password sets a signed cookie that lasts twelve hours, so a
planner working through a test pack is asked once.

One line is logged at startup, naming the state and nothing else:

```
Silurian access gate: on
```

## What the password never touches

It is read from the environment, held for the length of one request and compared
with `hmac.compare_digest`. It is not written to disk, not logged, not sent to
the browser, and not recorded in a run manifest or a confidential bundle. The
manifest environment block records five named values only, and the gate is not
one of them.

The cookie carries an expiry and a signature over that expiry. It does not carry
the password. The signing key is derived from the password, so changing the
password in Vercel invalidates every cookie already issued, with nothing else to
clear.

There is no default value anywhere in this repository, and no placeholder that
looks like one.

## Turning it on

1. Sign in at `https://vercel.com` and open the **silurian-forecast-diagnostic**
   project.
2. Go to **Settings**, then **Environment Variables** in the left column.
3. In **Key**, type `SILURIAN_ACCESS_PASSWORD` exactly, capitals included.
4. In **Value**, type the password you want. Pick something long. Nobody needs to
   remember it more than once a day, so length costs you nothing.
5. Tick **Production**, **Preview** and **Development** so the gate is on
   everywhere. Leaving Preview unticked leaves every preview URL open.
6. Save.
7. Go to **Deployments**, open the most recent Production deployment, and use the
   menu on the right to **Redeploy**. An environment variable only reaches the
   running application on a new deployment.
8. When the redeploy finishes, open `https://silurian-forecast-diagnostic.vercel.app/`
   in a private browser window. You should see the gate screen. Enter the
   password once and the tool should open.

Changing the password later is the same sequence, editing the value at step 3.
Everyone signed in is asked again on their next request.

Removing the gate is the same sequence, deleting the variable instead, followed
by a redeploy.

## What this is not

Worth knowing before it is relied on:

- **One shared password, no accounts.** There is no record of who entered it.
  Anyone with the password has everything, and it cannot be revoked for one
  person without changing it for everyone.
- **A wrong attempt costs a fixed one second delay, which is not a rate limit.**
  A determined attacker can run attempts in parallel. Real rate limiting needs
  state shared between serverless instances, which this application deliberately
  does not have. A long password is the control here, not the delay.
- **It protects what the service serves, not what has already left it.** A
  downloaded confidential bundle is unaffected by the gate.
- **The typeface is served before the password.** `Archivo-Variable.ttf` is the
  one exempt path, so the gate screen renders in the right font. It is a
  typeface and carries nothing about the tool. The stone mark is drawn inline in
  the gate page rather than exempted, so it is the only exemption.
- **Vercel's own deployment protection is stronger** because it never reaches the
  application at all. If the project moves to a paid plan, prefer it and delete
  this.

## Where it lives

- `forecast-app/access_gate.py`, the whole mechanism.
- `forecast-app/app.py`, one middleware and the two `/access` routes. The
  middleware is registered last so it wraps every other route and runs first.
- `forecast-app/tests/test_access_gate.py`, 24 tests.

Seven deliberate probes were run and reverted, each failing the control it was
aimed at: the gate passing everyone through, `==` in place of the constant time
comparison, a committed default password, a second asset exempted, the cookie
expiry no longer enforced, a refusal that hints at configuration, and the gate
screen abandoning the design system. The first version of the constant time test
passed the `==` probe, because it searched the whole module and the cookie check
uses `compare_digest` a few lines away. It now reads only the function it is
about. That is the reason the probes are run at all.
