const http = require("http");
const path = require("path");
const fs = require("fs");

const PORT = process.env.PORT || 3000;

const identity = {
  user_id: "souravsingh_20240615",
  email_id: "sourav.singh.btech2023@sitpune.edu.in",
  enrollment_number: "23070122257",
};

function isEdge(value) {
  return /^[A-Z]->[A-Z]$/.test(value);
}

function addToMapList(map, key, value) {
  if (!map.has(key)) {
    map.set(key, []);
  }
  map.get(key).push(value);
}

function getComponents(nodes, edges) {
  const links = new Map();

  for (const node of nodes) {
    links.set(node, new Set());
  }

  for (const edge of edges) {
    links.get(edge.parent).add(edge.child);
    links.get(edge.child).add(edge.parent);
  }

  const seen = new Set();
  const components = [];

  for (const node of nodes) {
    if (seen.has(node)) {
      continue;
    }

    const stack = [node];
    const group = [];
    seen.add(node);

    while (stack.length) {
      const current = stack.pop();
      group.push(current);

      for (const next of links.get(current)) {
        if (!seen.has(next)) {
          seen.add(next);
          stack.push(next);
        }
      }
    }

    components.push(group);
  }

  return components;
}

function hasCycleInComponent(component, childrenMap) {
  const allowed = new Set(component);
  const visiting = new Set();
  const done = new Set();

  function visit(node) {
    if (visiting.has(node)) {
      return true;
    }
    if (done.has(node)) {
      return false;
    }

    visiting.add(node);

    for (const child of childrenMap.get(node) || []) {
      if (allowed.has(child) && visit(child)) {
        return true;
      }
    }

    visiting.delete(node);
    done.add(node);
    return false;
  }

  for (const node of component) {
    if (visit(node)) {
      return true;
    }
  }

  return false;
}

function buildTree(node, childrenMap) {
  const nested = {};

  for (const child of childrenMap.get(node) || []) {
    nested[child] = buildTree(child, childrenMap);
  }

  return nested;
}

function getDepth(node, childrenMap) {
  const children = childrenMap.get(node) || [];

  if (children.length === 0) {
    return 1;
  }

  return 1 + Math.max(...children.map((child) => getDepth(child, childrenMap)));
}

function getRoot(component, childSet) {
  const roots = component.filter((node) => !childSet.has(node)).sort();
  return roots[0] || [...component].sort()[0];
}

function processGraph(edgesInput) {
  const invalidEntries = [];
  const duplicateEdges = [];
  const duplicateLogged = new Set();
  const seenEdges = new Set();
  const parentByChild = new Map();
  const edges = [];

  for (const rawEdge of edgesInput) {
    const entry = String(rawEdge ?? "").trim();

    if (!isEdge(entry)) {
      invalidEntries.push(entry);
      continue;
    }

    const [parent, child] = entry.split("->");

    if (parent === child) {
      invalidEntries.push(entry);
      continue;
    }

    if (seenEdges.has(entry)) {
      if (!duplicateLogged.has(entry)) {
        duplicateEdges.push(entry);
        duplicateLogged.add(entry);
      }
      continue;
    }

    seenEdges.add(entry);

    if (parentByChild.has(child)) {
      continue;
    }

    parentByChild.set(child, parent);
    edges.push({ parent, child });
  }

  const childrenMap = new Map();
  const nodes = [];
  const nodeSet = new Set();
  const childSet = new Set();

  function addNode(node) {
    if (!nodeSet.has(node)) {
      nodeSet.add(node);
      nodes.push(node);
    }
  }

  for (const edge of edges) {
    addNode(edge.parent);
    addNode(edge.child);
    childSet.add(edge.child);
    addToMapList(childrenMap, edge.parent, edge.child);
  }

  const components = getComponents(nodes, edges);
  const hierarchies = [];
  let totalTrees = 0;
  let totalCycles = 0;
  let largestTreeRoot = "";
  let largestDepth = 0;

  for (const component of components) {
    const root = getRoot(component, childSet);
    const hasCycle = hasCycleInComponent(component, childrenMap);

    if (hasCycle) {
      totalCycles += 1;
      hierarchies.push({
        root,
        tree: {},
        has_cycle: true,
      });
      continue;
    }

    const depth = getDepth(root, childrenMap);
    totalTrees += 1;
    hierarchies.push({
      root,
      tree: {
        [root]: buildTree(root, childrenMap),
      },
      depth,
    });

    if (
      depth > largestDepth ||
      (depth === largestDepth && (largestTreeRoot === "" || root < largestTreeRoot))
    ) {
      largestTreeRoot = root;
      largestDepth = depth;
    }
  }

  return {
    ...identity,
    hierarchies,
    invalid_entries: invalidEntries,
    duplicate_edges: duplicateEdges,
    summary: {
      total_trees: totalTrees,
      total_cycles: totalCycles,
      largest_tree_root: largestTreeRoot,
    },
  };
}

function sendJson(res, statusCode, data) {
  const body = JSON.stringify(data, null, 2);

  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(body);
}

function sendFile(res, filePath, contentType) {
  fs.readFile(filePath, (error, data) => {
    if (error) {
      sendJson(res, 404, { error: "File not found" });
      return;
    }

    res.writeHead(200, {
      "Content-Type": contentType,
      "Content-Length": data.length,
      "Access-Control-Allow-Origin": "*",
    });
    res.end(data);
  });
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk;

      if (body.length > 1024 * 1024) {
        reject(new Error("Request body is too large"));
        req.destroy();
      }
    });

    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
    return;
  }

  if (req.method === "GET" && (req.url === "/" || req.url === "/index.html")) {
    sendFile(res, path.join(__dirname, "public", "index.html"), "text/html; charset=utf-8");
    return;
  }

  if (req.method === "GET" && req.url === "/style.css") {
    sendFile(res, path.join(__dirname, "public", "style.css"), "text/css; charset=utf-8");
    return;
  }

  if (req.method === "GET" && req.url === "/app.js") {
    sendFile(res, path.join(__dirname, "public", "app.js"), "application/javascript; charset=utf-8");
    return;
  }

  if (req.method === "POST" && req.url === "/api/graph") {
    try {
      const body = await readRequestBody(req);
      const data = JSON.parse(body || "{}");

      if (!Array.isArray(data.edges)) {
        sendJson(res, 400, { error: "Please send JSON with an edges array." });
        return;
      }

      sendJson(res, 200, processGraph(data.edges));
    } catch (error) {
      sendJson(res, 400, { error: error.message || "Invalid request body." });
    }
    return;
  }

  sendJson(res, 404, { error: "Route not found" });
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

module.exports = { processGraph, server };
