# Make a generated id look generated, wherever it came from

**Goal:** An id written back into `lexicon/lexicon.xlsx` looks exactly like every other
id in that column, so it is obvious at a glance that the machine wrote it and you did
not.

**Not doing:**

- No change to how ids are made up, or to any word, meaning, tag or recording.
- No rebuilding of the spreadsheet from the lexicon. That is the recovery command, and
  running it would throw away any column the lexicon does not know about.
- No change to which columns are locked or editable.
- Nothing about Klallam text.

## Background you need to read the steps

When you type a new word into the sheet, you leave the id column blank and the import
fills it in afterwards. To do that it reaches into the spreadsheet file and writes that
one cell, deliberately leaving everything else alone, because the sheet may hold columns
of your own that the lexicon knows nothing about.

When it writes a cell that already exists, it copies that cell's appearance across, so
the result matches its neighbours. When the cell does not exist at all &mdash; which is
exactly the case for a word you just typed, where the id column is empty &mdash; there
is nothing to copy from, so it writes the cell with no appearance specified. Excel then
falls back to its own default: ordinary black text, rather than the greyed italic the id
column uses for generated values.

That is what you are seeing on the 37 ids from the last import. It is cosmetic and
nothing more: you have confirmed those cells are already locked, so the id is protected
from being typed over either way. What it gets wrong is the signal. The whole point of
greying that column is to say *this was written for you, do not type here*, and an id
that looks like ordinary text says the opposite.

The sheet already records what that column should look like, in its own column
definition. Nothing new has to be invented; the missing step is reading it.

There is a second question the fix does not answer by itself: the 37 ids already in the
sheet stay plain, because they were written before the fix existed. Step 2 deals with
them.

## Steps

### 1. Use the column's own appearance when a cell has to be created  ✅

In `tools/lexicon-cli/xlsx.mjs`, where a cell is created because none was there, fall
back to the appearance the sheet records for that column instead of leaving it
unspecified.

**Done when:** a test writes an id into a row that has no id cell, reads the sheet back,
and finds the new cell carrying the same appearance as the id column's existing cells.

### 2. Repair the ids that were already written plain  ✅

Have the import, when it applies, write every row's id rather than only the new ones.
Each one is written with the right appearance, so a sheet that has drifted corrects
itself the next time anything is imported, and no one-off repair command has to exist or
be remembered.

**Done when:** running an import that adds at least one word leaves every id cell in the
sheet looking identical, including the 37 that are plain today.

### 2a. Let the repair run when there is nothing to import  ✅

*Added during the build.* Step 2 only reaches the sheet when an import has something to
apply, and the sheet and the lexicon currently agree, so the 37 plain ids would have sat
there until the next new word. Applying an import that has nothing to import now tidies
the id column and says so, rather than exiting having done nothing.

Because the sheet is now written on every apply rather than only when words are added,
the existing check that the file is not open in Excel has to run every time too.

**Done when:** `npm run lexicon:import -- --apply`, with nothing to import, reports that
it tidied the id column, and running it a second time changes the file no further.

### 3. Look at it in Excel  ✅

Open the spreadsheet and read down the id column.

**Done when:** every id, old and new, reads as greyed generated text, with nothing to
single out the rows that were filled in by an import.

## Risks

- **This writes to the spreadsheet, which is the source of truth for Klallam.** Step 2
  in particular touches every id cell rather than a handful, and step 2a means an apply
  with nothing to import now writes to the file where before it did nothing at all. Ids
  are ASCII and are generated from the English, so no Klallam is read or written by any
  of it &mdash; but it is still the file that matters most, and it is worth committing
  the sheet before running an import, so any surprise can be undone.
- **Excel must be closed when an import applies.** That is true today and does not
  change. Excel holding the file open with unsaved changes can write its own copy back
  over the ids.
- **Appearance is not the same as protection, and only appearance is wrong here.** You
  have checked that the plain ids are already locked, so nothing about this is urgent and
  no id is at risk of being typed over while it waits.
- **No test can see what Excel draws.** The tests can prove the file says the right
  thing; only step 3 proves it looks right on screen.
