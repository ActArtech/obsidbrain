// GitHub source adapter: pulls the issue graph via `gh api graphql` (read-only)
// and projects it into the dual-views work-item format.
//
// Conventions (deliberately light):
//   label `outcome`     → kind outcome   (title = issue title, flowOrder = issue number)
//   label `capability`  → kind capability (parent = parent issue if it's an outcome)
//   label `service:<x>` → kind service, key svc:<x>
//   any other issue     → leaf task
//   task → capability:  label `cap:<capability-key>`   (capability key = gh-<number>)
//   task → service:     label `svc:<service-key>
//   status: CLOSED → done; OPEN + label `blocked` → blocked; OPEN + linked PR → in_progress; else todo
//   linked PR detection needs extra queries; v1: label `wip` also means in_progress.

import { execFileSync } from "node:child_process";

export async function fetchGitHubWorkItems(ownerRepo, { limit = 100 } = {}) {
  const [owner, repo] = ownerRepo.split("/");
  if (!owner || !repo) throw new Error("--source gh:owner/repo expected");

  const query = `
    query($owner: String!, $repo: String!, $n: Int!) {
      repository(owner: $owner, name: $repo) {
        issues(first: $n, orderBy: { field: CREATED_AT, direction: DESC }) {
          nodes {
            number title url state
            labels(first: 20) { nodes { name } }
            parent { number }
          }
        }
      }
    }`;
  const raw = gh(["api", "graphql", "-f", `query=${query}`, "-f", `owner=${owner}`, "-f", `repo=${repo}`, "-F", `n=${limit}`]);
  const json = JSON.parse(raw);
  if (json.errors) throw new Error("GraphQL errors: " + JSON.stringify(json.errors));
  return projectIssues(json.data.repository.issues.nodes);
}

export function projectIssues(nodes) {
  const items = [];
  const services = new Map(); // svc key → title
  const untriaged = []; // issues with no capability anchor
  for (const n of nodes) {
    const labels = n.labels.nodes.map((l) => l.name);
    const key = "gh-" + n.number;
    const base = { key, title: n.title, url: n.url };
    if (labels.includes("outcome")) {
      items.push({ ...base, kind: "outcome", flowOrder: n.number, status: stateOf(n, labels) });
    } else if (labels.includes("capability")) {
      items.push({
        ...base,
        kind: "capability",
        parent: n.parent ? "gh-" + n.parent.number : null,
        status: stateOf(n, labels),
      });
    } else {
      const svcLabel = labels.find((l) => l.startsWith("service:"));
      const capLabel = labels.find((l) => l.startsWith("cap:"));
      const svcKey = svcLabel ? "svc:" + svcLabel.slice(8).trim() : null;
      if (svcLabel && !services.has(svcKey)) {
        services.set(svcKey, svcKey);
      }
      const capKey = capLabel ? "gh-" + capLabel.slice(4).trim() : inferCapabilityFromParent(n);
      if (!capKey) {
        untriaged.push({ ...base, kind: "task", capability: null, service: svcKey, status: stateOf(n, labels), size: 1 });
        continue;
      }
      items.push({ ...base, kind: "task", capability: capKey, service: svcKey, status: stateOf(n, labels), size: 1 });
    }
  }
  // onboarding fallback: no outcome labels yet → bucket everything under a
  // synthetic Backlog outcome so the first run still renders something real
  if (!items.some((i) => i.kind === "outcome") && untriaged.length) {
    items.push({ key: "auto:backlog", kind: "outcome", title: "Backlog (untriaged)", flowOrder: 1 });
    items.push({ key: "auto:untriaged", kind: "capability", title: "Untriaged issues", parent: "auto:backlog" });
    for (const t of untriaged) items.push({ ...t, capability: "auto:untriaged" });
  }
  // materialize service nodes for every referenced service key
  for (const [k] of services) {
    items.push({ key: k, title: k.slice(4), kind: "service" });
  }
  // drop capabilities that can't be placed under a known outcome
  const outcomeKeys = new Set(items.filter((i) => i.kind === "outcome").map((i) => i.key));
  return items.filter((i) => i.kind !== "capability" || (i.parent && outcomeKeys.has(i.parent)));
}

function inferCapabilityFromParent(n) {
  // GitHub sub-issue parent may itself be the capability
  return n.parent ? "gh-" + n.parent.number : null;
}

function stateOf(n, labels) {
  if (n.state === "CLOSED") return "done";
  if (labels.includes("blocked")) return "blocked";
  if (labels.includes("wip")) return "in_progress";
  return "todo";
}

function gh(args) {
  try {
    return execFileSync("gh", args, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
  } catch (e) {
    if (e.code === "ENOENT") {
      throw new Error(
        "GitHub CLI ('gh') not found. Install it from https://cli.github.com and run 'gh auth login', " +
          "or use a JSON source instead: --source <workitems.json>"
      );
    }
    if (e.code === 1 && /auth/i.test(String(e.stderr || ""))) {
      throw new Error("gh is not authenticated. Run 'gh auth login' first.");
    }
    throw new Error("gh api failed: " + (e.stderr ? String(e.stderr).slice(0, 300) : e.message));
  }
}
