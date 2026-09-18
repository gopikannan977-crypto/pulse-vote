import http from "http";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import WebSocketPkg from "./frontend/node_modules/ws/index.js";
const { WebSocketServer } = WebSocketPkg;

const PORT = process.env.PORT || 8080;
const SECRET = "pulsevote-dev-secret-key-123456";
const DATA_FILE = path.join(process.cwd(), "dev-data.json");

// In-memory store
let users = new Map(); // id -> user
let usersByEmail = new Map(); // email -> user
let polls = new Map(); // id -> poll
let votes = []; // array of { id, pollId, optionId, voterId, createdAt }
const pollSubscribers = new Map(); // pollId -> Set of ws clients

function hexId() {
  return crypto.randomBytes(12).toString("hex");
}

function hashPassword(password) {
  return crypto.createHash("sha256").update(password + SECRET).digest("hex");
}

function createToken(userId) {
  const payload = JSON.stringify({ uid: userId, exp: Date.now() + 7 * 24 * 3600 * 1000 });
  const b64 = Buffer.from(payload).toString("base64url");
  const sig = crypto.createHmac("sha256", SECRET).update(b64).digest("base64url");
  return `${b64}.${sig}`;
}

function verifyToken(token) {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [b64, sig] = parts;
  const expectedSig = crypto.createHmac("sha256", SECRET).update(b64).digest("base64url");
  if (sig !== expectedSig) return null;
  try {
    const payload = JSON.parse(Buffer.from(b64, "base64url").toString());
    if (payload.exp < Date.now()) return null;
    return payload.uid;
  } catch {
    return null;
  }
}

function saveData() {
  try {
    const data = {
      users: Array.from(users.values()),
      polls: Array.from(polls.values()),
      votes
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error("Failed to save data:", e);
  }
}

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, "utf-8");
      const data = JSON.parse(raw);
      if (data.users) {
        for (const u of data.users) {
          users.set(u.id, u);
          usersByEmail.set(u.email, u);
        }
      }
      if (data.polls) {
        for (const p of data.polls) {
          polls.set(p.id, p);
        }
      }
      if (data.votes) {
        votes = data.votes;
      }
      console.log(`[Storage] Loaded ${polls.size} polls, ${users.size} users, ${votes.length} votes from disk.`);
      return;
    }
  } catch (e) {
    console.error("Failed to load data:", e);
  }

  // Seed demo user & poll if empty
  const demoUserId = hexId();
  const demoUser = {
    id: demoUserId,
    email: "demo@pulsevote.io",
    passwordHash: hashPassword("demo1234"),
    createdAt: new Date().toISOString()
  };
  users.set(demoUserId, demoUser);
  usersByEmail.set(demoUser.email, demoUser);

  const demoPollId = "c22f1e768d35332e42e609f7";
  const demoPoll = {
    id: demoPollId,
    ownerId: demoUserId,
    question: "What feature should we build next in PulseVote?",
    options: [
      { id: "opt-1", text: "AI-Powered Poll Suggestions 🤖" },
      { id: "opt-2", text: "Audience Q&A & Upvoting 💬" },
      { id: "opt-3", text: "Export Results as PDF/CSV 📊" },
      { id: "opt-4", text: "Custom Themes & Branding 🎨" }
    ],
    status: "open",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  polls.set(demoPollId, demoPoll);
  saveData();
}

loadData();

function getCounts(pollId) {
  const poll = polls.get(pollId);
  const counts = {};
  if (poll) {
    for (const opt of poll.options) {
      counts[opt.id] = 0;
    }
  }
  for (const v of votes) {
    if (v.pollId === pollId) {
      counts[v.optionId] = (counts[v.optionId] || 0) + 1;
    }
  }
  return counts;
}

function getTotal(counts) {
  return Object.values(counts).reduce((a, b) => a + b, 0);
}

function broadcast(pollId, event) {
  const subs = pollSubscribers.get(pollId);
  if (!subs) return;
  const data = JSON.stringify(event);
  for (const client of subs) {
    if (client.readyState === 1) {
      try { client.send(data); } catch (e) {}
    }
  }
}

