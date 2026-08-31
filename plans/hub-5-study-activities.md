# Add the flashcards, quiz, matching game and word list

**Goal:** Fill the remaining tabs on each chapter with the three study games and the
word list from the draft page, each one its own self-contained piece built on the same
kit as FishyBird.

**Not doing:**

- No pronunciation guide. Still its own plan, still waiting on a kind of data the
  lexicon does not hold.
- No spaced repetition in these three. FishyBird decides which words come back; these
  work through whatever chapter you picked. Sharing that memory across games is a later
  decision, and the kit is already shaped so it can be made without unpicking anything.
- No recordings in these games unless the word has one. A word with no recording is
  still perfectly usable as a flashcard.

## Depends on

Plan 4, finished.

## Background you need to read the steps

FishyBird only ever shows a word that has a recording and has been confirmed by a
speaker, because a game that says a word out loud has no business saying an unconfirmed
one. That rule is baked into how it asks the lexicon for words.

These four cannot use that rule. Most of what you are adding &mdash; the subject
pronouns especially &mdash; will never have a recording, and a flashcard showing a
written word does not need one. So the kit needs a second way of asking: give me the
words for this chapter, confirmed, recording or not, and tell each game whether a given
word can be heard so it can offer a play button only where there is something to play.

Everything else is the same contract FishyBird already uses. Each game is registered
with the kit, handed a set of words and a way to report points, and drawn inside its own
sealed-off area. None of them knows the site exists.

## Steps

### 1. Let a game ask for words that have no recording

The kit gains a way to request a chapter's confirmed words whether or not they have
audio, and tells each game which of them can be played aloud. FishyBird carries on
asking the way it does today and is unaffected.

**Done when:** FishyBird still refuses to show a word without a recording, and a test
shows the new request returning words that have none.

### 2. The word list

The simplest of the four: the chapter's words in a table, Klallam beside English, with a
play button on the ones that have a recording.

**Done when:** choosing a chapter and then the word list shows every word the lexicon
has tagged with that chapter, the Klallam in Charis with its marks correctly placed, and
clicking a play button plays that word.

### 3. Flashcards

A card showing the Klallam, tapping flips it to the English, arrow keys and buttons move
through the chapter, and a shuffle button reorders it. As drafted.

**Done when:** you can go through a whole chapter with the keyboard, flip every card,
shuffle, and land back at the first card.

### 4. The quiz

Shows a Klallam word and four English meanings, one right. Says which was right, scores
it, and totals up at the end. As drafted.

**Done when:** a full chapter's quiz can be played to the end, a wrong answer shows the
right one, and the points earned appear in the site's header and are still there after
a refresh.

### 5. The matching game

Two columns, Klallam on one side and English on the other, pick one from each to pair
them. As drafted.

**Done when:** a round can be completed, a wrong pair is rejected without ending the
round, and finishing awards points that appear in the header.

### 6. Delete the draft page

`original-site.html` and the reading command from plan 1 both come out. Everything they
carried is either in the lexicon or in the site.

**Done when:** neither file exists, `npm run ci` passes, and the site still shows every
chapter with the same word counts as before.

## Risks

- **A chapter with fewer than four words cannot make a quiz question.** The subject
  pronouns chapter is close to that line. Each game has to say so plainly rather than
  failing, and which chapters are affected depends on how you tag them.
- **Duplicate English meanings break the quiz and the matching game.** If two words in
  the same chapter share a translation, the quiz can offer two correct answers and the
  matching game can look wrong when it is right. The lexicon already has two entries
  glossed *young woman*. This has to be handled by the games, and is worth a look at
  the tagging too.
- **Points are per browser and easily lost.** Clearing site data clears them. There is
  no account and never will be, so this is worth saying out loud to a learner
  somewhere.
- **Deleting the draft page is final.** Step 6 should not be done until you have
  confirmed every word from it is in the lexicon. The git history keeps a copy, but
  going back for it is a chore.
- **No new Klallam words are involved.** All four games read from the lexicon. Anything
  still missing at this point waits on the spreadsheet, and those chapters simply show
  fewer words until it arrives.
