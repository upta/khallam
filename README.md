# Klallam Language Games

Browser games for teaching the Klallam language. Everything runs client-side and
ships as static files: no backend, no accounts, no network features.

All games share one lexicon, in `lexicon/`.

---

## Changing words

**`lexicon/lexicon.xlsx` is the source of truth for Klallam text.** It is a normal
Excel file, and it is the only place anyone edits a Klallam word.

You do not need to run anything or use a terminal. Ask Claude, in plain language:

> *"I want to add some words to the Klallam lexicon."*
>
> *"I need to fix the spelling of a word."*
>
> *"I have a new recording to attach."*

Claude will start the workflow, tell you when to edit the spreadsheet, and take it
from there.

### What happens

1. **You edit `lexicon/lexicon.xlsx`** in Excel and save it.
2. **Claude checks it** for problems and shows you exactly what changed.
3. **You confirm**, and Claude updates the lexicon.
4. **Claude reports** what was added or changed, and what still needs review.

Nothing is written until you say so. Step 2 always happens before step 3.

### Before you start editing

Excel rewrites text without asking, and two of its defaults will silently corrupt
Klallam. Turn them off once, under *File > Options > Proofing > AutoCorrect Options*:

- *AutoCorrect* tab &rarr; uncheck **Capitalize first letter of sentence**
- *AutoFormat As You Type* tab &rarr; uncheck **"Straight quotes" with "smart quotes"**

Both kinds of damage are rejected before they can reach the lexicon, so nothing
broken gets in either way. It is just far less annoying to prevent them.

### The spreadsheet

| Column | |
|---|---|
| **id** | Filled in for you. Locked, so you cannot overwrite it by accident. |
| **Klallam** | Type or paste the word. |
| **English** | The translation. |
| **audio file** | A filename in `lexicon/audio/`, for example `white.mp3`. |
| **tags** | Optional, comma separated. See *Chapter tags* below. |

- **To add a word,** type into the first empty row and **leave the id blank**.
  An id is created for you and written back into the sheet afterwards.
- **Paste with Ctrl+Shift+V** (values only), so no stray formatting rides along.
- **Save and close Excel before you confirm.** An id has to be written back into the
  sheet, which Excel blocks while it has the file open.
- **Sorting and filtering are safe.** Words are matched by id, never by row position.
- **Deleting a row does not delete the word.** It gets reported and left alone.
  Removing a word is deliberate and separate, by design.
- **You can add your own columns.** Anything the lexicon does not recognise, such as
  a notes column, is left untouched.

### Chapter tags

The **tags** column is what puts a word into a chapter on the site. A word with no
tag still exists; it just does not appear in any chapter. A word can carry more than
one tag, separated by commas.

Type one of these, exactly:

| Tag | Chapter |
|---|---|
| `ch-1.1` | Ch. 1.1 &mdash; Intransitive Verbs |
| `ch-1.2` | Ch. 1.2 &mdash; Transitive Verbs |
| `ch-4` | Ch. 4 &mdash; Nouns |
| `ch-6` | Ch. 6 &mdash; Adjectives |
| `pronouns` | Subject Pronouns |

- **Capitals and stray spaces do not matter.** `CH-4`, ` ch-4 ` and `ch-4` are all
  the same tag, and typing one twice stores it once.
- **A tag that is not on the list stops the import.** You get the row number, what you
  typed, and the tag you probably meant. Nothing is written until it is fixed, so a
  mistyped tag can never quietly drop a word out of its chapter.
- **To add a chapter,** ask Claude to add it to `lexicon/tags.json`. That file holds no
  Klallam, so Claude can edit it safely. Until a tag is in there, the import will
  reject it.

### Changing a word that is already in the lexicon

This is treated as a bigger deal than adding one, on purpose. Claude will show you
exactly which characters differ and will not apply the change without an explicit
go-ahead. **Confirm the change with a speaker first.** Edited words are flagged for
review automatically, because the process cannot know who approved them.

---

## Checking the words

Ask Claude to *"open the lexicon review page"*. That starts the site and opens it at
**<http://localhost:5173/review/>**, which lists every word, rendered properly, and
plays its recording.

It is one website: the games are at the same address, and the review page is a part of
it rather than a thing of its own.

That page is the right way to check a word: read it and listen to it. Words waiting on
a speaker's say-so are marked, so you can work straight down the list.

---

## Changing anything else

Words go through the spreadsheet. Everything else &mdash; a new feature, a fix, a
change to how a game plays &mdash; goes through the same three steps, every time.

**Plan &rarr; build &rarr; validate.**

Ask in plain language, the same way you would for words:

> *"I'd like to plan a change to how the game scores a wrong answer."*
>
> *"Let's build that plan."*
>
> *"Is that finished?"*

### What happens

