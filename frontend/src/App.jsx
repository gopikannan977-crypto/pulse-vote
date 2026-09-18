import React, { useEffect, useMemo, useState, useRef } from "react";
import {
  Activity, ArrowRight, BarChart3, Check, ChevronLeft, CircleDot,
  Copy, ExternalLink, LockKeyhole, LogOut, Plus, Radio,
  RefreshCw, ShieldCheck, Sparkles, Trash2, Users, X,
  Volume2, VolumeX, Maximize2, Minimize2, QrCode, PieChart,
  Trophy, Download, Flame, Heart, Share2, Zap, Clock,
  FileSpreadsheet, Layers, Award, Send, Smile, Mail
} from "lucide-react";
import { api, pollSocket } from "./api";

// Web Audio API Synthesizer (Zero external file dependencies)
class SoundSystem {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }
  init() {
    if (!this.ctx && typeof window !== "undefined") {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
  }
  playVote() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    [523.25, 659.25, 783.99].forEach((freq, i) => {
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + i * 0.05);
        gain.gain.setValueAtTime(0.09, now + i * 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.05 + 0.32);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + i * 0.05);
        osc.stop(now + i * 0.05 + 0.33);
      } catch { }
    });
  }
  playReaction() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.15);
    } catch { }
  }
}
const sound = new SoundSystem();

// Lightweight Pure Canvas Confetti Explosion
function fireConfetti() {
  if (typeof window === "undefined") return;
  const canvas = document.createElement("canvas");
  canvas.className = "confetti-overlay";
  document.body.appendChild(canvas);
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const ctx = canvas.getContext("2d");
  const pieces = [];
  const colors = ["#00F2FE", "#9D4EDD", "#FF2A85", "#00FF88", "#FFD166", "#38EF7D"];

  for (let i = 0; i < 80; i++) {
    pieces.push({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2 + 60,
      vx: (Math.random() - 0.5) * 16,
      vy: (Math.random() - 0.75) * 16 - 3,
      size: Math.random() * 8 + 5,
      color: colors[Math.floor(Math.random() * colors.length)],
      rot: Math.random() * 360,
      vRot: (Math.random() - 0.5) * 12,
      opacity: 1
    });
  }

  let frame = 0;
  function step() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;
    for (const p of pieces) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.45;
      p.vx *= 0.98;
      p.rot += p.vRot;
      p.opacity = Math.max(0, p.opacity - 0.013);
      if (p.opacity > 0) {
        alive = true;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rot * Math.PI) / 180);
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
      }
    }
    frame++;
    if (alive && frame < 100) {
      requestAnimationFrame(step);
    } else {
      canvas.remove();
    }
  }
  requestAnimationFrame(step);
}

function voterId() {
  let id = localStorage.getItem("pulse_voter");
  if (!id) {
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    id = Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
    localStorage.setItem("pulse_voter", id);
  }
  return id;
}

const TEMPLATES = [
  {
    title: "⚡ Sprint Retrospective",
    question: "What was our biggest win this past sprint?",
    options: ["Shipped features on time", "Crushed critical bugs", "Improved team communication", "Great code review speed"]
  },
  {
    title: "💡 Architecture Choice",
    question: "Which database best powers real-time live polling?",
    options: ["Redis (In-Memory + Pub/Sub)", "MongoDB (Document Store)", "Redis + MongoDB Hybrid", "PostgreSQL with LISTEN/NOTIFY"]
  },
  {
    title: "🚀 Roadmap Priority",
    question: "Which feature should we build next in PulseVote?",
    options: ["AI-Assisted Question Generator", "Live Audience Q&A & Upvotes", "Custom Team Branding & Themes", "Slack & Discord Realtime Bot"]
  },
  {
    title: "🎉 Icebreaker Poll",
    question: "What fuel powers your best late-night coding sessions?",
    options: ["Specialty Dark Roast Coffee ☕", "Green Tea & Matcha 🍵", "Energy Drinks & Cold Brew ⚡", "Pure Adrenaline & Music 🎧"]
  }
];

const REACTION_EMOJIS = ["🔥", "❤️", "🚀", "🎉", "🤯", "👏"];

