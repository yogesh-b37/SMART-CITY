const fs = require("node:fs/promises");
const http = require("node:http");
const path = require("node:path");

const categories = new Set([
  "Roads & sidewalks",
  "Street lighting",
  "Waste & recycling",
  "Parks & public spaces",
  "Water & drainage",
  "Traffic & safety",
  "Other",
]);
const priorities = new Set(["Normal", "High", "Urgent"]);
const statuses = new Set(["open", "in-progress", "resolved"]);
const staticFiles = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/index.html", ["index.html", "text/html; charset=utf-8"]],
  ["/app.js", ["app.js", "text/javascript; charset=utf-8"]],
  ["/styles.css", ["styles.css", "text/css; charset=utf-8"]],
]);

const seedIssues = [
  ["Pothole on Maple Street", "Roads & sidewalks", "Maple St & 4th Ave", "open", "High", "Large pothole causing cars to swerve into the next lane.", 0],
  ["Broken streetlight near park", "Street lighting", "Riverside Park, north gate", "in-progress", "Normal", "Streetlight has been out for several nights.", 1],
  ["Overflowing recycling bins", "Waste & recycling", "Oakwood Plaza", "open", "Normal", "Public recycling bins are full and need collection.", 1],
  ["Fallen branch blocking sidewalk", "Parks & public spaces", "Willow Creek Trail", "in-progress", "Urgent", "A large branch is blocking the walking path.", 2],
  ["Water pooling at crosswalk", "Water & drainage", "Pine St & 8th Avenue", "resolved", "Normal", "Standing water at the pedestrian crossing after rain.", 3],
  ["Traffic signal timing issue", "Traffic & safety", "Central Blvd & 2nd St", "open", "High", "The signal is not giving pedestrians enough crossing time.", 4],
  ["Damaged bench in public square", "Parks & public spaces", "Founders Square", "resolved", "Normal", "One of the park benches has a damaged seat.", 7],
  ["Street sign needs replacement", "Roads & sidewalks", "Cedar Lane & 3rd St", "in-progress", "Normal", "The street sign is difficult to read.", 12],
].map(([title, category, location, status, priority, description, daysAgo], index) => ({
  id: `CP-${2408 - index}`,
  title,
  category,
  location,
  status,
  priority,
  description,
  createdAt: new Date(Date.now() - daysAgo * 86400000).toISOString(),
}));

class HttpError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

function isIssue(issue) {
  return (
    issue !== null &&
    typeof issue === "object" &&
    typeof issue.id === "string" &&
    typeof issue.title === "string" &&
    typeof issue.category === "string" &&
    typeof issue.location === "string" &&
    statuses.has(issue.status) &&
    priorities.has(issue.priority) &&
    typeof issue.description === "string" &&
    typeof issue.createdAt === "string" &&
    Number.isFinite(Date.parse(issue.createdAt))
  );
}

async function readJson(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 1024 * 1024) {
      throw new HttpError(413, "Request body is too large.");
    }
  }
  try {
    return JSON.parse(body);
  } catch {
    throw new HttpError(400, "Request body must be valid JSON.");
  }
}

function sendJson(response, statusCode, value) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(JSON.stringify(value));
}

