const assert = require("assert");
const { processGraph, server } = require("./server");

function getByRoot(result, root) {
  return result.hierarchies.find((item) => item.root === root);
}

function checkIdentity(result) {
  assert.strictEqual(result.user_id, "souravsingh_20240615");
  assert.strictEqual(result.email_id, "sourav.singh.btech2023@sitpune.edu.in");
  assert.strictEqual(result.enrollment_number, "23070122257");
}

function testPdfExampleWithExtraCases() {
  const result = processGraph([
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
    "G->H",
    "G->I",
    "hello",
    "1->2",
    "A->",
    " A->B ",
    "A->A",
    "M->N",
    "O->N",
  ]);

  checkIdentity(result);
  assert.strictEqual(result.summary.total_trees, 4);
  assert.strictEqual(result.summary.total_cycles, 1);
  assert.strictEqual(result.summary.largest_tree_root, "A");
  assert.deepStrictEqual(result.duplicate_edges, ["G->H", "A->B"]);
  assert.deepStrictEqual(result.invalid_entries, ["hello", "1->2", "A->", "A->A"]);

  assert.strictEqual(getByRoot(result, "A").depth, 4);
  assert.deepStrictEqual(getByRoot(result, "A").tree, {
    A: {
      B: { D: {} },
      C: { E: { F: {} } },
    },
  });

  assert.deepStrictEqual(getByRoot(result, "X"), {
    root: "X",
    tree: {},
    has_cycle: true,
  });

  assert.deepStrictEqual(getByRoot(result, "M").tree, {
    M: {
      N: {},
    },
  });
}

function testInvalidEntries() {
  const result = processGraph([
    "",
    "   ",
    "hello",
    "1->2",
    "AB->C",
    "A-B",
    "A->",
    "A->A",
    "a->B",
    null,
  ]);

  checkIdentity(result);
  assert.deepStrictEqual(result.invalid_entries, [
    "",
    "",
    "hello",
    "1->2",
    "AB->C",
    "A-B",
    "A->",
    "A->A",
    "a->B",
    "",
  ]);
  assert.deepStrictEqual(result.hierarchies, []);
  assert.deepStrictEqual(result.duplicate_edges, []);
  assert.deepStrictEqual(result.summary, {
    total_trees: 0,
    total_cycles: 0,
    largest_tree_root: "",
  });
}

function testDuplicateOnlyLoggedOnce() {
  const result = processGraph(["A->B", "A->B", "A->B", "B->C"]);

  assert.deepStrictEqual(result.duplicate_edges, ["A->B"]);
  assert.strictEqual(result.summary.total_trees, 1);
  assert.strictEqual(getByRoot(result, "A").depth, 3);
}

function testTieBreakerForLargestTree() {
  const result = processGraph(["B->C", "A->D"]);

  assert.strictEqual(result.summary.total_trees, 2);
  assert.strictEqual(result.summary.largest_tree_root, "A");
}

function testPureCycleUsesSmallestNodeAsRoot() {
  const result = processGraph(["C->A", "A->B", "B->C"]);

  assert.strictEqual(result.summary.total_cycles, 1);
  assert.deepStrictEqual(result.hierarchies[0], {
    root: "A",
    tree: {},
    has_cycle: true,
  });
}

function testDiscardedParentCanBreakCycle() {
  const result = processGraph(["A->B", "B->C", "C->B"]);

  assert.strictEqual(result.summary.total_trees, 1);
  assert.strictEqual(result.summary.total_cycles, 0);
  assert.deepStrictEqual(getByRoot(result, "A").tree, {
    A: {
      B: {
        C: {},
      },
    },
  });
}

function testMultiParentFirstParentWins() {
  const result = processGraph(["A->D", "B->D", "B->E"]);

  assert.strictEqual(result.summary.total_trees, 2);
  assert.deepStrictEqual(getByRoot(result, "A").tree, { A: { D: {} } });
  assert.deepStrictEqual(getByRoot(result, "B").tree, { B: { E: {} } });
}

function testLargeInputUnderLimit() {
  const edges = [];
  for (let i = 0; i < 25; i += 1) {
    const parent = String.fromCharCode(65 + i);
    const child = String.fromCharCode(66 + i);
    edges.push(`${parent}->${child}`);
  }

  const result = processGraph(edges);
  assert.strictEqual(result.summary.total_trees, 1);
  assert.strictEqual(result.summary.largest_tree_root, "A");
  assert.strictEqual(getByRoot(result, "A").depth, 26);
}

async function testHttpRouteAndCors() {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const response = await fetch(`${baseUrl}/api/graph`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ edges: ["A->B"] }),
  });
  const body = await response.json();

  assert.strictEqual(response.status, 200);
  assert.strictEqual(response.headers.get("access-control-allow-origin"), "*");
  assert.strictEqual(body.summary.total_trees, 1);

  const badRoute = await fetch(`${baseUrl}/bfhl`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ edges: ["A->B"] }),
  });
  assert.strictEqual(badRoute.status, 404);

  const badBody = await fetch(`${baseUrl}/api/graph`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ wrong: [] }),
  });
  assert.strictEqual(badBody.status, 400);

  await new Promise((resolve) => server.close(resolve));
}

async function runTests() {
  testPdfExampleWithExtraCases();
  testInvalidEntries();
  testDuplicateOnlyLoggedOnce();
  testTieBreakerForLargestTree();
  testPureCycleUsesSmallestNodeAsRoot();
  testDiscardedParentCanBreakCycle();
  testMultiParentFirstParentWins();
  testLargeInputUnderLimit();
  await testHttpRouteAndCors();

  console.log("All tests passed");
}

runTests().catch((error) => {
  server.close(() => {
    console.error(error);
    process.exit(1);
  });
});