function App() {
  const [user, setUser] = useState(null);
  const [route, setRoute] = useState(window.location.pathname);
  const [soundMuted, setSoundMuted] = useState(false);

  useEffect(() => {
    api.me().then(({ user }) => setUser(user)).catch(() => { });
  }, []);

  useEffect(() => {
    const fn = () => setRoute(window.location.pathname);
    window.addEventListener("popstate", fn);
    return () => window.removeEventListener("popstate", fn);
  }, []);

  const navigate = (path) => {
    window.history.pushState({}, "", path);
    setRoute(path);
  };

  const logout = () => {
    localStorage.removeItem("pulse_token");
    setUser(null);
    navigate("/");
  };

  const toggleSound = () => {
    sound.enabled = !sound.enabled;
    setSoundMuted(!sound.enabled);
  };

  const pollIdMatch = route.match(/^\/poll\/([a-f0-9]+)/);
  const currentPollId = pollIdMatch ? pollIdMatch[1] : null;

  return (
    <div className="app-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <div className="ambient ambient-three" />
      <div className="mesh-grid-pattern" />

      <Header
        user={user}
        navigate={navigate}
        logout={logout}
        soundMuted={soundMuted}
        toggleSound={toggleSound}
      />

      <main className="container">
        {currentPollId ? (
          <PollPage id={currentPollId} user={user} navigate={navigate} />
        ) : user ? (
          <Dashboard navigate={navigate} />
        ) : (
          <Landing navigate={navigate} />
        )}
      </main>

      <footer className="footer">
        <div className="footer-content">
          <div className="footer-brand">
            <Radio size={16} className="cyan-text" />
            <span>PulseVote Studio</span>
          </div>
          <p>Built with React · Go (Gin) · MongoDB · Redis Pub/Sub</p>
          <div className="footer-tags">
            <span>Sub-millisecond Redis counters</span>
            <span>WebSocket push</span>
            <span>Single-vote validation</span>
          </div>
        </div>
      </footer>

      {!user && route === "/login" && (
        <AuthModal mode="login" onClose={() => navigate("/")} onSuccess={setUser} />
      )}
      {!user && route === "/signup" && (
        <AuthModal mode="signup" onClose={() => navigate("/")} onSuccess={setUser} />
      )}
    </div>
  );
}

function Header({ user, navigate, logout, soundMuted, toggleSound }) {
  return (
    <header className="nav">
      <button className="brand" onClick={() => navigate("/")}>
        <span className="brand-mark">
          <Radio size={18} className="pulse-icon" />
        </span>
        <span className="brand-title">
          Pulse<span>Vote</span>
          <span className="badge-live-tag">LIVE STUDIO</span>
        </span>
      </button>

      <div className="nav-actions">
        <button
          className="icon-sound-btn"
          onClick={toggleSound}
          title={soundMuted ? "Unmute sound" : "Mute sound"}
        >
          {soundMuted ? <VolumeX size={17} /> : <Volume2 size={17} />}
        </button>

        {user ? (
          <>
            <span className="user-chip">
              <CircleDot size={12} className="live-dot" /> {user.email}
            </span>
            <button className="ghost-btn" onClick={logout}>
              <LogOut size={16} /> <span>Sign out</span>
            </button>
          </>
        ) : (
          <>
            <button className="ghost-btn" onClick={() => navigate("/login")}>
              Log in
            </button>
            <button className="primary-btn small glow-btn" onClick={() => navigate("/signup")}>
              Create Studio <ArrowRight size={15} />
            </button>
          </>
        )}
      </div>
    </header>
  );
}