1. **Plan.** Claude asks whatever it needs to, then writes the plan into `plans/`
   as a numbered list of small steps. Each step says what "done" looks like.
   **Nothing is built until you read it and say yes.** If a step looks wrong, say
   so &mdash; it is far cheaper to fix a sentence than working code.
2. **Build.** One step at a time. After every step Claude runs the automatic checks
   and tells you what changed. If a check fails it stops there rather than piling
   the next step on top.
3. **Validate.** Claude runs the checks again and tells you two things: what the
   computer confirmed, and **what you need to look at yourself**. The checks cannot
   tell whether a game is fun or a word is right. That part is still yours.

Step 3 is not a courtesy. The checks run automatically before Claude is allowed to
finish, and a failure is handed back to Claude rather than to you.

The plan file stays in the repo afterwards, so there is always a plain-language
record of what changed and why.

### Things Claude will refuse

Some of these are permanent decisions, not obstacles to work around:

- **Anything needing a server, a login, or an internet connection.** Every game here
  runs entirely in the browser, forever. Claude will offer an offline version
  instead.
- **Writing a Klallam word itself, anywhere.** It can read every word in the lexicon
  and use them in a game freely. What it cannot do is create one or correct a
  spelling. If a change needs a word that is not in the lexicon yet, Claude will say
  so and build the rest &mdash; the word is your job: edit the spreadsheet, then ask
  Claude to update the lexicon.
- **Carrying on after a check fails.**

---

## For developers

Requires Node 20 or newer.

```bash
npm run lexicon:import              # validate, diff, report - writes nothing
npm run lexicon:import -- --apply   # apply, then re-lock and verify
npm run lexicon:verify              # integrity check
npm run site:dev                    # the site: hub, games, review page, one address
npm run lexicon:review              # start the site, open it at the review page
npm test                            # integrity and codec tests
npm run ci                          # everything CI runs
```

`lexicon:import` is the whole update path: it validates the spreadsheet, diffs it
against the lexicon, applies the change, and reports what happened. Ids it generates
are written back into the sheet in place. The sheet is never rebuilt from the
lexicon, so anything else in the file survives.

Two kinds of change need saying out loud, because neither one can be undone by
editing the sheet again:

```bash
npm run lexicon:import -- --apply --allow-edits     # change the spelling of a word
npm run lexicon:import -- --apply --allow-deletes   # a row you removed means a deleted word
```

A word is deleted by deleting its row. The dry run prints its codepoints before
anything happens, so a row removed by mistake can be put back from that report.

```bash
npm run lexicon:mark-fix            # write out words using U+0315, corrected, to paste in
npm run lexicon:resolve -- <id>     # clear a review flag, once a speaker has ruled
npm run lexicon:flag -- <id> --reason "..."   # raise one
```

`lexicon:mark-fix` exists because nobody should retype a Klallam word to fix an
invisible mark. It writes the corrected spellings to a file and changes nothing
itself. `resolve` and `flag` are the only way review flags are set; they never touch
the Klallam text or the spreadsheet. Both are dry runs until `--apply`.

The workflow assumes `lexicon.xlsx` exists. If it is missing, damaged, has lost its
header row, or is open in Excel, the import stops and says which. Read the message
rather than working around it. When new words need ids written back, it checks the
sheet is writable *before* touching `lexicon.json`, so a failed run never leaves the
two out of step.

```bash
npm run lexicon:sheet               # recovery only: rebuild a lost spreadsheet
```

`lexicon:sheet` is **not** part of the normal loop, and running it out of habit will
cost you work. It generates the sheet *from* the lexicon, which is the wrong
direction: anything the lexicon does not store, such as a notes column, is gone. Use
version control to restore a deleted sheet. This is the last resort when there is no
copy to restore. It refuses to overwrite a sheet holding edits that have not been
imported.

### Generated files: do not hand-edit

| File | |
|---|---|
| `lexicon/lexicon.json` | Generated from the spreadsheet. Committed, so every change to a Klallam string is a readable diff. |
| `lexicon/lexicon.lock` | SHA-256 of the linguistic content. Any character change fails `lexicon:verify` until it is deliberately re-locked. |

If `lexicon:verify` fails complaining about the lock, a Klallam string changed. That
is either an import you meant to make, or something to look into.

### Design notes

- `PLAN.md` &mdash; architecture, tech decisions, and why the safeguards exist
- `CLAUDE.md` &mdash; rules for AI agents working in this repo
- `.claude/skills/update-lexicon/` &mdash; the lexicon workflow, for agents
- `.claude/skills/{plan,build,validate}/` &mdash; the loop for every other change
- `.claude/hooks/require-green.mjs` &mdash; Stop hook; blocks an agent from finishing a turn that left `npm run ci` red

The short version of the rule agents follow: **an agent never types Klallam
characters.** Text goes from a speaker's keyboard into Excel, and from Excel into
`lexicon.json` through a parser. It never passes through a language model, where a
combining mark could be altered in a way nobody would see.
