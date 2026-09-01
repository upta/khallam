# Work out which words the new site needs that the lexicon does not have

**Goal:** Print a plain list of every word on the new site page, sorted into three
groups &mdash; already in the lexicon, not in the lexicon yet, and in the lexicon but
spelled differently &mdash; so you know exactly which rows to add to
`lexicon/lexicon.xlsx`.

**Not doing:**

- No editing of the lexicon. This plan only reads and reports.
- No adding rows to the spreadsheet for you. You type them, a speaker checks them.
- No opinion about which spelling is correct when two disagree. That is a speaker's
  call, and the report exists to put the disagreement in front of them.
- Nothing about the site itself. That is plans 3 and 4.

## Background you need to read the steps

`original-site.html` sits at the top of the repo. It is the page that becomes the new
site, and it currently carries its own copy of 57 Klallam words plus a dozen more in
its pronunciation guide. That copy was written in a chat, not taken from the lexicon,
so some of it disagrees with what is already in `lexicon/lexicon.json`. Four
disagreements are visible already, on the words for *strong*, *cow*, *stick* and
*you*.

None of that is decided here. The point of this plan is to turn "57 words in a file"
into "here are the 30-odd rows to add and the 4 to ask a speaker about".

The comparison has to happen twice over, because the two failure modes look nothing
alike. Comparing by English catches a word that is genuinely new. Comparing by the
Klallam text itself, character for character, catches a word that already exists but
has been retyped slightly differently &mdash; which is invisible to the eye and is the
thing that actually corrupts a lexicon.

## Steps

### 1. Read the words out of the page  ✅

A new command, `npm run lexicon:gap`, that opens `original-site.html`, picks out its
word rows and its pronunciation examples, and prints them with the chapter each one
belongs to. It reads the file as text and matches the rows by pattern; it never runs
the page's code.

**Done when:** the command prints 57 words under five chapter headings, plus the
pronunciation examples under a heading of their own.

### 2. Say which ones the lexicon already has  ✅

Extend the command to match each word against `lexicon/lexicon.json` by its English
meaning, and mark it as known or new.

**Done when:** the command prints a count of known and new for each chapter, and the
two counts add up to the chapter's word count.

### 3. Say which ones are spelled differently  ✅

For every word the lexicon already has, compare the page's Klallam against the
lexicon's Klallam exactly. Where they differ, print both, along with the numeric
codepoints of each, so whoever reviews the change technically can see precisely which
mark moved.

**Done when:** the command lists the words for *strong*, *cow*, *stick* and *you*
as differing, each with both spellings and both sets of codepoints. (*cut it*, named
here when the plan was written, turns out to be identical in both; the fourth
disagreement is *you*, in the pronunciation guide.)

### 4. Put it in the order you will work in  ✅

Group the output chapter by chapter, and inside each chapter put the new words first,
then the differing ones, then the ones needing nothing. End with a single summary line
saying how many rows you have to add in total.

**Done when:** you can read the output top to bottom, spreadsheet open, and know what
to type without scrolling back.

## What happens after this plan

You add the missing rows to `lexicon/lexicon.xlsx` and run the `update-lexicon` skill.
Every new word will come in flagged for review automatically, because none of them
have recordings yet, so they will all appear on the review page for a speaker. The
import also compares each new word against every existing one ignoring invisible
marks, so a word that differs from an existing entry only by the shape of an
apostrophe gets flagged on its own, without anyone having to spot it.

Plan 2 should be built before you do that typing. It makes the tags column safe, and
you will want to fill tags in on the same pass rather than going through 51 rows
twice.

## Risks

- **The page's Klallam is not a source.** It was produced in a chat. Treat every word
  in it as a suggestion for the spreadsheet and nothing more. The speakers reviewing
  `lexicon.xlsx` are the authority; this plan just gets the candidates in front of
  them accurately.
- **A gloss can match when the word does not.** Two different Klallam words can share
  an English translation, and the lexicon already has two separate entries glossed
  *young woman*. The report will show both and let you decide; it will not guess.
- **A gloss can differ when the word is the same.** The lexicon says *road, door*
  where the page says *road*, and *small* where the page says *small / few*. Those
  will show up as new words when they are not. The report should print near-miss
  glosses rather than silently dropping them, and you check them by eye.
- **The command dies with the file.** It exists only to read `original-site.html`, and
  both are deleted in plan 5. It is not a permanent part of the toolchain.
- **No new Klallam is written by this plan.** It reads the page and reads the lexicon.
  Everything it finds missing waits on you and a speaker.