async function createIssueStore(dataFile) {
  await fs.mkdir(path.dirname(dataFile), { recursive: true });
  let issues;
  try {
    issues = JSON.parse(await fs.readFile(dataFile, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw new Error(`Unable to read issue data from ${dataFile}.`, {
        cause: error,
      });
    }
    issues = seedIssues;
    await fs.writeFile(dataFile, JSON.stringify(issues, null, 2));
  }

  if (!Array.isArray(issues) || issues.some((issue) => !isIssue(issue))) {
    throw new Error(`Issue data in ${dataFile} has an invalid format.`);
  }

  let mutationQueue = Promise.resolve();
  async function mutate(change) {
    const operation = mutationQueue.then(async () => {
      const nextIssues = change(issues);
      const temporaryFile = `${dataFile}.${process.pid}.tmp`;
      await fs.writeFile(temporaryFile, JSON.stringify(nextIssues, null, 2));
      await fs.rename(temporaryFile, dataFile);
      issues = nextIssues;
      return nextIssues;
    });
    mutationQueue = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  }

  return {
    getIssues: () => issues,
    createIssue: async (input) => {
      if (!input || typeof input !== "object" || Array.isArray(input)) {
        throw new HttpError(400, "Request body must be a JSON object.");
      }
      const title = typeof input?.title === "string" ? input.title.trim() : "";
      const location =
        typeof input?.location === "string" ? input.location.trim() : "";
      if (!title || title.length > 90) {
        throw new HttpError(400, "Title is required and must be 90 characters or fewer.");
      }
      if (!location || location.length > 100) {
        throw new HttpError(
          400,
          "Location is required and must be 100 characters or fewer.",
        );
      }
      if (!categories.has(input.category)) {
        throw new HttpError(400, "A valid issue category is required.");
      }
      const priority = input.priority || "Normal";
      if (!priorities.has(priority)) {
        throw new HttpError(400, "A valid issue priority is required.");
      }
      const description =
        typeof input.description === "string" ? input.description.trim() : "";
      if (description.length > 500) {
        throw new HttpError(400, "Description must be 500 characters or fewer.");
      }

      return mutate((currentIssues) => {
        const highestId = currentIssues.reduce((highest, issue) => {
          const match = /^CP-(\d+)$/.exec(issue.id);
          return match ? Math.max(highest, Number(match[1])) : highest;
        }, 2400);
        return [
          {
            id: `CP-${highestId + 1}`,
            title,
            category: input.category,
            location,
            status: "open",
            priority,
            description,
            createdAt: new Date().toISOString(),
          },
          ...currentIssues,
        ];
      }).then((nextIssues) => nextIssues[0]);
    },
    updateStatus: async (id, status) => {
      if (!statuses.has(status)) {
        throw new HttpError(400, "A valid issue status is required.");
      }
      let updatedIssue;
      await mutate((currentIssues) => {
        const existing = currentIssues.find((issue) => issue.id === id);
        if (!existing) throw new HttpError(404, "Issue not found.");
        updatedIssue = { ...existing, status };
        return currentIssues.map((issue) =>
          issue.id === id ? updatedIssue : issue,
        );
      });
      return updatedIssue;
    },
  };
}

async function createServer({
  dataFile =
    process.env.ISSUES_FILE || path.join(__dirname, "data", "issues.json"),
} = {}) {
  const store = await createIssueStore(dataFile);

  return http.createServer(async (request, response) => {
    const pathname = new URL(request.url, "http://localhost").pathname;
    try {
      if (pathname === "/api/health" && request.method === "GET") {
        return sendJson(response, 200, { status: "ok" });
      }
      if (pathname === "/api/issues" && request.method === "GET") {
        return sendJson(response, 200, store.getIssues());
      }
      if (pathname === "/api/issues" && request.method === "POST") {
        const issue = await store.createIssue(await readJson(request));
        return sendJson(response, 201, issue);
      }
      const statusRoute = /^\/api\/issues\/([^/]+)\/status$/.exec(pathname);
      if (statusRoute && request.method === "PATCH") {
        let id;
        try {
          id = decodeURIComponent(statusRoute[1]);
        } catch {
          throw new HttpError(400, "Issue ID is invalid.");
        }
        const input = await readJson(request);
        return sendJson(response, 200, await store.updateStatus(id, input?.status));
      }

      if (pathname.startsWith("/api/")) {
        return sendJson(response, 404, { error: "API route not found." });
      }
      if (request.method === "GET" && staticFiles.has(pathname)) {
        const [file, contentType] = staticFiles.get(pathname);
        const content = await fs.readFile(path.join(__dirname, file));
        response.writeHead(200, {
          "Content-Type": contentType,
          "X-Content-Type-Options": "nosniff",
        });
        return response.end(content);
      }
      return sendJson(response, 404, { error: "Not found." });
    } catch (error) {
      if (error instanceof HttpError) {
        return sendJson(response, error.statusCode, { error: error.message });
      }
      console.error("CivicPulse request failed.", error);
      return sendJson(response, 500, { error: "An unexpected server error occurred." });
    }
  });
}

if (require.main === module) {
  createServer()
    .then((server) => {
      const port = Number(process.env.PORT) || 3000;
      const host = process.env.HOST || "127.0.0.1";
      server.listen(port, host, () => {
        console.log(`CivicPulse server listening on http://${host}:${port}`);
      });
    })
    .catch((error) => {
      console.error("Unable to start CivicPulse server.", error);
      process.exitCode = 1;
    });
}

module.exports = { createServer };
