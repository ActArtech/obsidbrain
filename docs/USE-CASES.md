# Use-Case Recipes

Five ways to run a brain on Fractal Index, from reader to team. Each recipe
gives the folder shape, the link etiquette that makes the maps sing, and the
feature payoff.

---

## 1. The Reader / Researcher (Zettelkasten)

**Shape**
```
Research/
  Fields/<topic>.md          permanent notes, one idea each
  Fields/Topics/*.md         finer-grained sub-ideas
  Sources/<book or paper>.md literature notes
  Inbox/                     fleeting notes + questions
  Journal/2026-*.md          what you actually did
```
**Etiquette** — every literature note links to the ideas it planted, and the
permanent note links back (`[[Source]]` under each idea). Questions in the
Inbox link to the fields they're about.

**Payoff** — the root map becomes your citation index: `Sources ⇄ Fields`
pod arrows *are* your reading history. The Inbox questions show up as arrows
into fields — open threads, visible from orbit. (This is exactly the
Knowledge Garden example.)

## 2. The Builder (project portfolio)

**Shape**
```
Projects/
  Roadmap.md                 one hub note naming active work
  Website/<brief, design, …>
  Mobile/<prd, api, …>
  Shared/<component library, brand>
```
**Etiquette** — anything that *depends* on something in another project gets
a wikilink to it (`API Contract → [[Design System]]`). The Roadmap links to
each project's key note.

**Payoff** — cross-project dependency arrows between pods, visible without
opening any project. "Who depends on the shared library?" is answered by
counting arrows into `Shared`. (The Project Hub example.)

## 3. The Writer (book / long-form)

**Shape**
```
Book/
  Outline.md                 the spine: links chapters to claims
  Claims/<one argument per note>.md
  Evidence/<quote, data, anecdote>.md
  Chapters/<draft fragments>.md
```
**Etiquette** — every claim links its evidence; every chapter links its
claims. Contradicting evidence links *the same claim* — mutual arrows.

**Payoff** — the `Claims` map shows load-bearing arguments by arrow count;
the `Outline` becomes a structural map of the book where weak chapters (few
links) stand out visually.

## 4. The Operator (PARA-lite life admin)

**Shape**
```
Life/
  Areas/<health, finance, home>.md
  Projects/<active, time-boxed>.md
  Journal/2026-*.md
  Reference/<manuals, contacts>.md
```
**Etiquette** — journal entries link the area they touched; projects link
their area (a project without an area arrow is orphaned *by definition* and
the map will show it).

**Payoff** — the weekly review is a 60-second top-down walk: regenerate,
and the map *is* the diff of your week. Neglected areas are literally
unlinked islands.

## 5. The Team (shared knowledge base)

**Shape**
```
KB/
  Decisions/<ADR-style notes>.md
  Runbooks/<procedure>.md
  Systems/<service>.md
  Meetings/<date — topic>.md
```
**Etiquette** — every decision links the system it concerns; every runbook
links the systems it operates; meeting notes link decisions made in them.

**Payoff** — the root map is an always-current dependency map of your
architecture *plus* its decision history, maintained as a side effect of
writing things down. New teammates read the maps, not the folder tree.

---

## Choosing your shape

- If your value is **remembering connections** → Recipe 1 or 3.
- If your value is **coordinating work** → Recipe 2 or 5.
- If your value is **consistency over time** → Recipe 4.

All five run on the same two scripts; only folder shape and link etiquette
differ. Start with one folder, one map, and let the ritual grow outward —
the fractal does.
