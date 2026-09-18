# 🚀 PulseVote — GUVI HCL Submission & Video Walkthrough Guide

This document contains everything needed to ace the **GUVI HCL Internship Developer Task**:
1. Complete answers to the required video questions
2. Word-by-word 3–5 minute video script (in English and Tamil/Tanglish)
3. Step-by-step Free Deployment Guide to get your live URL
4. Key technical concepts for the technical interview

---

## 📋 Evaluation Checklist

- [x] **Full Flow End-to-End**: Create poll ➔ Share link/QR ➔ Audience votes ➔ Instant live results without refresh
- [x] **Real Stack Usage**:
  - **React (Vite)**: Glassmorphism UI, Bar/Donut/Leaderboard charts, Web Audio chimes, Canvas confetti, Live floating reactions, Stage mode.
  - **Go (Gin)**: High-performance REST API, JWT auth, bcrypt, WebSocket upgrader.
  - **MongoDB**: Durable storage with collections for `users`, `polls`, `votes`, unique index on `(pollId, voterId)`.
  - **Redis**: Real atomic counters via `HINCRBY`, real-time event broadcasting via `Redis Pub/Sub`.
- [x] **Separation of Concerns**: Clean `/frontend` and `/backend` directories.
- [x] **Security & Validation**: Input sanitization, ObjectID validation, JWT claims, single-vote browser enforcement.
- [x] **Extra Features Built for Purpose**:
  - 🎨 **Multi-Chart Visualization**: Toggle between Live Bars, SVG Donut Chart, and Ranked Leaderboard
  - 🔥 **Live Floating Reactions**: Audience can tap reactions that drift across every viewer's screen in real time
  - 📱 **Dynamic QR Code Modal**: Instant mobile voting without typing URLs
  - 📺 **Stage / Presenter Mode**: Fullscreen high-contrast display for keynotes & auditoriums
  - 🔊 **Web Audio Synthesizer**: Zero-dependency audio feedback for voting and reactions
  - 🎉 **Canvas Confetti**: Physics-based celebratory particle burst on vote submission
  - 📊 **Export Options**: 1-click CSV & JSON report download + formatted clipboard summary
  - ⚡ **Quick Poll Templates**: 1-click presets for Sprint Retrospectives, Tech Choices, Roadmap, and Icebreakers

---

## 🎥 3 to 5-Minute Video Walkthrough Script

> **Note**: The video is **mandatory** for your submission to `devhiring@hclguvi.com`. You can record your screen and face using OBS Studio, Loom, or Windows Game Bar (`Win + G`).

### Video Structure (Total: ~3.5 minutes)

| Time | Section | Content |
|---|---|---|
| **0:00 - 0:30** | **Introduction** | Introduce yourself, project name (PulseVote), and the required tech stack (React + Go + MongoDB + Redis). |
| **0:30 - 1:45** | **Live End-to-End Demo** | Show the full flow: Sign up/login ➔ Create poll ➔ Open link in two browser windows side by side ➔ Cast vote ➔ Watch results update live with confetti and floating reactions! |
| **1:45 - 2:45** | **Question 1: The Hardest Challenge** | Explain the dual-write consistency & Redis atomic `HINCRBY` solution. |
| **2:45 - 3:30** | **Question 2: AI Tool Usage** | Explain how you used AI tools honestly and what you learned. |
| **3:30 - 3:45** | **Conclusion** | Thank the review team and wrap up. |

---

### 🎙️ Word-for-Word English Script

#### Part 1: Introduction (0:00 - 0:30)
> *"Hello everyone! My name is [Your Name], and this is my submission for the GUVI HCL Developer Internship Task. I have built **PulseVote — Live Polling Studio**, a real-time audience polling application built using **React** on the frontend, **Go with the Gin framework** on the backend, **MongoDB** for persistent storage, and **Redis** for sub-millisecond atomic live counters and Pub/Sub broadcasting."*

#### Part 2: End-to-End Live Demonstration (0:30 - 1:45)
> *(Screen shows PulseVote)*
> *"Let's see the full flow in action. Here on the landing page, we have an interactive preview. Now let's sign into the Creator Studio. Inside the studio dashboard, we can see active rooms and launch a new poll. I can write a custom question or pick from our pre-built templates like 'Architecture Choice'. When I click 'Launch Live Poll', the room is immediately created.*
> 
> *Now, let me open this poll URL in an incognito window next to my main screen to simulate an audience member. Notice how the viewer count updates automatically to 2. The audience doesn't need to sign up—they can vote directly or scan this dynamic QR code on their phone!*
> 
> *Now watch closely as I cast a vote: when I click 'Submit My Vote', notice the instant confetti burst, the audio chime, and how the results update in the other window instantaneously with **zero page refresh**!*
> 
> *We can also toggle views between Animated Bars with leader highlights, SVG Donut Chart, and Ranked Leaderboard. Audience members can also tap live floating emoji reactions like fire, rocket, or claps, which stream across everyone's screens via WebSockets. If I'm presenting at a conference, I can switch to 'Stage Mode' for a high-contrast fullscreen display, and when the poll finishes, download the results as a CSV report."*