function Landing({ navigate }) {
  // Interactive Live Demo preview card right on the landing page
  const [demoVotes, setDemoVotes] = useState({ 0: 42, 1: 18, 2: 12, 3: 8 });
  const [demoSelected, setDemoSelected] = useState(null);
  const [demoTotal, setDemoTotal] = useState(80);
  const [demoReactions, setDemoReactions] = useState([]);

  const demoOptions = [
    { text: "Redis HINCRBY Live Counter ⚡", key: 0 },
    { text: "WebSocket Real-Time Broadcast 📡", key: 1 },
    { text: "MongoDB Durable Storage 🍃", key: 2 },
    { text: "Go (Gin) High-Performance API 🚀", key: 3 }
  ];

  const handleDemoVote = (idx) => {
    if (demoSelected !== null) return;
    sound.playVote();
    fireConfetti();
    setDemoSelected(idx);
    setDemoVotes(prev => ({ ...prev, [idx]: prev[idx] + 1 }));
    setDemoTotal(t => t + 1);
  };

  const triggerDemoReaction = (emoji) => {
    sound.playReaction();
    const newR = { id: Math.random(), emoji, x: Math.random() * 70 + 15 };
    setDemoReactions(prev => [...prev.slice(-8), newR]);
    setTimeout(() => {
      setDemoReactions(prev => prev.filter(r => r.id !== newR.id));
    }, 2000);
  };

  return (
    <section className="hero">
      <div className="hero-copy">
        <div className="eyebrow">
          <span className="live-dot pulse-anim" /> SUB-MILLISECOND LIVE POLLING ENGINE
        </div>
        <h1>
          Ask the room.<br />
          <em>Feel the pulse.</em>
        </h1>
        <p className="hero-text">
          Broadcast a question, share an instant QR or link, and watch votes surge
          in real time. Powered by Go, Redis atomic counters, and WebSockets.
          Zero refresh needed.
        </p>

        <div className="hero-actions">
          <button className="primary-btn glow-btn" onClick={() => navigate("/signup")}>
            Launch your first live poll <ArrowRight size={18} />
          </button>
          <button className="secondary-btn" onClick={() => navigate("/login")}>
            Creator Sign In
          </button>
        </div>

        <div className="feature-badges-row">
          <div className="feature-pill">
            <Zap size={14} className="cyan-text" /> Redis HINCRBY Atomic Counters
          </div>
          <div className="feature-pill">
            <Radio size={14} className="violet-text" /> Redis Pub/Sub WebSocket Push
          </div>
          <div className="feature-pill">
            <ShieldCheck size={14} className="green-text" /> Bcrypt + JWT + Voter ID
          </div>
        </div>
      </div>

      <div className="hero-preview-col">
        <div className="preview-container">
          <div className="preview-glow-ring" />
          <div className="preview-card glass-panel">
            <div className="preview-top">
              <span className="status-pill live-pill">
                <span className="live-dot pulse-anim" /> INTERACTIVE LIVE DEMO
              </span>
              <span className="audience-badge">
                <Users size={13} /> {demoTotal} votes recorded
              </span>
            </div>

            <h3 className="preview-question">What makes PulseVote instant & reliable?</h3>

            <div className="demo-options-list">
              {demoOptions.map((opt) => {
                const count = demoVotes[opt.key];
                const pct = Math.round((count / demoTotal) * 100);
                const isSelected = demoSelected === opt.key;
                return (
                  <div
                    key={opt.key}
                    className={`demo-option-item ${isSelected ? "selected" : ""}`}
                    onClick={() => handleDemoVote(opt.key)}
                  >
                    <div className="demo-option-label">
                      <span>{opt.text}</span>
                      <b>{pct}%</b>
                    </div>
                    <div className="track">
                      <i style={{ width: `${pct}%` }} />
                    </div>
                    <small>{count} votes</small>
                  </div>
                );
              })}
            </div>

            <div className="demo-reaction-bar">
              <span className="reaction-label">Tap to react live:</span>
              <div className="emoji-button-group">
                {REACTION_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    className="emoji-btn"
                    onClick={() => triggerDemoReaction(emoji)}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            {demoReactions.map((r) => (
              <span
                key={r.id}
                className="floating-emoji"
                style={{ left: `${r.x}%` }}
              >
                {r.emoji}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Dashboard({ navigate }) {
  const [polls, setPolls] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.mine()
      .then(d => setPolls(d.polls || []))
      .catch(() => { })
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const totalVotesAcrossPolls = useMemo(() => {
    return polls.reduce((acc, p) => acc + (p.totalVotes || 0), 0);
  }, [polls]);

  const copy = async (id) => {
    const url = `${window.location.origin}/poll/${id}`;
    await navigator.clipboard.writeText(url);
    setToast("Poll link copied to clipboard");
    setTimeout(() => setToast(""), 2000);
  };

  return (
    <section className="dashboard">
      <div className="dashboard-hero-banner">
        <div className="dashboard-stats-grid">
          <div className="stat-card">
            <span className="stat-label"><BarChart3 size={15} /> Your Polls</span>
            <span className="stat-val">{polls.length}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label"><Radio size={15} /> Active Rooms</span>
            <span className="stat-val">{polls.filter(p => p.status === "open").length}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label"><Zap size={15} /> Realtime Engine</span>
            <span className="stat-val status-online">Online</span>
          </div>
        </div>

        <div className="dashboard-cta">
          <button className="primary-btn glow-btn" onClick={() => setShowCreate(true)}>
            <Plus size={18} /> Create New Poll
          </button>
        </div>
      </div>

      <div className="dashboard-header-row">
        <div>
          <h2>Your Live Polling Studios</h2>
          <p className="subtext">Share any link or QR code. Votes stream into your screen live.</p>
        </div>
      </div>

      {loading ? (
        <div className="loading-state">
          <div className="spinner" />
          <span>Loading your studios...</span>
        </div>
      ) : polls.length === 0 ? (
        <div className="empty-state glass-panel">
          <div className="empty-icon"><Sparkles size={28} /></div>
          <h3>Your studio is ready for its first poll</h3>
          <p>Choose from our quick templates or write your own custom question in seconds.</p>
          <button className="primary-btn glow-btn" onClick={() => setShowCreate(true)}>
            <Plus size={17} /> Create Poll Now
          </button>
        </div>
      ) : (
        <div className="poll-grid">
          {polls.map((p) => (
            <PollCard
              key={p.id}
              poll={p}
              navigate={navigate}
              copy={copy}
              reload={load}
            />
          ))}
        </div>
      )}

      {showCreate && (
        <CreatePollModal
          onClose={() => setShowCreate(false)}
          onCreated={(poll) => {
            setShowCreate(false);
            load();
            navigate(`/poll/${poll.id}`);
          }}
        />
      )}

      {toast && (
        <div className="toast">
          <Check size={16} /> {toast}
        </div>
      )}
    </section>
  );
}

function PollCard({ poll, navigate, copy, reload }) {
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    setBusy(true);
    try {
      await api.status(poll.id, poll.status === "open" ? "closed" : "open");
      reload();
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirm("Are you sure you want to delete this poll and all associated votes?")) return;
    setBusy(true);
    try {
      await api.deletePoll(poll.id);
      reload();
    } finally {
      setBusy(false);
    }
  };

  const isOpen = poll.status === "open";

  return (
    <article className="poll-card glass-panel">
      <div className="card-top">
        <span className={`status-pill ${isOpen ? "live-pill" : "closed-pill"}`}>
          <span className={`live-dot ${isOpen ? "pulse-anim" : ""}`} />
          {isOpen ? "LIVE ROOM" : "CLOSED"}
        </span>
        <span className="card-date">{new Date(poll.createdAt).toLocaleDateString()}</span>
      </div>

      <h3 className="poll-card-title">{poll.question}</h3>

      <div className="mini-options-list">
        {poll.options.map((opt, i) => (
          <div key={opt.id} className="mini-option-pill">
            <span className="mini-letter">{String.fromCharCode(65 + i)}</span>
            <span className="mini-text">{opt.text}</span>
          </div>
        ))}
      </div>

      <div className="card-footer-actions">
        <button
          className="action-btn open-btn"
          title="Open Live Room"
          onClick={() => navigate(`/poll/${poll.id}`)}
        >
          <ExternalLink size={15} /> Enter Room
        </button>
        <button
          className="icon-btn"
          title="Copy Public Link"
          onClick={() => copy(poll.id)}
        >
          <Copy size={15} />
        </button>
        <button
          className="icon-btn"
          title={isOpen ? "Close Voting" : "Reopen Voting"}
          onClick={toggle}
          disabled={busy}
        >
          <RefreshCw size={15} className={busy ? "spin" : ""} />
        </button>
        <button
          className="icon-btn danger"
          title="Delete Poll"
          onClick={remove}
          disabled={busy}
        >
          <Trash2 size={15} />
        </button>
      </div>
    </article>
  );
}

function CreatePollModal({ onClose, onCreated }) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const addOption = () => {
    if (options.length < 6) setOptions([...options, ""]);
  };

  const updateOption = (idx, val) => {
    setOptions(options.map((x, j) => (j === idx ? val : x)));
  };

  const removeOption = (idx) => {
    if (options.length > 2) setOptions(options.filter((_, j) => j !== idx));
  };

  const applyTemplate = (t) => {
    setQuestion(t.question);
    setOptions([...t.options]);
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const { poll } = await api.createPoll({ question, options });
      onCreated(poll);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal create-modal glass-panel" onMouseDown={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}><X size={18} /></button>

        <div className="modal-header">
          <div className="modal-icon accent-glow"><BarChart3 size={22} /></div>
          <div>
            <h2>Create a Live Polling Room</h2>
            <p>Audience can vote from any phone or browser instantly without logging in.</p>
          </div>
        </div>

        <div className="template-strip">
          <span className="template-label"><Sparkles size={13} /> Quick Templates:</span>
          <div className="template-chips">
            {TEMPLATES.map((t, idx) => (
              <button
                key={idx}
                type="button"
                className="template-chip"
                onClick={() => applyTemplate(t)}
              >
                {t.title}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={submit} className="create-form">
          <label className="field-label">
            Question
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              maxLength={180}
              placeholder="e.g. What technology should we adopt for our new microservice?"
              required
            />
          </label>

          <div className="options-header-row">
            <span className="field-label">Answer Options ({options.length}/6)</span>
            <span className="subtext">Min 2, Max 6</span>
          </div>

          <div className="options-inputs-list">
            {options.map((val, i) => (
              <div className="option-input-row" key={i}>
                <span className="option-badge">{String.fromCharCode(65 + i)}</span>
                <input
                  value={val}
                  onChange={(e) => updateOption(i, e.target.value)}
                  maxLength={80}
                  placeholder={`Option ${i + 1}`}
                  required
                />
                {options.length > 2 && (
                  <button
                    type="button"
                    className="remove-opt-btn"
                    onClick={() => removeOption(i)}
                  >
                    <X size={15} />
                  </button>
                )}
              </div>
            ))}
          </div>

          {options.length < 6 && (
            <button type="button" className="add-option-btn" onClick={addOption}>
              <Plus size={15} /> Add Another Option
            </button>
          )}

          {error && <div className="error-banner">{error}</div>}

          <button className="primary-btn full glow-btn" disabled={busy}>
            {busy ? "Deploying Live Room..." : "Launch Live Poll"} <ArrowRight size={17} />
          </button>
        </form>
      </div>
    </div>
  );
}

function PollPage({ id, user, navigate }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState("");
  const [voted, setVoted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);
  const [viewers, setViewers] = useState(1);
  const [toast, setToast] = useState("");
  const [viewMode, setViewMode] = useState("bars"); // 'bars' | 'donut' | 'leaderboard'
  const [stageMode, setStageMode] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [floatingReactions, setFloatingReactions] = useState([]);
  const [activityTicker, setActivityTicker] = useState(null);

  const socketRef = useRef(null);

  const load = () => {
    api.getPoll(id)
      .then(d => {
        setData(d);
        if (d.viewers) setViewers(d.viewers);
      })
      .catch(e => setError(e.message));
  };

  useEffect(load, [id]);

  useEffect(() => {
    let ws, timer, alive = true;
    const connect = () => {
      ws = pollSocket(id);
      socketRef.current = ws;

      ws.onopen = () => alive && setConnected(true);

      ws.onclose = () => {
        if (!alive) return;
        setConnected(false);
        timer = setTimeout(connect, 1800);
      };

      ws.onerror = () => setConnected(false);

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);

          if (payload.type === "viewers" && alive) {
            setViewers(payload.count);
          }

          if (payload.counts && alive) {
            setData(prev => prev ? ({
              ...prev,
              counts: payload.counts,
              total: payload.total
            }) : prev);

            if (payload.lastOption) {
              setActivityTicker(`New vote registered for "${payload.lastOption}"`);
              sound.playVote();
              setTimeout(() => setActivityTicker(null), 4000);
            }
          }

          if (payload.type === "reaction" && alive) {
            sound.playReaction();
            const newR = {
              id: payload.id || Math.random(),
              emoji: payload.emoji,
              x: Math.random() * 70 + 15
            };
            setFloatingReactions(prev => [...prev.slice(-12), newR]);
            setTimeout(() => {
              setFloatingReactions(prev => prev.filter(r => r.id !== newR.id));
            }, 2200);
          }

          if (payload.type === "status" && alive) {
            setData(prev => prev ? ({
              ...prev,
              poll: { ...prev.poll, status: payload.status }
            }) : prev);
          }
        } catch { }
      };
    };

    connect();
    return () => {
      alive = false;
      clearTimeout(timer);
      ws?.close();
    };
  }, [id]);

  const counts = data?.counts || {};
  const total = data?.total || 0;
  const hasVoted = voted || localStorage.getItem(`pulse_voted_${id}`) === "1";

  // Identify leader option
  const leaderId = useMemo(() => {
    if (total === 0 || !data?.poll?.options) return null;
    let max = -1;
    let maxId = null;
    for (const opt of data.poll.options) {
      const c = counts[opt.id] || 0;
      if (c > max) {
        max = c;
        maxId = opt.id;
      }
    }
    return max > 0 ? maxId : null;
  }, [counts, total, data]);

  const castVote = async () => {
    if (!selected || hasVoted || data.poll.status !== "open") return;
    setBusy(true);
    setError("");
    try {
      const result = await api.vote(id, { optionId: selected, voterId: voterId() });
      setData(prev => ({ ...prev, counts: result.counts, total: result.total }));
      localStorage.setItem(`pulse_voted_${id}`, "1");
      setVoted(true);
      sound.playVote();
      fireConfetti();
      setToast("Your vote was cast live!");
      setTimeout(() => setToast(""), 3000);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const sendReaction = (emoji) => {
    sound.playReaction();
    if (socketRef.current && socketRef.current.readyState === 1) {
      socketRef.current.send(JSON.stringify({ type: "reaction", emoji }));
    }
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setToast("Poll link copied to clipboard!");
    setTimeout(() => setToast(""), 2000);
  };

  const copySummary = async () => {
    if (!data?.poll) return;
    let text = `📊 Poll: ${data.poll.question}\nTotal votes: ${total}\n\n`;
    data.poll.options.forEach((opt, idx) => {
      const c = counts[opt.id] || 0;
      const pct = total ? Math.round((c / total) * 100) : 0;
      text += `${String.fromCharCode(65 + idx)}) ${opt.text}: ${pct}% (${c} votes)\n`;
    });
    await navigator.clipboard.writeText(text);
    setToast("Results summary copied for sharing!");
    setTimeout(() => setToast(""), 2000);
  };

  const shareViaGmail = () => {
    if (!data?.poll) return;
    const subject = encodeURIComponent(`Live Audience Poll: ${data.poll.question}`);
    const body = encodeURIComponent(
      `Hello!\n\nYou're invited to cast your vote in our live interactive poll:\n"${data.poll.question}"\n\n👉 Click to vote live:\n${window.location.href}\n\nResults update live in real-time as votes come in. No refresh needed!`
    );
    window.open(`https://mail.google.com/mail/?view=cm&fs=1&su=${subject}&body=${body}`, "_blank");
  };

  if (!data) {
    return (
      <div className="loading-state">
        <div className="spinner" />
        <span>Connecting to live room...</span>
      </div>
    );
  }

  const poll = data.poll;
  const isClosed = poll.status === "closed";

  return (
    <section className={`poll-page ${stageMode ? "stage-mode-active" : ""}`}>
      {/* Floating live reaction container */}
      <div className="floating-reactions-layer">
        {floatingReactions.map((r) => (
          <span
            key={r.id}
            className="floating-emoji"
            style={{ left: `${r.x}%` }}
          >
            {r.emoji}
          </span>
        ))}
      </div>

      {/* Top Poll Toolbar */}
      <div className="poll-toolbar glass-panel">
        <div className="toolbar-left">
          <button className="back-btn" onClick={() => navigate(user ? "/" : "/")}>
            <ChevronLeft size={18} /> {user ? "Studio Dashboard" : "Home"}
          </button>
          <div className="live-meta-badges">
            <span className={`connection-pill ${connected ? "connected" : "reconnecting"}`}>
              <span className={`live-dot ${connected ? "pulse-anim" : ""}`} />
              {connected ? "LIVE SYNC ON" : "RECONNECTING"}
            </span>
            <span className="viewers-pill">
              <Users size={13} /> {viewers} watching now
            </span>
          </div>
        </div>

        <div className="toolbar-actions">
          <div className="view-mode-selector">
            <button
              className={`mode-btn ${viewMode === "bars" ? "active" : ""}`}
              onClick={() => setViewMode("bars")}
              title="Bar Chart View"
            >
              <BarChart3 size={15} /> Bars
            </button>
            <button
              className={`mode-btn ${viewMode === "donut" ? "active" : ""}`}
              onClick={() => setViewMode("donut")}
              title="Donut Chart View"
            >
              <PieChart size={15} /> Donut
            </button>
            <button
              className={`mode-btn ${viewMode === "leaderboard" ? "active" : ""}`}
              onClick={() => setViewMode("leaderboard")}
              title="Leaderboard Ranking"
            >
              <Trophy size={15} /> Rank
            </button>
          </div>

          <button
            className="action-pill-btn"
            onClick={() => setStageMode(!stageMode)}
            title="Toggle Fullscreen Stage/Presenter Mode"
          >
            {stageMode ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            <span>{stageMode ? "Exit Stage" : "Stage Mode"}</span>
          </button>

          <button
            className="action-pill-btn"
            onClick={() => setShowQR(true)}
            title="Show Mobile QR Code"
          >
            <QrCode size={15} /> <span>QR Code</span>
          </button>

          <button
            className="action-pill-btn"
            onClick={copyLink}
            title="Copy Public Link"
          >
            <Share2 size={15} /> <span>Share</span>
          </button>
        </div>
      </div>

      {/* Main Poll Layout */}
      <div className="poll-grid-layout">
        <div className="poll-main-column glass-panel">
          <div className="poll-header-info">
            <div className="eyebrow">
              <span className={`live-dot ${!isClosed ? "pulse-anim" : ""}`} />
              {!isClosed ? "REALTIME ROOM" : "POLL CONCLUDED"}
            </div>
            <h1 className="poll-question-heading">{poll.question}</h1>
            <div className="poll-stat-line">
              <span><Users size={15} /> {total} total {total === 1 ? "vote" : "votes"}</span>
              <span>•</span>
              <span>Updates automatically via WebSockets</span>
            </div>
          </div>

          {/* Results Views */}
          {viewMode === "bars" && (
            <div className="results-list">
              {poll.options.map((option, index) => {
                const count = counts[option.id] || 0;
                const percent = total ? Math.round((count / total) * 100) : 0;
                const isSelected = selected === option.id;
                const isLeader = leaderId === option.id;

                return (
                  <button
                    key={option.id}
                    className={`result-row ${isSelected ? "selected" : ""} ${hasVoted ? "locked" : ""} ${isLeader ? "is-leader" : ""}`}
                    onClick={() => !hasVoted && !isClosed && setSelected(option.id)}
                  >
                    <div className="result-label">
                      <span className="letter-badge">{String.fromCharCode(65 + index)}</span>
                      <span className="option-title">{option.text}</span>
                      {isLeader && (
                        <span className="leader-pill">
                          <Award size={12} /> LEADER
                        </span>
                      )}
                      <b className="percentage-val">{percent}%</b>
                    </div>
                    <div className="result-track">
                      <i
                        className={isLeader ? "leader-bar" : ""}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <div className="result-meta">
                      <small>{count} {count === 1 ? "vote" : "votes"}</small>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {viewMode === "donut" && (
            <DonutChartView
              options={poll.options}
              counts={counts}
              total={total}
            />
          )}

          {viewMode === "leaderboard" && (
            <LeaderboardView
              options={poll.options}
              counts={counts}
              total={total}
            />
          )}

          {/* Voting Button & Status Banners */}
          {!hasVoted && !isClosed && (
            <div className="voting-action-box">
              <button
                className="primary-btn vote-submit-btn glow-btn"
                disabled={!selected || busy}
                onClick={castVote}
              >
                {busy ? "Casting vote..." : "Submit My Vote"} <ArrowRight size={18} />
              </button>
              {!selected && <span className="select-hint">Select one option above to vote</span>}
            </div>
          )}

          {hasVoted && (
            <div className="vote-confirmed-banner">
              <Check size={20} className="green-text" />
              <div>
                <strong>Vote Cast Successfully!</strong>
                <span>Stay on this screen. Results update live as other participants vote.</span>
              </div>
            </div>
          )}

          {isClosed && (
            <div className="poll-closed-banner">
              <LockKeyhole size={20} />
              <div>
                <strong>This poll is officially closed.</strong>
                <span>Voting has concluded. Final results are displayed above.</span>
              </div>
            </div>
          )}

          {error && <div className="error-banner">{error}</div>}

          {/* Live Emoji Reaction Stream Bar */}
          <div className="live-reactions-bar">
            <span className="reaction-title">
              <Smile size={16} /> Send a Live Reaction:
            </span>
            <div className="reaction-buttons-strip">
              {REACTION_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  className="reaction-tap-btn"
                  onClick={() => sendReaction(emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar Info & Controls */}
        <aside className="poll-side-column">
          <div className="side-card glass-panel">
            <div className="side-icon-box"><Zap size={20} className="cyan-text" /></div>
            <h3>Architecture Engine</h3>
            <p>Every vote increments an atomic Redis counter using <code>HINCRBY</code> and broadcasts via Redis Pub/Sub directly to your browser.</p>

            <div className="tech-stack-checklist">
              <div className="stack-item">
                <i className="status-dot green" />
                <span>Go (Gin) Backend API</span>
              </div>
              <div className="stack-item">
                <i className="status-dot cyan" />
                <span>Redis Pub/Sub Realtime</span>
              </div>
              <div className="stack-item">
                <i className="status-dot violet" />
                <span>MongoDB Durable Storage</span>
              </div>
              <div className="stack-item">
                <i className="status-dot amber" />
                <span>React Reactive UI</span>
              </div>
            </div>
          </div>

          <div className="side-card glass-panel">
            <div className="side-card-top">
              <h4>Audience Access</h4>
              <button className="icon-tiny-btn" onClick={() => setShowQR(true)} title="Enlarge QR">
                <QrCode size={14} />
              </button>
            </div>
            <div className="qr-mini-preview" onClick={() => setShowQR(true)}>
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&color=58-230-192&bgcolor=13-26-44&data=${encodeURIComponent(window.location.href)}`}
                alt="Poll QR Code"
                className="mini-qr-img"
              />
              <span className="qr-tap-hint">Tap to expand QR</span>
            </div>

            <div className="share-url-box">{window.location.href}</div>
            <button className="secondary-btn full" onClick={copyLink} style={{ marginBottom: "8px" }}>
              <Copy size={15} /> Copy Poll Link
            </button>
            <button className="secondary-btn small-action full" onClick={shareViaGmail}>
              <Mail size={15} /> Invite Audience via Gmail
            </button>
          </div>

          <div className="side-card glass-panel">
            <h4>Export Results</h4>
            <p className="subtext">Download live votes or copy formatted Markdown summary.</p>
            <div className="export-btn-group">
              <a
                href={api.exportUrl(poll.id, "csv")}
                download={`poll-${poll.id}-results.csv`}
                className="secondary-btn small-action full"
              >
                <FileSpreadsheet size={15} /> Download CSV
              </a>
              <button className="ghost-btn full" onClick={copySummary}>
                <Copy size={15} /> Copy Summary
              </button>
            </div>
          </div>
        </aside>
      </div>

      {/* Realtime Activity Ticker */}
      {activityTicker && (
        <div className="live-activity-ticker glass-panel">
          <Zap size={14} className="cyan-text pulse-anim" />
          <span>{activityTicker}</span>
        </div>
      )}

      {/* QR Code Modal */}
      {showQR && (
        <div className="modal-backdrop" onMouseDown={() => setShowQR(false)}>
          <div className="modal qr-modal glass-panel" onMouseDown={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowQR(false)}><X size={18} /></button>
            <div className="modal-icon accent-glow"><QrCode size={24} /></div>
            <h2>Scan to Vote Live</h2>
            <p>Audience can scan with any smartphone camera to open this poll instantly.</p>

            <div className="qr-display-frame">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=260x260&color=00-00-00&data=${encodeURIComponent(window.location.href)}`}
                alt="Large Poll QR Code"
                className="modal-qr-img"
              />
            </div>

            <div className="qr-modal-url">{window.location.href}</div>

            <button className="primary-btn full glow-btn" onClick={copyLink}>
              <Copy size={16} /> Copy Poll Link
            </button>
          </div>
        </div>
      )}

      {toast && (
        <div className="toast">
          <Check size={16} /> {toast}
        </div>
      )}
    </section>
  );
}

// Pure SVG Donut Chart View
function DonutChartView({ options, counts, total }) {
  const colors = ["#00F2FE", "#9D4EDD", "#FF2A85", "#00FF88", "#FFD166", "#38EF7D"];
  const radius = 60;
  const strokeWidth = 22;
  const circumference = 2 * Math.PI * radius;

  let currentOffset = 0;

  return (
    <div className="donut-chart-container">
      <div className="donut-svg-wrap">
        <svg viewBox="0 0 160 160" className="donut-svg">
          <circle
            cx="80"
            cy="80"
            r={radius}
            fill="transparent"
            stroke="rgba(255, 255, 255, 0.05)"
            strokeWidth={strokeWidth}
          />
          {total > 0 && options.map((opt, idx) => {
            const count = counts[opt.id] || 0;
            const pct = count / total;
            const strokeDash = pct * circumference;
            const offset = currentOffset;
            currentOffset -= strokeDash;

            return (
              <circle
                key={opt.id}
                cx="80"
                cy="80"
                r={radius}
                fill="transparent"
                stroke={colors[idx % colors.length]}
                strokeWidth={strokeWidth}
                strokeDasharray={`${strokeDash} ${circumference - strokeDash}`}
                strokeDashoffset={offset}
                strokeLinecap="round"
                className="donut-segment"
              />
            );
          })}
        </svg>
        <div className="donut-center-label">
          <span className="donut-total-val">{total}</span>
          <span className="donut-total-text">Total Votes</span>
        </div>
      </div>

      <div className="donut-legend-grid">
        {options.map((opt, idx) => {
          const count = counts[opt.id] || 0;
          const pct = total ? Math.round((count / total) * 100) : 0;
          return (
            <div key={opt.id} className="legend-item">
              <span
                className="legend-color-dot"
                style={{ backgroundColor: colors[idx % colors.length] }}
              />
              <span className="legend-text">{opt.text}</span>
              <b className="legend-pct">{pct}%</b>
              <span className="legend-votes">({count})</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Leaderboard Ranking View
function LeaderboardView({ options, counts, total }) {
  const sorted = useMemo(() => {
    return [...options].sort((a, b) => {
      const ca = counts[a.id] || 0;
      const cb = counts[b.id] || 0;
      return cb - ca;
    });
  }, [options, counts]);

  const medals = ["🥇", "🥈", "🥉"];

  return (
    <div className="leaderboard-container">
      {sorted.map((opt, rank) => {
        const count = counts[opt.id] || 0;
        const pct = total ? Math.round((count / total) * 100) : 0;
        return (
          <div key={opt.id} className={`leaderboard-row rank-${rank + 1}`}>
            <span className="rank-badge">
              {rank < 3 ? medals[rank] : `#${rank + 1}`}
            </span>
            <span className="leaderboard-title">{opt.text}</span>
            <div className="leaderboard-bar-wrap">
              <div className="leaderboard-bar" style={{ width: `${pct}%` }} />
            </div>
            <b className="leaderboard-pct">{pct}%</b>
            <span className="leaderboard-count">{count} votes</span>
          </div>
        );
      })}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
    </svg>
  );
}

function AuthModal({ mode, onClose, onSuccess }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [gmailPrompt, setGmailPrompt] = useState(false);
  const [gmailInput, setGmailInput] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const data = mode === "login"
        ? await api.login({ email, password })
        : await api.signup({ email, password });
      localStorage.setItem("pulse_token", data.token);
      onSuccess(data.user);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleGoogleLogin = async (overrideEmail) => {
    const targetEmail = overrideEmail || gmailInput || "presenter@gmail.com";
    setError("");
    setBusy(true);
    try {
      const data = await api.googleLogin({ email: targetEmail, name: targetEmail.split("@")[0] });
      localStorage.setItem("pulse_token", data.token);
      onSuccess(data.user);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal glass-panel" onMouseDown={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}><X size={18} /></button>
        <div className="modal-icon accent-glow"><LockKeyhole size={22} /></div>
        <h2>{mode === "login" ? "Sign in to Studio" : "Create Polling Studio"}</h2>
        <p>{mode === "login" ? "Access and manage all your active polling rooms." : "Secure authentication required before creating or managing live polls."}</p>

        {/* Google / Gmail Access Section */}
        <div className="gmail-auth-section">
          <button
            type="button"
            className="google-signin-btn"
            onClick={() => setGmailPrompt(!gmailPrompt)}
            disabled={busy}
          >
            <GoogleIcon />
            <span>Continue with Google / Gmail</span>
          </button>

          {gmailPrompt && (
            <div className="gmail-quick-box">
              <input
                type="email"
                value={gmailInput}
                onChange={(e) => setGmailInput(e.target.value)}
                placeholder="Enter your Gmail (e.g. you@gmail.com)"
                className="gmail-input"
              />
              <div className="gmail-btn-row">
                <button
                  type="button"
                  className="primary-btn small glow-btn"
                  onClick={() => handleGoogleLogin()}
                  disabled={!gmailInput || busy}
                >
                  Enter with Gmail
                </button>
                <button
                  type="button"
                  className="secondary-btn small-action"
                  onClick={() => handleGoogleLogin("demo@pulsevote.io")}
                  disabled={busy}
                >
                  Quick Demo User
                </button>
              </div>
            </div>
          )}

          <div className="auth-divider">
            <span>or continue with password</span>
          </div>
        </div>

        <form onSubmit={submit} className="auth-form">
          <label className="field-label">
            Email Address
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. presenter@pulsevote.io"
              required
            />
          </label>
          <label className="field-label">
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="8+ characters"
              minLength={8}
              required
            />
          </label>
          {error && <div className="error-banner">{error}</div>}
          <button className="primary-btn full glow-btn" disabled={busy}>
            {busy ? "Authenticating..." : mode === "login" ? "Enter Studio" : "Create My Studio Account"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default App;
