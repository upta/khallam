# Make the new page the site, with FishyBird living inside it

**Goal:** Replace FishyBird-as-the-whole-site with the new page: a header, chapters to
choose from, and a panel that games open inside. FishyBird becomes the first game
reachable from it.

**Not doing:**

- No flashcards, quiz or matching game yet. Those are plan 5. Until then the panel
  offers FishyBird only.
- No pronunciation guide. It needs a kind of data the lexicon does not hold yet
  &mdash; a sound, a description of it, and an example &mdash; and that deserves its own
  plan.
- No word counts in the banner across the top. The numbers on the page as drafted were
  invented, and rather than recompute them they come out.
- No restyling of FishyBird to match. It keeps its own look.

## Depends on

Plans 2 and 3, both finished, and your pass through the spreadsheet adding the missing
words and tagging every row.

## Background you need to read the steps

`original-site.html` is the page this plan turns into the real thing. Two things about
it have to change on the way in.

It carries its own copy of the words, hard-coded into the file. Those come out entirely;
the page reads the lexicon instead, so a word can never be right on the site and wrong
in the lexicon, or the other way round. Chapters come from the tags added in plan 2.

It also loads its two fonts from Google, and shows Klallam in one of them. That font was
not built for Klallam and will put the stacked marks in the wrong places. Klallam on this
site renders in Charis, the font FishyBird already ships, everywhere and without
exception. The two English fonts get downloaded once and shipped with the site, so the
page does not depend on anything outside itself.

## Steps

### 1. Close the gap in the guard first &mdash; done

There is a check that fails the build if a Klallam character is written into the code
rather than read from the lexicon. It currently only looks at `games` and `tools`. Widen
it to `packages` and `site` before either folder has anything in it, so the new page
cannot become the place where words get inlined.

**Done when:** putting a non-ASCII character into a file under `site` makes
`npm run ci` fail, and removing it makes it pass.

`packages` had already been added when the kit was built, so this only had to add
`site`. Proved both ways with a throwaway file.

### 2. Stand the page up with nothing in it

A new `site` workspace holding the page's header, its opening banner, its chapter area
and its empty game panel &mdash; the look exactly as drafted, minus the invented
numbers, and with no words in it at all. Its two English fonts are downloaded once and
shipped with the site rather than fetched from Google, and Charis is set up as the font
for Klallam.

**Done when:** `npm run site:dev` opens a page that looks like the draft, with an empty
chapter area and no game panel showing, and it asks nothing of any address outside the
site.

### 3. Build the chapters from the lexicon

The chapter cards come from the chapter list written in plan 2, in the order it gives,
each showing its label and how many words the lexicon has tagged with it.

**Done when:** the page shows one card per chapter, and each card's count matches what
you tagged in the spreadsheet.

### 4. Open a game in the panel

Choosing a chapter opens the panel below it with a row of tabs. FishyBird is the only
tab for now. Choosing it starts the game, inside the panel, on that chapter's words. The
game is only downloaded when it is chosen, so the page stays quick for someone who is
just browsing.

**Done when:** choosing a chapter and then FishyBird plays a full round with audio on
that chapter's words, and the site's header stays visible above it.

### 5. Make the address bar keep up

The chosen chapter and game are reflected in the address, so the back button goes back a
step, refreshing lands in the same place, and a link can be sent to someone.

**Done when:** you can open a chapter, start FishyBird, press back twice and end up on
the bare page, then paste the address into a new tab and land back in the game.

### 6. Publish the site instead of the game

`npm run site:build` assembles the new page as the site, with FishyBird inside it rather
than at the root, the recordings in one place, and the review page where it already is.

**Done when:** serving the built site under a `/khallam/` sub-folder gives you the new
page at the root, a playable FishyBird with audio inside it, and the review page still
listing words at `/khallam/review/`.

## Risks

- **This changes what is at the published address.** Anyone who has bookmarked
  FishyBird gets the new page instead. That is the intent, but it happens the moment
  this lands on `main`.
- **A chapter with too few words breaks a round.** FishyBird needs ten words with
  recordings to build a round, and needs enough distinct translations to fill the fish.
  A thinly tagged chapter, or one whose words have no recordings yet, will not be
  playable. The page should say so plainly rather than failing; expect at least one
  chapter to hit this until recordings exist.
- **Broken audio is silent.** If the recordings end up in the wrong place, the game
  still loads and looks correct and simply never speaks. Step 6 has to be checked by
  playing, not by looking.
- **The font check cannot be automated.** A wrong font is not an error, it is a
  misplaced mark. Someone has to look at a word with stacked marks on it, on the site
  and not only in the game.
- **No Klallam is written by this plan.** Every word on the page is read from the
  lexicon at the moment it is shown. Anything missing waits on the spreadsheet.
