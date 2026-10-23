const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { after, test } = require("node:test");
const { createServer } = require("../server");

let temporaryDirectory;

after(async () => {
  if (temporaryDirectory) {
    await fs.rm(temporaryDirectory, { recursive: true, force: true });
  }
});

test("issue API validates, updates, and persists reports", async () => {
  temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "civicpulse-"));
  const dataFile = path.join(temporaryDirectory, "issues.json");
  let server = await createServer({ dataFile });

  async function start(currentServer) {
    await new Promise((resolve) => currentServer.listen(0, "127.0.0.1", resolve));
    return `http://127.0.0.1:${currentServer.address().port}`;
  }

  async function stop(currentServer) {
    await new Promise((resolve, reject) =>
      currentServer.close((error) => (error ? reject(error) : resolve())),
    );
  }

  let baseUrl = await start(server);
  const healthResponse = await fetch(`${baseUrl}/api/health`);
  assert.deepEqual(await healthResponse.json(), { status: "ok" });
  const dashboardResponse = await fetch(baseUrl);
  assert.equal(dashboardResponse.status, 200);
  assert.match(await dashboardResponse.text(), /CivicPulse/);

  const initialResponse = await fetch(`${baseUrl}/api/issues`);
  assert.equal(initialResponse.status, 200);
  assert.equal((await initialResponse.json()).length, 8);

  const invalidResponse = await fetch(`${baseUrl}/api/issues`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: "", category: "Unknown", location: "" }),
  });
  assert.equal(invalidResponse.status, 400);

  const invalidBodyResponse = await fetch(`${baseUrl}/api/issues`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "null",
  });
  assert.equal(invalidBodyResponse.status, 400);

  const createResponse = await fetch(`${baseUrl}/api/issues`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "New pothole",
      category: "Roads & sidewalks",
      location: "Main Street",
      priority: "High",
      description: "Needs repair.",
    }),
  });
  assert.equal(createResponse.status, 201);
  const createdIssue = await createResponse.json();
  assert.equal(createdIssue.id, "CP-2409");
  assert.equal(createdIssue.status, "open");

  const updateResponse = await fetch(
    `${baseUrl}/api/issues/${createdIssue.id}/status`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "resolved" }),
    },
  );
  assert.equal(updateResponse.status, 200);
  assert.equal((await updateResponse.json()).status, "resolved");
  await stop(server);

  server = await createServer({ dataFile });
  baseUrl = await start(server);
  try {
    const persistedResponse = await fetch(`${baseUrl}/api/issues`);
    const persistedIssues = await persistedResponse.json();
    assert.equal(persistedIssues.length, 9);
    assert.equal(
      persistedIssues.find((issue) => issue.id === createdIssue.id).status,
      "resolved",
    );
  } finally {
    await stop(server);
  }
});