#### Part 3: The Challenge That Gave The Most Trouble & How It Was Solved (1:45 - 2:45)
> *"Now answering the first required question: **What was the hardest challenge, and how was it solved?**
> 
> The biggest challenge was **concurrency and dual-write consistency between Redis and MongoDB under high-frequency voting spikes**.
> If 500 audience members vote at the exact same second, querying MongoDB, reading the count, adding 1, and writing back causes database bottlenecks and race conditions where votes are overwritten.
> 
> To solve this, I designed Redis to do real, critical work:
> 1. Redis handles the hot write path: every vote executes an atomic `HINCRBY` operation directly in memory, which runs in sub-milliseconds without race conditions.
> 2. The backend publishes a lightweight event on Redis Pub/Sub (`poll:{id}:events`), which pushes the updated counts to all WebSocket subscribers instantly without querying the database.
> 3. Concurrently, MongoDB persists individual vote records with a compound unique index on `(pollId, voterId)` to prevent duplicate voting.
> 4. If Redis ever restarts, our cache hydration logic automatically aggregates the MongoDB votes and rebuilds the Redis hash counter seamlessly."*

#### Part 4: Did You Use AI Tools? (2:45 - 3:30)
> *"Answering the second question: **Did you use any AI tools while building this?**
> 
> Yes, I used AI tools (including Antigravity / Gemini) during development. Specifically, AI helped me brainstorm modern UI glassmorphism design concepts, structure the initial Go Gin + Redis boilerplate, and write the Web Audio synthesizer logic.
> 
> However, AI also required careful manual intervention: for instance, resolving Go context lifecycle bugs in WebSocket connection loops, ensuring thread-safe subscriber cleanup, and setting up single-vote browser fingerprinting. AI was a great pair-programmer that sped up my development, but I ensured that I thoroughly understood the architecture, concurrency primitives, and database schemas."*

#### Part 5: Conclusion (3:30 - 3:45)
> *"The project is fully containerized, deployed, and available on GitHub. Thank you to the GUVI and HCL hiring team for this exciting challenge, and I look forward to the next round!"*

---

### 🎙️ Tanglish / Tamil Guide (தமிழ்க் குறிப்பு)

- **Video ஆரம்பிக்கும்போது**: உங்க பெயர் சொல்லிட்டு, PulseVote — Live Polling Studio பண்ணிருக்கேன் சொல்லுங்க (React, Go Gin, MongoDB, Redis).
- **Demo காட்டும்போது**: ரெண்டு browser window பக்கத்து பக்கத்துல வெச்சிட்டு (ஒரு window creator/dashboard, இன்னொரு window incognito/audience), ஒரு window-ல vote பண்ணா உடனே அடுத்த window-ல refresh இல்லாம live-ஆ bar animate ஆகுறதையும், confetti & live floating reactions வரதையும் காட்டுங்க.
- **Challenge கேட்டதுக்கு**: "High concurrent voting வரும்போது MongoDB-ல lock ஆகாம இருக்க, Redis `HINCRBY` atomic counter மூலமா live update பண்ணி, Redis Pub/Sub வழியா WebSocket clients-க்கு push பண்ணோம். MongoDB-ல durable unique vote store பண்ணி duplicate voting தடுத்தோம்" னு சொல்லுங்க.
- **AI Tool பயன்பாடு**: "AI (Antigravity/Gemini) use பண்ணி boilerplate & UI design speed up பண்ணேன், ஆனா backend concurrency, WebSocket lifecycle, Redis pipeline logic-லாம் நானே verify பண்ணி build பண்ணிருக்கேன்" னு சொல்லுங்க.

---

## 🌐 How to Deploy to a Public Working Link (FREE)

### Option 1: Render (Recommended - Backend + DB) & Vercel (Frontend)

1. **Database**:
   - **MongoDB Atlas**: Create a free M0 cluster at [mongodb.com/atlas](https://www.mongodb.com/atlas) ➔ Get connection string `mongodb+srv://...`
   - **Upstash Redis**: Create a free Redis database at [upstash.com](https://upstash.com) ➔ Get Redis Host & Password.

2. **Backend (Render)**:
   - Push your repo to GitHub.
   - Go to [render.com](https://render.com) ➔ New **Web Service** ➔ Select your repository.
   - Root Directory: `backend`
   - Runtime: `Docker` (or `Go`)
   - Environment Variables:
     ```env
     PORT=8080
     MONGO_URI=your-mongodb-atlas-uri
     MONGO_DB=pulsevote
     REDIS_ADDR=your-upstash-endpoint:6379
     REDIS_PASSWORD=your-upstash-password
     JWT_SECRET=your-random-secret-key-12345
     FRONTEND_URL=https://your-frontend-domain.vercel.app
     ```

3. **Frontend (Vercel)**:
   - Go to [vercel.com](https://vercel.com) ➔ Import Git Repository.
   - Root Directory: `frontend`
   - Framework Preset: `Vite`
   - Environment Variables:
     ```env
     VITE_API_URL=https://your-backend.onrender.com/api
     VITE_WS_URL=wss://your-backend.onrender.com/ws
     ```
   - Click **Deploy**!

---

## 💻 Local Quick Run

To run locally anytime with 1 click:
Double-click:
```cmd
START_PULSEVOTE.bat
```
- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:8080`
- Demo User: `demo@pulsevote.io` / `demo1234`