// HTTP Server
const server = http.createServer(async (req, res) => {
  // CORS Headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Origin, Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  // JSON Body reader
  const getBody = () => new Promise((resolve) => {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch {
        resolve({});
      }
    });
  });

  const sendJSON = (statusCode, data) => {
    res.writeHead(statusCode, { "Content-Type": "application/json" });
    res.end(JSON.stringify(data));
  };

  const getAuthUser = () => {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    const uid = verifyToken(token);
    if (!uid) return null;
    return users.get(uid) || null;
  };

  try {
    // Health
    if (pathname === "/health" && req.method === "GET") {
      return sendJSON(200, { status: "ok" });
    }

    // POST /api/auth/signup
    if (pathname === "/api/auth/signup" && req.method === "POST") {
      const { email, password } = await getBody();
      if (!email || !password || password.length < 8) {
        return sendJSON(400, { error: "Valid email and 8+ character password required" });
      }
      const normEmail = email.trim().toLowerCase();
      if (usersByEmail.has(normEmail)) {
        return sendJSON(400, { error: "An account with this email already exists" });
      }
      const user = {
        id: hexId(),
        email: normEmail,
        passwordHash: hashPassword(password),
        createdAt: new Date().toISOString()
      };
      users.set(user.id, user);
      usersByEmail.set(user.email, user);
      saveData();
      const token = createToken(user.id);
      return sendJSON(201, { token, user: { id: user.id, email: user.email, createdAt: user.createdAt } });
    }

    // POST /api/auth/login
    if (pathname === "/api/auth/login" && req.method === "POST") {
      const { email, password } = await getBody();
      const normEmail = (email || "").trim().toLowerCase();
      const user = usersByEmail.get(normEmail);
      if (!user || user.passwordHash !== hashPassword(password || "")) {
        return sendJSON(401, { error: "Invalid email or password" });
      }
      const token = createToken(user.id);
      return sendJSON(200, { token, user: { id: user.id, email: user.email, createdAt: user.createdAt } });
    }

    // POST /api/auth/google (Google / Gmail Instant Access)
    if (pathname === "/api/auth/google" && req.method === "POST") {
      const { email, name } = await getBody();
      const normEmail = (email || "").trim().toLowerCase();
      if (!normEmail || !normEmail.includes("@")) {
        return sendJSON(400, { error: "Valid Gmail address required" });
      }
      let user = usersByEmail.get(normEmail);
      if (!user) {
        user = {
          id: hexId(),
          email: normEmail,
          name: name || normEmail.split("@")[0],
          provider: "google",
          passwordHash: hashPassword(hexId()),
          createdAt: new Date().toISOString()
        };
        users.set(user.id, user);
        usersByEmail.set(user.email, user);
        saveData();
      }
      const token = createToken(user.id);
      return sendJSON(200, { token, user: { id: user.id, email: user.email, createdAt: user.createdAt } });
    }

    // GET /api/auth/me
    if (pathname === "/api/auth/me" && req.method === "GET") {
      const user = getAuthUser();
      if (!user) return sendJSON(401, { error: "Unauthorized" });
      return sendJSON(200, { user: { id: user.id, email: user.email, createdAt: user.createdAt } });
    }

    // POST /api/polls
    if (pathname === "/api/polls" && req.method === "POST") {
      const user = getAuthUser();
      if (!user) return sendJSON(401, { error: "Unauthorized" });

      const { question, options } = await getBody();
      const q = (question || "").trim();
      if (!q || q.length < 3) return sendJSON(400, { error: "Question must be at least 3 characters" });
      if (!Array.isArray(options) || options.length < 2 || options.length > 6) {
        return sendJSON(400, { error: "A poll needs between 2 and 6 options" });
      }

      const cleanOptions = [];
      const seen = new Set();
      for (const opt of options) {
        const text = (opt || "").trim();
        if (!text) return sendJSON(400, { error: "Options cannot be empty" });
        if (seen.has(text.toLowerCase())) return sendJSON(400, { error: "Options must be unique" });
        seen.add(text.toLowerCase());
        cleanOptions.push({ id: hexId(), text });
      }

      const now = new Date().toISOString();
      const poll = {
        id: hexId(),
        ownerId: user.id,
        question: q,
        options: cleanOptions,
        status: "open",
        createdAt: now,
        updatedAt: now
      };
      polls.set(poll.id, poll);
      saveData();
      return sendJSON(201, { poll });
    }

    // GET /api/polls/mine
    if (pathname === "/api/polls/mine" && req.method === "GET") {
      const user = getAuthUser();
      if (!user) return sendJSON(401, { error: "Unauthorized" });

      const userPolls = [];
      for (const p of polls.values()) {
        if (p.ownerId === user.id) {
          userPolls.push(p);
        }
      }
      userPolls.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      return sendJSON(200, { polls: userPolls });
    }

    // GET /api/polls/:id/export
    const exportMatch = pathname.match(/^\/api\/polls\/([a-f0-9-]+)\/export$/);
    if (exportMatch && req.method === "GET") {
      const id = exportMatch[1];
      const poll = polls.get(id);
      if (!poll) return sendJSON(404, { error: "Poll not found" });
      const counts = getCounts(id);
      const total = getTotal(counts);

      let csv = `Poll Question,"${poll.question.replace(/"/g, '""')}"\n`;
      csv += `Status,${poll.status}\n`;
      csv += `Total Votes,${total}\n\n`;
      csv += `Option,Votes,Percentage\n`;
      for (const opt of poll.options) {
        const c = counts[opt.id] || 0;
        const pct = total > 0 ? ((c / total) * 100).toFixed(1) : "0.0";
        csv += `"${opt.text.replace(/"/g, '""')}",${c},${pct}%\n`;
      }

      res.writeHead(200, {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="poll-${id}.csv"`
      });
      return res.end(csv);
    }

    // GET /api/polls/:id
    const getPollMatch = pathname.match(/^\/api\/polls\/([a-f0-9-]+)$/);
    if (getPollMatch && req.method === "GET") {
      const id = getPollMatch[1];
      const poll = polls.get(id);
      if (!poll) return sendJSON(404, { error: "Poll not found" });
      const counts = getCounts(id);
      return sendJSON(200, { poll, counts, total: getTotal(counts) });
    }

    // POST /api/polls/:id/vote
    const voteMatch = pathname.match(/^\/api\/polls\/([a-f0-9-]+)\/vote$/);
    if (voteMatch && req.method === "POST") {
      const id = voteMatch[1];
      const poll = polls.get(id);
      if (!poll) return sendJSON(404, { error: "Poll not found" });
      if (poll.status !== "open") return sendJSON(409, { error: "This poll is closed" });

      const { optionId, voterId } = await getBody();
      if (!voterId) return sendJSON(400, { error: "voterId is required" });

      const validOption = poll.options.some(o => o.id === optionId);
      if (!validOption) return sendJSON(400, { error: "Invalid option" });

      const alreadyVoted = votes.some(v => v.pollId === id && v.voterId === voterId);
      if (alreadyVoted) {
        return sendJSON(409, { error: "You have already voted in this poll" });
      }

      votes.push({
        id: hexId(),
        pollId: id,
        optionId,
        voterId,
        createdAt: new Date().toISOString()
      });
      saveData();

      const counts = getCounts(id);
      const total = getTotal(counts);

      // Broadcast update to all WebSocket clients
      broadcast(id, { type: "update", counts, total });

      return sendJSON(201, { counts, total });
    }

    // PATCH /api/polls/:id/status
    const statusMatch = pathname.match(/^\/api\/polls\/([a-f0-9-]+)\/status$/);
    if (statusMatch && req.method === "PATCH") {
      const user = getAuthUser();
      if (!user) return sendJSON(401, { error: "Unauthorized" });

      const id = statusMatch[1];
      const poll = polls.get(id);
      if (!poll) return sendJSON(404, { error: "Poll not found" });
      if (poll.ownerId !== user.id) return sendJSON(403, { error: "Not your poll" });

      const { status } = await getBody();
      if (status !== "open" && status !== "closed") {
        return sendJSON(400, { error: "Status must be open or closed" });
      }

      poll.status = status;
      poll.updatedAt = new Date().toISOString();
      saveData();
      return sendJSON(200, { status });
    }

    // DELETE /api/polls/:id
    const deleteMatch = pathname.match(/^\/api\/polls\/([a-f0-9-]+)$/);
    if (deleteMatch && req.method === "DELETE") {
      const user = getAuthUser();
      if (!user) return sendJSON(401, { error: "Unauthorized" });

      const id = deleteMatch[1];
      const poll = polls.get(id);
      if (!poll) return sendJSON(404, { error: "Poll not found" });
      if (poll.ownerId !== user.id) return sendJSON(403, { error: "Not your poll" });

      polls.delete(id);
      votes = votes.filter(v => v.pollId !== id);
      saveData();
      return sendJSON(200, { message: "poll deleted" });
    }

    // Serve Static Frontend if frontend/dist exists (Unified Fullstack Server)
    const distPath = path.join(process.cwd(), "frontend", "dist");
    if (fs.existsSync(distPath) && !pathname.startsWith("/api/")) {
      const safeSuffix = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, "");
      let filePath = path.join(distPath, safeSuffix === "\\" || safeSuffix === "/" ? "index.html" : safeSuffix);

      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath).toLowerCase();
        const contentTypes = {
          ".html": "text/html; charset=utf-8",
          ".js": "application/javascript; charset=utf-8",
          ".css": "text/css; charset=utf-8",
          ".json": "application/json",
          ".png": "image/png",
          ".jpg": "image/jpeg",
          ".svg": "image/svg+xml",
          ".ico": "image/x-icon",
          ".woff2": "font/woff2"
        };
        res.writeHead(200, { "Content-Type": contentTypes[ext] || "application/octet-stream" });
        return fs.createReadStream(filePath).pipe(res);
      }

      // SPA Fallback: send index.html for client-side routing (/poll/:id, /login, /signup)
      const indexPath = path.join(distPath, "index.html");
      if (fs.existsSync(indexPath)) {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        return fs.createReadStream(indexPath).pipe(res);
      }
    }

    sendJSON(404, { error: "Not found" });
  } catch (err) {
    console.error("HTTP Error:", err);
    sendJSON(500, { error: "Internal server error" });
  }
});

// WebSocket Server
const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (request, socket, head) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);
    const match = url.pathname.match(/^\/ws\/polls\/([a-f0-9-]+)$/);
    if (!match) {
      socket.destroy();
      return;
    }

    const pollId = match[1];
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request, pollId);
    });
  } catch (e) {
    socket.destroy();
  }
});

wss.on("connection", (ws, req, pollId) => {
  if (!pollSubscribers.has(pollId)) {
    pollSubscribers.set(pollId, new Set());
  }
  pollSubscribers.get(pollId).add(ws);

  // Send initial snapshot
  const counts = getCounts(pollId);
  ws.send(JSON.stringify({
    type: "snapshot",
    counts,
    total: getTotal(counts)
  }));

  // Handle incoming messages from client (e.g. audience reactions)
  ws.on("message", (msg) => {
    try {
      const data = JSON.parse(msg.toString());
      if (data.type === "reaction" && data.emoji) {
        broadcast(pollId, {
          type: "reaction",
          emoji: data.emoji,
          id: Math.random().toString(36).substring(2, 9),
          left: Math.floor(Math.random() * 80) + 10
        });
      }
    } catch (e) {}
  });

  ws.on("close", () => {
    const subs = pollSubscribers.get(pollId);
    if (subs) {
      subs.delete(ws);
      if (subs.size === 0) pollSubscribers.delete(pollId);
    }
  });

  ws.on("error", () => {
    try { ws.close(); } catch (e) {}
  });
});

server.on("error", (err) => {
  console.error("Server error:", err);
});

server.listen(PORT, () => {
  console.log(`\n==================================================`);
  console.log(`🚀 PulseVote API & WebSocket Server listening on :${PORT}`);
  console.log(`👉 REST API:    http://localhost:${PORT}/api`);
  console.log(`👉 WebSocket:   ws://localhost:${PORT}/ws/polls/:id`);
  console.log(`👉 Demo Poll:   http://localhost:5173/poll/c22f1e768d35332e42e609f7`);
  console.log(`👉 Demo User:   demo@pulsevote.io / demo1234`);
  console.log(`==================================================\n`);
});
