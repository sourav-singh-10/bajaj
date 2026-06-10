const sampleEdges = [
  "A->B",
  "A->C",
  "B->D",
  "C->E",
  "E->F",
  "X->Y",
  "Y->Z",
  "Z->X",
  "P->Q",
  "Q->R",
  "G->H",
  "G->H",
  "G->I",
  "hello",
  "1->2",
  "A->",
];

const BACKEND_URL = "";

const edgesInput = document.getElementById("edges");
const submitBtn = document.getElementById("submitBtn");
const sampleBtn = document.getElementById("sampleBtn");
const message = document.getElementById("message");
const summary = document.getElementById("summary");
const hierarchies = document.getElementById("hierarchies");
const rawOutput = document.getElementById("rawOutput");

function parseEdges(text) {
  const cleaned = text.trim();

  if (!cleaned) {
    return [];
  }

  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch (error) {
    // Fall back to the friendlier line/comma format.
  }

  return cleaned
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function makeTreeList(tree) {
  const ul = document.createElement("ul");
  ul.className = "tree";

  for (const [node, children] of Object.entries(tree)) {
    const li = document.createElement("li");
    li.textContent = node;

    if (Object.keys(children).length > 0) {
      li.appendChild(makeTreeList(children));
    }

    ul.appendChild(li);
  }

  return ul;
}

function renderSummary(data) {
  summary.innerHTML = "";

  const metrics = [
    ["Trees", data.summary.total_trees],
    ["Cycles", data.summary.total_cycles],
    ["Largest root", data.summary.largest_tree_root || "-"],
  ];

  for (const [label, value] of metrics) {
    const item = document.createElement("div");
    item.className = "metric";
    item.innerHTML = `<span>${label}</span><strong>${value}</strong>`;
    summary.appendChild(item);
  }
}

function renderHierarchies(data) {
  hierarchies.innerHTML = "";

  for (const item of data.hierarchies) {
    const card = document.createElement("article");
    card.className = "tree-card";

    const header = document.createElement("header");
    const title = document.createElement("h2");
    title.textContent = `Root: ${item.root}`;

    const tag = document.createElement("span");
    tag.className = item.has_cycle ? "tag cycle" : "tag";
    tag.textContent = item.has_cycle ? "Cycle found" : `Depth ${item.depth}`;

    header.append(title, tag);
    card.appendChild(header);

    if (item.has_cycle) {
      const empty = document.createElement("p");
      empty.className = "empty";
      empty.textContent = "This group contains a cycle, so the tree is empty.";
      card.appendChild(empty);
    } else {
      card.appendChild(makeTreeList(item.tree));
    }

    hierarchies.appendChild(card);
  }

  if (data.invalid_entries.length || data.duplicate_edges.length) {
    const card = document.createElement("article");
    card.className = "tree-card";
    card.innerHTML = `
      <header><h2>Input notes</h2><span class="tag">Checked</span></header>
      <p><strong>Invalid:</strong> ${data.invalid_entries.join(", ") || "None"}</p>
      <p><strong>Duplicates:</strong> ${data.duplicate_edges.join(", ") || "None"}</p>
    `;
    hierarchies.appendChild(card);
  }
}

async function submitEdges() {
  const apiUrl = `${BACKEND_URL || window.location.origin}/api/graph`;
  const edges = parseEdges(edgesInput.value);

  message.textContent = "";
  submitBtn.disabled = true;
  submitBtn.textContent = "Checking...";

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ edges }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "API call failed");
    }

    renderSummary(data);
    renderHierarchies(data);
    rawOutput.textContent = JSON.stringify(data, null, 2);
  } catch (error) {
    message.textContent = error.message;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Submit";
  }
}

sampleBtn.addEventListener("click", () => {
  edgesInput.value = sampleEdges.join("\n");
});

submitBtn.addEventListener("click", submitEdges);
submitEdges();
