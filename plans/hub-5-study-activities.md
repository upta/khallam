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

Every game is handed its words by the site, as a list of ids, and the kit turns that
list into entries. Today the kit narrows what it is handed to words safe to say out
loud: confirmed by a speaker, and with a recording. An id for anything else is quietly
dropped. That is right for FishyBird, which says every word aloud, and wrong for these
four.

Most of what you are adding &mdash; the subject pronouns especially &mdash; will never
have a recording, and a flashcard showing a written word does not need one. So two
things change. The site decides what each game is given: FishyBird keeps being handed
only words that can be spoken, while these four are handed every word tagged with their
chapter. And the kit stops dropping a handed-over word for having no recording, saying
instead which of them can be heard, so a game shows a play button only where there is
something to play.

Being flagged for review does not hide a word from these four. Nearly every flag in the
lexicon today says only that a word has no recording, so gating on it would empty most
of the chapters. A recording is still required for FishyBird, which has to say each word
out loud.

Everything else is the same contract FishyBird already uses. Each game is registered
with the kit, handed a set of words and a way to report points, and drawn inside its own
sealed-off area. None of them knows the site exists.

## Steps

### 1. Let a game be handed words that have no recording &mdash; done

The site decides what each game gets. The kit stops dropping a word it was handed for
having no recording, and tells each game which of its words can be heard. FishyBird is
unaffected, because it carries on being handed only words that can be spoken.

**Done when:** FishyBird still never shows a word without a recording, and a game handed
a word that has none keeps it, marked as having nothing to play.

The site now decides, one game at a time, which words it hands over, and the kit passes
on whatever it is given. FishyBird is given the same set it always had: confirmed words
that have a recording.

### 2. The word list &mdash; done

The simplest of the four: the chapter's words in a table, Klallam beside English, with a
play button on the ones that have a recording.

**Done when:** choosing a chapter and then the word list shows every word the lexicon
has tagged with that chapter, the Klallam in Charis with its marks correctly placed, and
clicking a play button plays that word.

Every chapter's list is now exactly as long as the number on its card. Of Ch. 1.1's 11
words, 4 have a recording and so 4 have a play button; the subject pronouns have none
at all, and read perfectly well without.

### 3. Flashcards &mdash; done

A card showing the Klallam, tapping flips it to the English, arrow keys and buttons move
through the chapter, and a shuffle button reorders it. As drafted.

**Done when:** you can go through a whole chapter with the keyboard, flip every card,
shuffle, and land back at the first card.

Walked Ch. 1.1 end to end: eleven different cards, then round to the first again, and
left from the first goes to the last. Moving to another card always turns it back to the
Klallam side. My test harness could not deliver real key presses to the page, so the
arrow keys are the one thing you should try yourself.

### 4. The quiz &mdash; done

Shows a Klallam word and four English meanings, one right. Says which was right, scores
it, and totals up at the end. As drafted.

**Done when:** a full chapter's quiz can be played to the end, a wrong answer shows the
right one, and the points earned appear in the site's header and are still there after
a refresh.

Played Ch. 1.1's eleven questions through: four different meanings offered every time,
never the same meaning twice, the right one always named after answering. The header
went from 0 to 20 points and still read 20 after a reload. The header only catches up
when a round ends, which is also when the points are awarded. A chapter without four
different meanings says so rather than failing; no chapter is in that position today.

### 5. The matching game &mdash; done

Two columns, Klallam on one side and English on the other, pick one from each to pair
them. As drafted.

**Done when:** a round can be completed, a wrong pair is rejected without ending the
round, and finishing awards points that appear in the header.

Played a round of Ch. 4: a deliberate wrong pair shook both buttons and left them
unmatched with the round carrying on, then all six pairs went in and the header rose by
60. Two words meaning the same thing never appear in one round, so a right pairing can
never look wrong. Points are awarded pair by pair, but the header only catches up when
the round ends.

### 6. Delete the draft page &mdash; blocked

`original-site.html` and the reading command from plan 1 both come out. Everything they
carried is either in the lexicon or in the site.

**Done when:** neither file exists, `npm run ci` passes, and the site still shows every
chapter with the same word counts as before.

Not done, and nothing was deleted. The gap command still reports one word in the draft
that the lexicon does not have &mdash; the noun glossed *uncle or aunt*, whose spelling
on the page differs from the lexicon's *uncle, aunt* &mdash; and four words the page and
the lexicon spell differently: *stick*, *strong*, *you* and *cow*. Deleting the page
would throw those away. It waits on the spreadsheet and on a speaker settling the four
spellings.

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
