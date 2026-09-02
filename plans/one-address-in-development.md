# One address in development, not three

**Goal:** Make everything you look at while working &mdash; the site, the games in it,
and the review page &mdash; live at one address on one server, the way the published
site already does, so there is nothing to be confused about.

**Not doing:**

- No change to the review page itself, or to how the site looks or works.
- No change to the published site or how it is built. `dist/` already is one website;
  this makes development match it.
- No change to FishyBird's separate page. That is the next plan, and it is the other
  half of the same job.
- Nothing about the lexicon, the spreadsheet, or any Klallam text.

## Background you need to read the steps

Three separate servers exist today, each with its own address:

- `site:dev` serves the site: the hub, the games inside it, the recordings at
  `/audio/` and the Klallam font at `/fonts/`.
- `game:dev` serves FishyBird on its own.
- `lexicon:review` serves the review page on its own.

The published site has no such split. `dist/` is one website: the hub at the root, the
games inside it, the recordings at `/audio/`, and the review page at `/review/`. So the
arrangement this plan wants already exists and is already proven &mdash; it is only
development that has drifted.

Two things make the split actively misleading rather than merely untidy.

**Ports slide silently.** When a dev server finds its port taken it moves to the next
one and says so in a line of output nobody reads. Pressing F5 four times leaves four
servers on four ports, all serving something, none of them the one you meant. That has
already happened: 5173 through 5176 were occupied at once, and the review server's own
port was one of the casualties.

**A wrong address does not look wrong.** A dev server answers an address it does not
recognise by handing back the site's front page. Asking it for `/review` gives you the
hub, which looks exactly like the page you were already on. It reads as "nothing
happened" rather than "that address is not here", which is precisely how an afternoon
gets lost.

Merging the servers removes both. One server means no sliding; and the review page
sitting at a real address on that server means asking for it gets it.

## Steps

### 1. The site serves the review page and its word list &mdash; done

In `site/vite.config.ts`, answer `/review/` with the review page from the lexicon
folder, and `/review/lexicon.json` with the lexicon file. These are the same two files
that `tools/site/build-site.mjs` already copies into the built site, so this is the
built arrangement, running live. Recordings already answer at `/audio/`, so there is
nothing to add for those.

**Done when:** with the site running, `/review/` lists every word and plays a
recording when you click one.

### 2. The address without the trailing slash lands on the words &mdash; done

`/review` redirects to `/review/`. Without this the dev server falls back to handing
back the hub, which is the "the page just refreshed" failure, and it will happen to
anyone who types the address by hand.

**Done when:** opening `/review` lists words instead of showing the hub.

### 3. Move the test onto the one server &mdash; done

`tests/lexicon.review-server.test.mjs` currently starts the standalone review server.
Point it at the site's dev server instead and check four things: the review page
answers, the word list answers beside it, a recording answers, and `/review` without
the slash redirects rather than quietly returning the hub.

That fourth check replaces the old one about the word list not being at the root.
It is the more useful check now, because returning the hub is what this whole plan
exists to stop.

This comes before the deletion so the checks are never red in between.

**Done when:** `npm run ci` passes with those four checks running against the site's
own server.

### 4. Asking for the review page starts the site, not a second server &mdash; done

`lexicon:review` starts the one server and opens it at the review page. Delete
`tools/lexicon-cli/review-server.mjs`, which by now has nothing pointing at it.

**Done when:** asking for the lexicon review page opens the words at the site's own
address, and no second server starts.

### 5. The site keeps its address instead of sliding to the next free one &mdash; done

Pin the port, and refuse to start on a different one. A second attempt then stops with
a plain "that port is taken" instead of quietly opening somewhere else.

**Done when:** with the site already running, starting it again fails and says why,
rather than opening on a different address.

### 6. Say it in the README and in the word-changing instructions &mdash; done

Update *Checking the words* and the command list in `README.md`, and the two places
`.claude/skills/update-lexicon/SKILL.md` names the review command.

**Done when:** following the README from nothing running gets you to a page with words
on it.

## What happens after this plan

The review page and the site are one thing. FishyBird is still a site of its own, which
is the next plan; nothing here depends on that one, and it does not depend on this.

## Risks

- **A wrong address still looks like a working page.** That is the nature of a dev
  server, and it cannot be fixed, only checked. Steps 2 and 4 exist for it, and every
  *done when* above says *lists words* rather than *the page opens*.
- **The test gets slower and heavier.** It has to start a real dev server rather than a
  forty-line one. That is the price of testing the thing that actually runs. If it
  turns flaky it is worth fixing rather than deleting.
- **Pinning the port will feel like a step backwards the first time.** A server left
  running from yesterday will now block today's. That is the point &mdash; it is the
  difference between being told and being quietly moved &mdash; but it will be
  annoying before it is helpful.
- **The published site is not touched.** `tools/site/build-site.mjs` is left alone, and
  the checks build it every time, so this is watched rather than assumed.
- **No Klallam is written by this plan.** It moves addresses about. The words are read
  from the lexicon by the page, exactly as they are today.
