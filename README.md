# PulseVote — Live Polling Studio

A polished full-stack live polling application built for the challenge:

**React + Go (Gin) + MongoDB + Redis**

## What it does

1. Sign up / log in.
2. Create a poll with 2–6 options and an optional closing time.
3. Copy a public poll link.
4. Audience members open the link and vote without needing an account.
5. Results update instantly for every connected viewer through WebSockets.
6. Redis maintains live vote counters and broadcasts vote events through Pub/Sub.
7. MongoDB stores durable users, polls and votes.
8. Poll owners can close/reopen their polls and delete them.

## Architecture

```text
React
  │
  ├── REST API ───────────────► Go / Gin
  │                              │
  │                              ├── MongoDB
  │                              │    ├── users
  │                              │    ├── polls
  │                              │    └── votes
  │                              │
  │                              └── Redis
  │                                   ├── poll:{id}:counts (Hash)
  │                                   └── poll:{id}:events (Pub/Sub)
  │
  └── WebSocket ◄────────────── Go / Gin ◄── Redis Pub/Sub
```

### Why Redis is doing real work

Redis is not just a cache in this project.

- Every poll has a Redis Hash containing the current option counts.
- A vote increments the relevant Redis counter atomically with `HINCRBY`.
- The backend publishes a compact vote event on a poll-specific Redis Pub/Sub channel.
- Every WebSocket subscriber receives that event and pushes the new counts to browsers.
- MongoDB remains the durable source of poll/vote records.

On a fresh poll, Redis counters are hydrated from MongoDB. If Redis loses the counter key, the next read can rebuild it from persisted votes.

## Security choices

- Passwords are hashed with bcrypt.
- Auth uses signed JWT access tokens.
- Poll creation/update/delete/close endpoints require authentication.
- All poll/vote payloads are validated server-side.
- MongoDB ObjectIDs are validated before use.
- Poll option IDs are generated server-side.
- Audience voters receive a random browser voter ID stored in localStorage.
- A MongoDB unique index on `(pollId, voterId)` prevents duplicate votes per browser.
- CORS is configurable through `FRONTEND_URL`.
- Secrets are environment variables, never committed.

> Browser voter IDs are deliberately lightweight for an internship project. They prevent accidental duplicate voting, but are not intended as high-assurance identity verification.

## Project structure

```text
live-polling-studio/
├── backend/
│   ├── cmd/server/main.go
│   ├── internal/
│   │   ├── config/
│   │   ├── database/
│   │   ├── handlers/
│   │   ├── middleware/
│   │   ├── models/
│   │   ├── realtime/
│   │   ├── repository/
│   │   ├── services/
│   │   └── validation/
│   ├── .env.example
│   ├── Dockerfile
│   └── go.mod
├── frontend/
│   ├── src/
│   ├── .env.example
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── docker-compose.yml
└── README.md
```

## Local run

### Option A — Docker Compose

Requirements: Docker Desktop.

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

docker compose up --build
```

Open:

```text
http://localhost:5173
```

The compose stack runs:

- frontend
- Go API
- MongoDB
- Redis

### Option B — run services manually

Start MongoDB and Redis first.

Backend:

```bash
cd backend
cp .env.example .env
go run ./cmd/server
```

Frontend:

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

## Environment variables

Backend:

```env
PORT=8080
MONGO_URI=mongodb://localhost:27017
MONGO_DB=pulsevote
REDIS_ADDR=localhost:6379
REDIS_PASSWORD=
JWT_SECRET=change-me-to-a-long-random-secret
FRONTEND_URL=http://localhost:5173
```

Frontend:

```env
VITE_API_URL=http://localhost:8080/api
VITE_WS_URL=ws://localhost:8080/ws
```

## API

### Auth

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `GET /api/auth/me`

### Polls

- `POST /api/polls` — authenticated
- `GET /api/polls/:id` — public
- `GET /api/polls/mine` — authenticated
- `PATCH /api/polls/:id/status` — owner
- `DELETE /api/polls/:id` — owner

### Voting

- `POST /api/polls/:id/vote` — public

### Realtime

- `GET /ws/polls/:id` — public WebSocket

## Challenge video

The challenge requires a **3–5 minute video** covering:

1. The hardest challenge and how it was solved.
2. Whether AI tools were used, which ones, and how they helped or got in the way.
3. A short end-to-end demo.

The video is mandatory for submission.

## Deployment

The app is containerized and can be deployed to services that support Docker.

For a simple production setup:

- deploy the Go backend with a managed MongoDB and Redis;
- deploy the React frontend as a static app or container;
- set `FRONTEND_URL` to the production frontend URL;
- set `VITE_API_URL` and `VITE_WS_URL` to the production backend endpoints;
- use HTTPS/WSS in production.

This environment can generate the complete project source, but it cannot create or host a public production URL on your behalf. Before submission, deploy it and verify the public link from an incognito browser.

## Interview prep

Do not submit code you cannot explain. Be ready to explain:

- REST vs WebSocket responsibilities
- why MongoDB and Redis both exist
- Redis `HINCRBY` and Pub/Sub
- duplicate-vote protection
- JWT authentication
- backend validation
- WebSocket lifecycle and reconnect behavior
- what happens if Redis loses its counters
- what happens if two users vote at the same time

Good luck!
