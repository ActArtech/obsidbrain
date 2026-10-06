#!/usr/bin/env node
// Generates the Knowledge Garden manifest deterministically:
// a realistic ~65-note, 3-level brain with literature notes, people,
// journal entries, questions, and a deliberate link topology at scale.
//
//   node generate.mjs            # writes manifest.json next to this file

import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const HERE = path.dirname(url.fileURLToPath(import.meta.url));

const files = {};
const add = (rel, title, body, links = []) => {
  const linkMd = links.length
    ? "\n\n" + links.map((l) => `- Relates to [[${l}]]`).join("\n")
    : "";
  files[rel] = `# ${title}\n\n${body}${linkMd}\n`;
};

/* ── Fields (level 2) ──────────────────────────────────────────────────── */
const fields = {
  "Mathematics": {
    body: "The language the garden is planted in. Entropy shows up everywhere once you learn to see it.",
    links: ["Garden/Fields/Information Theory", "Garden/Fields/Topics/Chaos"],
  },
  "Systems Thinking": {
    body: "Stocks, flows, feedback loops, and leverage points. The backbone of how I read anything complex.",
    links: ["Garden/Fields/Topics/Networks", "Garden/Methods/Simulation", "Garden/Fields/Biology"],
  },
  "Information Theory": {
    body: "Bits, channels, noise, and surprise. Mutual information is the most useful idea nobody uses.",
    links: ["Garden/Fields/Mathematics", "Garden/Fields/Topics/Signal and Noise"],
  },
  "Biology": {
    body: "Evolution as an algorithm. Redundancy, robustness, and the economy of the cell.",
    links: ["Garden/Fields/Systems Thinking", "Garden/Fields/Topics/Emergence"],
  },
};
for (const [name, f] of Object.entries(fields)) add(`Fields/${name}.md`, name, f.body, f.links);

/* ── Topics (level 3) — chains, mutual pairs, a hub topic ──────────────── */
const topics = {
  "Chaos": { body: "Sensitive dependence. The butterfly as a budget of predictability.", links: ["Garden/Fields/Mathematics"] },
  "Networks": { body: "Hubs, percolation, small worlds. Structure beats strength.", links: ["Garden/Fields/Topics/Emergence"] },
  "Emergence": { body: "More is different. The whole asserting rights over the parts.", links: ["Garden/Fields/Biology", "Garden/Fields/Systems Thinking", "Garden/Fields/Topics/Networks"] },
  "Signal and Noise": { body: "Every measurement is a negotiation with noise.", links: ["Garden/Fields/Information Theory"] },
  "Feedback": { body: "Loops that amplify or dampen. The causal fabric of systems.", links: ["Garden/Fields/Systems Thinking"] },
  "Scaling Laws": { body: "Why mice, cities, and companies obey similar curves.", links: ["Garden/Fields/Biology", "Garden/Fields/Topics/Networks"] },
  "Entropy and Life": { body: "Schrödinger's question: what keeps the garden far from equilibrium?", links: ["Garden/Fields/Information Theory", "Garden/Fields/Biology"] },
  "Game Theory": { body: "Strategies, equilibria, and the price of honesty.", links: [] },
  "Tipping Points": { body: "When gradual becomes sudden. Bistability everywhere.", links: ["Garden/Fields/Topics/Feedback", "Garden/Fields/Topics/Networks"] },
  "Redundancy": { body: "Backup copies as a survival strategy, from cells to servers.", links: ["Garden/Fields/Biology"] },
};
for (const [name, t] of Object.entries(topics)) add(`Fields/Topics/${name}.md`, name, t.body, t.links);

/* ── Methods ───────────────────────────────────────────────────────────── */
const methods = {
  "Zettelkasten": { body: "Atomic notes, addressed once, linked forever. This garden's planting technique.", links: ["Garden/Methods/Spaced Repetition", "Garden/Projects/Writing Book"] },
  "Spaced Repetition": { body: "Memory's compound interest. Review what you want to keep, when you're about to forget.", links: ["Garden/Methods/Zettelkasten"] },
  "Feynman Technique": { body: "If you can't explain it simply, you don't have the note yet.", links: ["Garden/Methods/Zettelkasten"] },
  "Simulation": { body: "When intuition fails, build the smallest world that still surprises you.", links: ["Garden/Fields/Systems Thinking", "Garden/Fields/Topics/Feedback"] },
  "Marginalia": { body: "Reading with a pen: conversations in the margins become literature notes.", links: ["Garden/Sources/Thinking in Systems"] },
};
for (const [name, m] of Object.entries(methods)) add(`Methods/${name}.md`, name, m.body, m.links);

