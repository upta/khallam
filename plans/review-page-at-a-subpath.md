# Serve the review page at a sub-path instead of at the root

**Goal:** Make the review page live at a proper address of its own, `/review/`, so the
lexicon stops being the top item of the served hierarchy and the address in the README
is one you can actually open.

**Not doing:**

- No change to the review page itself. Its two requests, for the word list and for the
  recordings, stay exactly as they are.
- No change to the published site or how it is built. This is the local review server
  only.
- No landing page at the root. That arrives with the hub, in plan 4.
- Nothing about the lexicon, the spreadsheet, or any Klallam text.

## Background you need to read the steps

`npm run lexicon:review` starts a small server so a speaker can read the words rendered
and hear them. That server treats the `lexicon` folder as the top of everything it
serves, and hands back the review page when you ask for the bare address. It has worked
that way since it was written.

That was fine while the review page was the only thing there. It stops being fine now:
the hub becomes the site's root page, so the root is not the lexicon's to occupy, and an
address of `/` tells you nothing about what you are looking at.

There is also a real fault today. Asking for `/review/index.html` gives you a page that
loads and then sits there empty. The page asks for its word list *relative to wherever
it was loaded from*, and from that address it looks one folder too deep and finds
nothing. It does not say so; it just shows no words. That relative request was
deliberate, added so the published site works from a sub-folder rather than the top of a
domain, and it is correct there, because the build copies the word list to sit beside
the page.

So the fix is to make the local server lay things out the way the published site already
does, rather than to change the page. The page then works identically in both places,
and the thing that is published stays untouched.

One detail decides whether this works: a trailing slash. Loaded from `/review/`, the
page asks for `/review/lexicon.json`. Loaded from `/review`, it asks for
`/lexicon.json`. One of those is right, and the wrong one fails by showing an empty page
rather than an error, which is why it gets a step of its own.

## Steps

### 1. Give the review page and its word list a home under `/review/` &mdash; done

In `tools/lexicon-cli/review-server.mjs`, replace "serve the lexicon folder" with a
short, explicit list of what is served and where: the review page at `/review/`, the
word list at `/review/lexicon.json`, and the recordings at `/audio/`. Keep the existing
guard that refuses any request trying to escape the lexicon folder. Change the address
printed on startup to the new one.

**Done when:** `npm run lexicon:review`, then opening `http://localhost:5174/review/`,
lists every word and plays a recording when you click one.

### 2. Send the bare address to the page &mdash; done

`/` and `/review` both redirect to `/review/`. The second one matters as much as the
first: without the trailing slash the page comes up empty rather than broken, which is
the failure this plan exists to remove.

**Done when:** typing `http://localhost:5174` into a browser lands on the review page
with the words listed.

### 3. Stop serving the lexicon from the root &mdash; done (no code of its own; step 1's list did it)

Nothing outside that list is served any more, so the word list is no longer sitting at
the top of the hierarchy where the hub will go.

**Done when:** `http://localhost:5174/lexicon.json` comes back "not found", and the page
at `/review/` still lists words.

### 4. A test, so it cannot quietly come undone &mdash; done

Start the server on a spare port and check four things: the page answers, the word list
answers, a recording answers, and the old root address for the word list does not.

**Done when:** `npm test` covers all four and passes.

### 5. Point the README at the address that works &mdash; done

In `README.md`, under *Checking the words*, change the link to the new address.

**Done when:** clicking the link in the README, with the server running, opens a page
with words on it.

### 6. Prove the published site did not move &mdash; done

Run `npm run site:build`, serve `dist/` under a `/khallam/` sub-folder the way GitHub
Pages does, and open the review page there. Nothing in this plan touches the published
copy, and this is how that gets shown rather than assumed.

**Done when:** `/khallam/review/` lists words and plays a recording, exactly as it does
now.

## What happens after this plan

Nothing depends on this. When the hub arrives in plan 4 it takes the root address, which
this plan has cleared for it. The review page keeps the address it gets here, so that is
a move of where it is served from, not a redesign.

## Risks

- **The failure mode is an empty page, not an error.** A wrong address here does not
  break anything visibly: the page loads and simply has no words on it. Every *done
  when* above says *lists words* rather than *the page opens*, and step 4 exists because
  a person will not re-check this by hand every time.
- **The published site is the thing worth protecting.** It is deliberately untouched,
  and step 6 checks it anyway, because the last change in this area was correct for the
  published site and wrong locally, and nobody noticed until now.
- **The redirect from `/` is a convenience that may not survive.** Once the hub owns the
  root, that redirect either goes or becomes a link. Either is a one-line change then.
- **No Klallam is written by this plan.** It moves addresses about. The words are read
  from the lexicon by the page, exactly as they are today.
