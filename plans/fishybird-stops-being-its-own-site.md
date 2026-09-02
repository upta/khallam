# FishyBird stops being a site of its own

**Goal:** Make FishyBird a part of the site like the other four games, so pressing F5
opens the website and you reach the game by clicking into it.

**Not doing:**

- No change to how FishyBird plays, looks or sounds. Same levels, same speeds, same
  everything.
- No change to the published site. FishyBird is already inside it; nothing about
  `dist/` changes.
- No change to the other four games.
- Nothing about the lexicon, the spreadsheet, or any Klallam text.

## Background you need to read the steps

FishyBird was the whole site once, and it still carries the equipment for that: a page
of its own in `games/fishybird/index.html`, its own build settings in
`games/fishybird/vite.config.ts`, and three commands that start and build it by itself.

The other four games have none of that. Flashcards, the quiz, the matching game and the
word list are pieces the site places on a page. They cannot be opened on their own,
because there is nothing to open.

The site already treats FishyBird the same way &mdash; it imports it and places it in
the panel next to the other four, and building the site compiles it. So FishyBird's own
page and build settings are not doing any work. They are just the last thing that can
still be started separately, and F5 currently starts it.

The one thing they still provide is a way to try the game alone on a phone, over the
local network. `site:lan` does that for the whole site, so it is a replacement rather
than a loss.

## Steps

### 1. F5 opens the site &mdash; done

Point the launch profile and its background task at the site rather than the game, and
rename the profile to match. Doing this first means F5 is never broken in between.

**Done when:** pressing F5 opens the site with the chapters listed, and clicking into
FishyBird plays a round with sound.

### 2. The checks stop building a site that is about to not exist &mdash; done

`ci` currently builds FishyBird on its own. Remove that. Building the site compiles
FishyBird already, so nothing stops being checked &mdash; and if that turns out to be
wrong, the site build is where it will show.

This comes before the deletion so the checks are never red in between.

**Done when:** `npm run ci` passes and no longer builds the game separately.

### 3. FishyBird loses the equipment for being a site &mdash; done

Delete `games/fishybird/index.html` and `games/fishybird/vite.config.ts`, and the
`dev`, `build` and `preview` scripts in its `package.json`. Drop `game:dev`,
`game:lan` and `game:build` from the root, since there is no longer a thing for them to
start.

**Done when:** FishyBird still plays a full round with sound inside the site, started
with F5.

### 4. Say it in the README &mdash; done

The command list should not offer a way to start a game by itself, because there is not
one any more.

**Done when:** the README's command list matches what the project can actually do.

## What happens after this plan

There is one website. One server, one address, everything inside it: the hub, all five
games, and the review page.

## Risks

- **Phaser is the thing to watch.** FishyBird draws through a library with its own
  build requirements, and those requirements currently live partly in the file step 2
  deletes. The site's own settings already cover it, which is why the game works inside
  the site today &mdash; but step 2's *done when* is "plays a full round with sound"
  rather than "the site builds" for exactly this reason.
- **Working on the game alone gets slightly slower.** You reach it through the hub
  rather than landing on it. That is the cost of having one website, and it is a click.
- **`game:lan` goes.** Trying the game on a phone is `site:lan` instead, which serves
  the whole site. Worth knowing before the first time you want it.
- **No Klallam is written by this plan.** It deletes scaffolding. The words are read
  from the lexicon at runtime, exactly as they are today.
