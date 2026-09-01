# Make the tags column safe enough to build chapters out of

**Goal:** Let a chapter be defined by tagging words in `lexicon/lexicon.xlsx`, and make
a mistyped tag a loud error at import time instead of a word that silently disappears
from the site.

**Not doing:**

- No change to how Klallam text is entered, checked or locked.
- No second tab in the spreadsheet. The file is written by hand-rolled code that only
  understands one sheet, and teaching it a second is more risk than this is worth.
- No dropdown in Excel. Same reason.
- Nothing that reads tags yet. The site does that in plan 4.

## Background you need to read the steps

The spreadsheet already has a tags column, and the tools already carry tags through
into `lexicon.json`. What is missing is any notion of which tags are allowed. Today the
import splits on commas, trims the spaces, and stores whatever it finds. Nothing else
happens.

That is fine while nothing uses tags, and every entry in the lexicon currently has
none. It stops being fine the moment a chapter is "the words tagged nouns", because
then a row typed as `Nouns`, or `noun`, or with a trailing space, is a word that
quietly vanishes from that chapter. Nothing fails, nothing is reported, the word is
just gone. That is the worst shape a bug can take here.

So before you tag 51 rows, the tags column needs a fixed list of what it accepts.

## Steps

### 1. Write down the list of chapters  ✅

A new file, `lexicon/tags.json`. Each entry has the tag as typed in the spreadsheet, a
label for how it should read on the site, and a number saying where it sorts. It holds
no Klallam, so it is a file Claude can edit for you when you say "add a chapter
called&hellip;".

**Done when:** the file exists and lists every chapter on the new site page, with the
labels it uses today.

### 2. Tidy tags on the way in  ✅

Change the import so a tag is lowercased, trimmed, and de-duplicated before it is
stored. A row reading `Nouns , nouns` becomes the single tag `nouns`.

**Done when:** `npm run lexicon:verify` passes and `npm test` is green.

### 3. Refuse a tag that is not on the list  ✅

The import already shows you a dry-run report before it changes anything. Make an
unrecognised tag an error in that report, naming the row, the tag, and the closest
match on the list. Nothing is written when one is found.

**Done when:** importing a sheet with a deliberately mistyped tag stops with an error
that names the row and suggests the right tag, and `lexicon.json` is unchanged.

### 4. Catch one that got in some other way  ✅

Make `npm run lexicon:verify` fail if the lexicon holds a tag that is not on the list.
This covers a tag removed from `tags.json` after words were already tagged with it.

**Done when:** deleting a chapter from `tags.json` makes `npm run ci` fail, and putting
it back makes it pass.

### 5. Test the three ways it goes wrong  ✅

Add tests for a straight typo, a capitalisation difference, and a stray space.

**Done when:** `npm test` covers all three and passes.

### 6. Explain it to whoever does the tagging  ✅

A short section in `README.md`, next to the existing spreadsheet instructions, saying
what a chapter tag is, listing the ones that exist, and saying what happens if you type
one wrong.

**Done when:** someone who has never seen the project can read that section and tag a
row correctly.

## What happens after this plan

You add the missing words from plan 1 and tag all the rows in one pass through the
spreadsheet, then run the `update-lexicon` skill. Plans 4 and 5 need that data to
exist. Plan 3 does not, and can be built while you are typing.

## Risks

- **A tag typed correctly but on the wrong row is still wrong.** None of this catches a
  word filed under the wrong chapter. Only reading the chapter list on the site does,
  which is why plan 4 shows word counts on each chapter card.
- **Lowercasing is a decision, not a fact.** It means a tag can never be
  case-meaningful. That is almost certainly what you want, but it is one-way: if a tag
  ever needs a capital letter, this has to be revisited.
- **The list has to be edited by someone who can edit a text file.** It is plain
  English and Claude can do it on request, but it is not the spreadsheet, so it is one
  more place that has to stay in step. Step 4 exists so it cannot drift silently.
- **No Klallam is written by this plan.** It only touches tags, which are ASCII.
