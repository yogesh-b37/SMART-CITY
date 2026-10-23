# CivicPulse

## Run the app

Requires Node.js 18 or newer. No package installation is needed.

```sh
npm start
```

Open <http://localhost:3000>. The server hosts the dashboard and its API from
the same origin. The first run creates `data/issues.json` and seeds the sample
reports. Subsequent reports and status changes are persisted there.

For development with automatic server restarts, run `npm run dev`. Set `PORT`
to change the port; set `ISSUES_FILE` to use a different JSON data file. The
server listens on `127.0.0.1` by default. Set `HOST` explicitly when you need
to expose it to another network interface.

## API

- `GET /api/health` — server health
- `GET /api/issues` — list reports
- `POST /api/issues` — create a report with `title`, `category`, `location`,
  and optional `priority` and `description`
- `PATCH /api/issues/:id/status` — update a report to `open`, `in-progress`, or
  `resolved` with a JSON `status` value

Invalid input receives a JSON error response with an appropriate HTTP status.
This starter backend has no authentication; add access control before exposing
it beyond a trusted development environment.

Run the backend tests with `npm test`.