/* ── Practices (level 3 under Methods) ─────────────────────────────────── */
const practices = {
  "Daily Note Ritual": { body: "Ten minutes each evening: harvest fleeting notes, water one topic.", links: ["Garden/Methods/Zettelkasten"] },
  "Weekly Review": { body: "Regenerate the indexes, read the maps, prune what died.", links: ["Garden/Methods/Practices/Daily Note Ritual"] },
  "Reading Queue Hygiene": { body: "Three active books maximum. The queue is a commitment device.", links: ["Garden/Inbox/Reading Queue"] },
};
for (const [name, p] of Object.entries(practices)) add(`Methods/Practices/${name}.md`, name, p.body, p.links);

/* ── People — mutual links with their ideas ────────────────────────────── */
const people = {
  "Donella Meadows": { body: "Leverage points and the dance of the loops.", links: ["Garden/Fields/Systems Thinking", "Garden/Sources/Thinking in Systems"] },
  "Claude Shannon": { body: "Gave noise a mathematical address.", links: ["Garden/Fields/Information Theory"] },
  "Ludwig von Bertalanffy": { body: "General systems before it was cool.", links: ["Garden/Fields/Systems Thinking", "Garden/Fields/Biology"] },
  "Albert-László Barabási": { body: "Linked: the anatomy of hubs.", links: ["Garden/Fields/Topics/Networks"] },
  "Sönke Ahrens": { body: "How to Take Smart Notes — the Zettelkasten field manual.", links: ["Garden/Methods/Zettelkasten", "Garden/Sources/How to Take Smart Notes"] },
};
for (const [name, p] of Object.entries(people)) add(`People/${name}.md`, name, p.body, p.links);

/* ── Sources — literature notes, heavily linked from fields ────────────── */
const sources = {
  "Thinking in Systems": { body: "Meadows' primer: stocks, flows, and the twelve leverage points.", links: ["Garden/People/Donella Meadows", "Garden/Fields/Systems Thinking"] },
  "A Mathematical Theory of Communication": { body: "The 1948 paper that minted the bit.", links: ["Garden/People/Claude Shannon", "Garden/Fields/Information Theory"] },
  "General System Theory": { body: "Bertalanffy's program for a science of wholeness.", links: ["Garden/People/Ludwig von Bertalanffy"] },
  "Linked": { body: "Networks from Pareto to the web.", links: ["Garden/People/Albert-László Barabási", "Garden/Fields/Topics/Networks"] },
  "How to Take Smart Notes": { body: "Ahrens on Zettelkasten as a thinking prosthetic.", links: ["Garden/People/Sönke Ahrens", "Garden/Methods/Zettelkasten"] },
  "Scale": { body: "West on cities, companies, and the quantitation of growth.", links: ["Garden/Fields/Topics/Scaling Laws"] },
  "What is Life": { body: "Schrödinger's entropy export.", links: ["Garden/Fields/Topics/Entropy and Life"] },
  "The Tipping Point": { body: "Gladwell's popularization of critical masses.", links: ["Garden/Fields/Topics/Tipping Points"] },
};
for (const [name, s] of Object.entries(sources)) add(`Sources/${name}.md`, name, s.body, s.links);

/* ── Projects ──────────────────────────────────────────────────────────── */
const projects = {
  "Garden Site": { body: "Publish the garden as a digital garden: notes as seedlings, buds, evergreen.", links: ["Garden/Projects/Writing Book", "Garden/Methods/Zettelkasten"] },
  "Writing Book": { body: "The long essay collection growing out of Systems Thinking notes.", links: ["Garden/Fields/Systems Thinking", "Garden/Methods/Feynman Technique"] },
};
for (const [name, p] of Object.entries(projects)) add(`Projects/${name}.md`, name, p.body, p.links);

