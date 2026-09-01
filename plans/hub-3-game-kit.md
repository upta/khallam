# Turn FishyBird into a piece the site can drop onto a page

**Goal:** Make FishyBird a self-contained thing the site can place anywhere on a page,
and build the shared kit that every future game plugs into the same way.

**Not doing:**

- No change to how FishyBird plays, looks, or sounds. Same levels, same speeds, same
  artwork, same recordings. This is packaging only.
- No landing page. That is plan 4.
- No new games. That is plan 5.
- No sharing of word progress between games yet. The storage moves house so it *can* be
  shared later, but FishyBird keeps its own progress and nobody loses a streak.

## Background you need to read the steps

FishyBird currently assumes it owns the whole page. Its buttons and banner are written
into `games/fishybird/index.html`, its code finds them by asking the page for them by
name, and its stylesheet colours the whole document dark. All of that is fine when the
game is the only thing on screen, which it has been. It stops being fine the moment the
game has to sit inside a light-coloured page that has its own header and its own
buttons.

The fix is a browser feature called a custom element: the game becomes a single tag the
site can place, and everything it draws lives inside that tag in a sealed-off area. Its
stylesheet cannot reach out and colour the page, and the page's stylesheet cannot reach
in and restyle the game. That is what keeps FishyBird encapsulated while it stops being
the whole site.

There is one thing to check before committing to it. FishyBird draws through a library
called Phaser, and a sealed-off area is exactly the sort of place a graphics library can
get confused about where the mouse is. Step 1 finds that out cheaply, before anything is
built on top of it.

Everything that will be true of *every* game &mdash; how it is placed, where it gets its
words, where it gets the recordings, where it stores progress &mdash; moves into one
shared package, so game two does not have to rediscover any of it.

## Steps

### 1. Check that Phaser tolerates being sealed off &mdash; done

A throwaway page that puts the existing game inside a sealed-off area and does nothing
else. Play a round in it.

**Done when:** a full round plays in the sealed-off area &mdash; fish move, taps land on
the fish you aimed at, the eagle catches the right one, and the recording plays. If any
of that misbehaves, stop and say so; the kit then offers games a way to opt out of the
seal, and the rest of the plan proceeds unchanged.

Phaser tolerated it. A full round played: every tap landed on the fish aimed at, the
eagle caught the right one, recordings played, and the summary listed the missed words.
The page's own loud styling did not reach the game and the game's dark styling did not
reach the page. One thing to carry into step 6: Phaser finds its container by asking the
document for it by name, which cannot see inside the seal, so step 6 must hand Phaser
the element itself rather than its name.

### 2. Create the shared kit &mdash; done

A new package, `packages/game-kit`. It defines what a game is: a name, an icon, whether
it fills the screen or sits in a panel, and a single function the site calls to start
it. Registering a game with the kit is what turns it into a tag the site can place. The
kit also hands each game the words it should use, a way to play a recording, a place to
store progress, a way to report points, and a way to say it is finished.

Nothing uses it yet.

**Done when:** `npm run ci` passes with the new package in place.

### 3. Move the recordings plumbing into the kit &mdash; done

The code that serves the lexicon's recordings while you are developing, and copies them
into the published site, currently lives in FishyBird's build settings. Move it into the
kit so every game and the site get it identically, and so there is only ever one copy of
the recordings in the published site.

**Done when:** `npm run game:dev` still plays recordings, and `npm run site:build` still
produces one `audio` folder with every recording in it.

### 4. Move the Klallam font into the kit &mdash; done

The Charis font is a loose file in FishyBird's `public` folder. That folder gets copied
only when FishyBird is built as a whole page of its own, which is what happens today and
still happens after step 6. But once the site owns the page and merely places the game
on it, nothing copies that folder and the font goes missing &mdash; silently, because a
missing font breaks nothing loudly. It just renders Klallam's stacked marks in the wrong
places.

Move the font in beside the recordings in the kit, so it travels with the kit for every
game and for the site, and a game showing Klallam gets the right font by default instead
of by remembering to ask for it.

**Done when:** `npm run game:dev` and the built game both show the word banner in Charis
with its marks correctly stacked, and the built game still fetches the font successfully
when served from a sub-folder rather than the top of a domain.

### 5. Move progress storage into the kit &mdash; done

The kit gains a small store that keeps each game's progress under its own name, plus a
running points total shared across the site. FishyBird's word memory moves to using it,
keeping the exact name it stores under today.

**Done when:** a browser that has played FishyBird before still shows the same words
coming back for review after the change, and its round count has not reset.

### 6. Make FishyBird a placeable tag &mdash; done

FishyBird builds its own banner, buttons and summary inside its own element instead of
finding them on the page, and carries its stylesheet with it. `games/fishybird/index.html`
stays, reduced to a small page that places the tag and nothing else, so
`npm run game:dev` keeps working exactly as it does now.

**Done when:** `npm run game:dev` plays a full round with audio, level choice, the
replay button and the end-of-round summary, all behaving as they do today.

## Risks

- **This is the step most likely to surprise us.** Moving a running game out of the page
  it was written for touches its buttons, its layout, its stylesheet and its input all
  at once. Step 1 exists to find the worst of it early, and steps 2 to 5 are
  deliberately ordered so that each one can be checked before the disruptive step 6.
- **Progress is easy to lose and impossible to get back.** Step 5 keeps the storage name
  identical for that reason. Check it in a browser that has really played, not a fresh
  one, because a fresh browser looks correct either way.
- **The font move cannot be verified from a green build.** A missing or wrong font does
  not fail anything; the words just render in the wrong shape. Step 4 has to be looked
  at with your own eyes, not signed off on a passing check.
- **No new Klallam words are involved.** FishyBird reads them from the lexicon and will
  carry on doing so.
