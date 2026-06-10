# SIT Graph Hierarchy Challenge

Small Node.js project for the Round 1 full stack challenge.

It has a frontend page and the required API at `POST /api/graph`.
CORS is enabled in the backend.

## Run Locally

```bash
npm start
```

Open:

```text
http://localhost:3000
```

Test the logic:

```bash
npm test
```

## API

### POST `/api/graph`

Request:

```json
{
  "edges": ["A->B", "A->C", "B->D"]
}
```

## Deploy

Render, Railway, or any Node hosting service will work.

If frontend and backend are deployed separately, put the backend base URL in `public/app.js`:

```js
const BACKEND_URL = "https://your-backend-url.onrender.com";
```

Common settings:

```text
Build command: npm install
Start command: npm start
```

Submission values:

```text
GitHub Repository URL: your public GitHub repo URL
Frontend URL: your deployed app URL
Backend API Base URL: the same deployed app URL, without any path at the end
Resume Link: your shared resume link
```

Example backend base URL:

```text
https://your-app-name.onrender.com
```

Do not add `/api/graph` in the base URL field.