/* ── Journal — daily entries linking into the garden ───────────────────── */
const journal = [
  ["2026-09-28", ["Garden/Fields/Topics/Emergence", "Garden/Sources/Scale"], "Re-read Scale ch.3; connected scaling to networks — feels like one idea wearing two coats."],
  ["2026-09-30", ["Garden/Methods/Zettelkasten", "Garden/Projects/Garden Site"], "Decided the site ships before the book. Garden first, fruit later."],
  ["2026-10-02", ["Garden/Fields/Information Theory", "Garden/Fields/Topics/Signal and Noise"], "Mutual information clicked while re-deriving channel capacity by hand."],
  ["2026-10-04", ["Garden/People/Donella Meadows", "Garden/Fields/Topics/Feedback"], "Meadows' leverage points mapped onto my own habits. Loops everywhere."],
  ["2026-10-06", ["Garden/Methods/Practices/Weekly Review", "Garden/Fields/Topics/Tipping Points"], "Weekly review: regenerated the maps, pruned two dead topics, wrote up tipping points."],
];
for (const [date, links, body] of journal) add(`Journal/${date}.md`, date, body, links);

/* ── Inbox — fleeting notes, questions, a reading queue hub ────────────── */
add("Inbox/Reading Queue.md", "Reading Queue", "The active queue (three max):\n\n1. [[Garden/Sources/Scale|Scale]] — ch. 5 next\n2. [[Garden/Sources/Linked|Linked]]\n3. [[Garden/Sources/What is Life|What is Life?]]", []);
for (const [q, links] of [
  ["Question - is emergence just ignorance", ["Garden/Fields/Topics/Emergence", "Garden/Fields/Mathematics"]],
  ["Question - can a Zettelkasten tip", ["Garden/Fields/Topics/Tipping Points", "Garden/Methods/Zettelkasten"]],
  ["Question - entropy of a note", ["Garden/Fields/Information Theory", "Garden/Methods/Zettelkasten"]],
  ["Fleeting - feedback loop in pricing", ["Garden/Fields/Topics/Feedback"]],
  ["Fleeting - redundancy in folklore", ["Garden/Fields/Topics/Redundancy"]],
  ["Fleeting - noise as feature", ["Garden/Fields/Topics/Signal and Noise"]],
]) {
  add(`Inbox/${q}.md`, q.replace(/ - /, ": "), "Open thread captured on the move. To be watered into a permanent note — or composted.", links);
}

/* ── Root: Welcome hub + README ────────────────────────────────────────── */
add(
  "Welcome.md",
  "Welcome to the Knowledge Garden",
  "A demonstration brain at realistic scale: 60+ notes, three levels, ~140 wikilinks.\n\nEnter through the doors: [[Garden/Fields/Systems Thinking|Systems Thinking]], [[Garden/Fields/Information Theory|Information Theory]], [[Garden/Methods/Zettelkasten|Zettelkasten]], or the [[Garden/Inbox/Reading Queue|Reading Queue]]. The map of maps is the `_index` drawing in this folder.",
  ["Garden/Fields/Systems Thinking", "Garden/Fields/Information Theory", "Garden/Methods/Zettelkasten", "Garden/Inbox/Reading Queue", "Garden/Projects/Garden Site", "Garden/Sources/Thinking in Systems"]
);
files["attachments/README.md"] = "# Attachments\n\nImages and PDFs land here; the fractal index treats the folder as a pod.\n";

/* ── manifest ──────────────────────────────────────────────────────────── */
const manifest = {
  name: "Knowledge Garden",
  root: "Garden",
  files,
  indexes: ["", "Fields", "Fields/Topics", "Methods", "Methods/Practices", "People", "Projects", "Inbox", "Journal", "Sources", "attachments"],
};
fs.writeFileSync(path.join(HERE, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8");
const linkCount = Object.values(files).reduce((n, c) => n + (c.match(/\[\[/g) || []).length, 0);
console.log(`manifest.json: ${Object.keys(files).length} notes, ~${linkCount} wikilinks, ${manifest.indexes.length} index levels`);
