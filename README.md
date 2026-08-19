# Maya

> **A warm, emotionally aware AI companion for conversations, voice notes, shared activities, and lasting context.**

[![Node.js runtime](https://img.shields.io/badge/Node.js-runtime-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![React 19](https://img.shields.io/badge/React-19.2.1-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9.3-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License metadata](https://img.shields.io/badge/License-MIT%20(metadata)-6f42c1)](./package.json)

[Local preview](http://localhost:3000) · [Documentation](#getting-started) · [Report a bug](https://github.com/vincenzo-afk/MAYA/issues) · [Request a feature](https://github.com/vincenzo-afk/MAYA/issues/new)

---

## <a name="table-of-contents"></a>Table of Contents

- [About](#about)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Usage](#usage)
- [API Reference](#api-reference)
- [Data Model](#data-model)
- [Project Structure](#project-structure)
- [Features and Operating Notes](#features-and-operating-notes)
- [Testing](#testing)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [Security](#security)
- [License](#license)
- [Acknowledgments](#acknowledgments)

---

## <a name="about"></a>About

Maya is a full-stack companion web application designed for private, ongoing conversations. A signed-in user can chat in English or Hinglish, receive streamed replies, record a voice note for server-side transcription, use a browser-based voice call mode, play activities, co-watch a YouTube video, and let Maya remember relevant personal context over time. Maya is intentionally framed as a fictional AI companion rather than a human or a substitute for professional care. [1] [2]

The companion experience is personalized per user. The application persists messages, durable memories, emotion/mood records, relationship continuity, display preferences, activity state, co-watch sessions, and one daily check-in record per user/date. [3]

### Key capabilities

| Area | What Maya provides |
|---|---|
| Emotional conversation | Server-Sent Events (SSE) streaming, heuristic emotion labeling, a warm Hinglish-friendly prompt, and user-mood logs. |
| Continuity | Durable memory candidates for names, preferences, and birthdays, plus rapport and recurring-topic context. |
| Voice | Recorded voice notes uploaded to storage and transcribed server-side; browser speech synthesis with ten selectable voice styles; browser speech-recognition call mode where supported. |
| Visual messages | In-chat photorealistic image generation for Maya, tap-to-expand photo presentation, emoji reactions, GIFs, and stickers. |
| Shared activities | Chess, Sudoku, tic-tac-toe, brainteasers, a math prompt, calendar/day lookup, a browser voice game, and YouTube co-watch. |
| Privacy boundary | Manus OAuth authentication and user-scoped database procedures for companion data. |

> **Companion boundary:** Maya’s prompt explicitly discloses that she is AI when asked, avoids claims of physical life or consciousness, and directs crisis content toward local emergency support and trusted people. [2]

---

## <a name="architecture"></a>Architecture

The React client communicates with the tRPC API under `/api/trpc`. Text chat uses a dedicated authenticated SSE endpoint at `/api/maya/stream`, allowing the user message, response deltas, and final stored Maya message to arrive progressively. Express also serves the Manus OAuth callback and storage proxy; Drizzle persists user-scoped records to a MySQL-compatible database. [1] [3] [4]

```mermaid
flowchart LR
  U[Signed-in user] --> W[React 19 client]
  W -->|tRPC + credentials| R[/api/trpc]
  W -->|SSE POST| S[/api/maya/stream]
  W -->|MediaRecorder voice note| V[Voice-note mutation]

  R --> E[Express + tRPC]
  S --> E
  V --> E
  E --> O[Manus OAuth session]
  E --> L[Forge-compatible LLM]
  E --> T[Whisper transcription]
  E --> I[Image generation]
  E --> ST[Object storage]
  E --> D[(MySQL / Drizzle)]

  L --> E
  T --> E
  I --> E
  ST --> E
  D --> E
```

### Conversation lifecycle

1. The client submits a message to the authenticated stream endpoint.
2. The server stores the user message and assembles prompt context from recent messages, saved memories, and relationship state.
3. The LLM stream is relayed to the browser as SSE `delta` events.
4. On completion, the server stores Maya’s final reply, records a mood event, updates relationship context, and saves eligible memory candidates. [2] [4]

---

## <a name="tech-stack"></a>Tech Stack

| Layer | Technologies present in this repository |
|---|---|
| Frontend | React **19.2.1**, React DOM **19.2.1**, TypeScript **5.9.3**, Vite **7.1.7**, Wouter **3.3.5**, TanStack React Query **5.90.2**, Tailwind CSS **4.1.14**, Framer Motion **12.23.22**. [5] |
| Backend | Express **4.21.2**, tRPC **11.6.0**, Zod **4.1.12**, SuperJSON **1.13.3**, TSX **4.19.1**. [5] |
| Data and storage | Drizzle ORM **0.44.5**, Drizzle Kit **0.31.4**, MySQL2 **3.15.0**, AWS SDK S3 client **3.693.0**. [5] |
| Companion activities | Chess.js **1.4.0** for chess rules and move generation. [5] |
| AI services | Forge-compatible chat completion streaming, server-side Whisper transcription semantics, managed image generation, and managed object storage. [2] [4] |
| Testing and quality | Vitest **2.1.4**, TypeScript compiler checks, and Prettier **3.6.2**. [5] |

---

## <a name="getting-started"></a>Getting Started

### Prerequisites

Install Node.js and the package manager specified by the project: `pnpm@10.4.1`. The repository does not define a Node `engines` range; use a current Node.js release compatible with the listed tooling. A running MySQL-compatible database and the configured Manus/Forge services are required for authentication, persistence, LLM responses, transcription, image generation, and storage. [5] [6]

### Installation

```bash
git clone https://github.com/vincenzo-afk/MAYA.git
cd MAYA
pnpm install
```

### Configuration

The application expects its runtime configuration to be injected by the Manus project environment. Do **not** commit real credentials or create a public `.env` containing secrets. The following table reflects all environment variables referenced by the codebase. [6] [7]

| Variable | Used for | Required locally |
|---|---|---|
| `DATABASE_URL` | Drizzle/MySQL connection string and migration generation. | Yes, for persistence and migrations. |
| `JWT_SECRET` | Signing the Maya session cookie. | Yes, for OAuth-backed sessions. |
| `VITE_APP_ID` | Manus application identifier used by the OAuth client/server flow. | Yes, for Manus sign-in. |
| `OAUTH_SERVER_URL` | Manus OAuth service base URL. | Yes, for Manus sign-in. |
| `OWNER_OPEN_ID` | Identifies the project owner for role assignment. | Required by the platform configuration. |
| `BUILT_IN_FORGE_API_URL` | Forge API base URL for AI, storage, and related services. | Yes, for managed AI services. |
| `BUILT_IN_FORGE_API_KEY` | Server-side Forge authorization. | Yes, for managed AI services. |
| `VITE_FRONTEND_FORGE_API_URL` | Frontend Forge API base URL. | Required by the generated client integration. |
| `VITE_FRONTEND_FORGE_API_KEY` | Frontend Forge API key. | Required by the generated client integration. |
| `VITE_OAUTH_PORTAL_URL` | Browser login portal location. | Required by the generated client integration. |
| `PORT` | Preferred HTTP port; defaults to `3000` if unset. | Optional. |
| `NODE_ENV` | Controls development Vite middleware versus production static serving. | Optional; scripts set it. |

### Database migrations

The repository contains committed Drizzle migrations. With a valid `DATABASE_URL`, use the project’s defined database script:

```bash
pnpm db:push
```

### Run locally

```bash
pnpm dev
```

The development command runs `tsx watch server/_core/index.ts`. The server chooses an available port beginning with `3000`, then serves the React app and APIs from the same process. [4] [5]

---

## <a name="usage"></a>Usage

### Start a private conversation

1. Open the local app and select **Meet Maya**.
2. Complete the Manus OAuth flow.
3. Send a message. Maya streams her reply while keeping the completed conversation and relevant context in the authenticated user’s account.

### Use voice features

| Feature | Flow | Browser/service requirement |
|---|---|---|
| Voice note | Record audio, upload it, transcribe it server-side, then receive Maya’s reply. | Microphone permission, managed storage, and server-side transcription access. Voice-note payloads above 16 MB are rejected. [8] |
| Voice call | Start the in-browser call interface; speech is transcribed with `SpeechRecognition`/`webkitSpeechRecognition` when available; Maya’s reply uses browser `SpeechSynthesis`. | Browser support and microphone permission. The client presents ten selectable playback styles. [9] |
| Voice game | Say “Maya, let’s play” when prompted. | Browser speech recognition support. [10] |

### Play or co-watch

Open the activities drawer to play chess, Sudoku, tic-tac-toe, brainteasers, math, calendar, or the voice game. Activity state is saved through the authenticated Maya router. For a co-watch, paste a valid YouTube URL, optionally add viewing notes, and send the generated discussion prompt into the chat. The player uses YouTube’s `youtube-nocookie` embed domain. [10] [11]

---

## <a name="api-reference"></a>API Reference

All procedures under `maya.*` are protected by Manus authentication. The generated React client calls them through the tRPC transport at `/api/trpc`; this repository does not provide a public, unauthenticated REST API. [12]

### Live chat stream

| Method | Path | Authentication | Behavior |
|---|---|---|---|
| `POST` | `/api/maya/stream` | Manus session | Accepts `{ "content": "..." }` with 1–4,000 characters and returns SSE events: `user`, `delta`, `done`, or `error`. [4] |

### Companion procedures

| Procedure | Operation | Purpose |
|---|---|---|
| `maya.bootstrap` | Query | Loads recent messages, preferences, mood entries, and daily check-ins. |
| `maya.sendMessage` | Mutation | Creates a message and returns a non-streamed Maya reply plus emotion data. |
| `maya.generatePhoto` | Mutation | Creates a safe-for-work Maya photo message from a 3–500 character scene request. |
| `maya.processVoiceNote` | Mutation | Stores, transcribes, and responds to a recorded voice note. |
| `maya.setReaction` | Mutation | Toggles an emoji reaction on a user-owned message. |
| `maya.sendMedia` | Mutation | Stores a GIF URL or a sticker message. |
| `maya.memories`, `maya.mood`, `maya.dailyCheckIns` | Queries | Reads user-scoped companion history. |
| `maya.openDailyCheckIn` | Mutation | Opens or returns the one daily check-in for a `YYYY-MM-DD` date. |
| `maya.preferences`, `maya.updatePreferences` | Query / mutation | Reads or updates theme, voice style, and display photo. |
| `maya.saveGameSession` | Mutation | Persists chess, Sudoku, tic-tac-toe, brainteaser, math, calendar, or voice-game state. |
| `maya.saveYoutubeSession` | Mutation | Persists a YouTube co-watch URL, title, and notes. |

Inputs are validated with Zod in the procedure router. Refer to [`server/routers/maya.ts`](./server/routers/maya.ts) for the typed input contracts. [12]

---

## <a name="data-model"></a>Data Model

The schema models each companion artifact by `userId` and indexes common history queries. [3]

| Table | Responsibility |
|---|---|
| `users` | Manus OAuth identity and role fields. |
| `maya_messages` | User and Maya messages, type, optional media URL, emotion, and reactions. |
| `maya_memories` | Durable memory facts, categories, relevance, and update timestamps. |
| `maya_mood_logs` | Detected user mood, Maya emotion, intensity, and optional check-in session link. |
| `maya_daily_checkins` | One private daily check-in per user/date. |
| `maya_preferences` | Theme, voice-style index, and optional display photo. |
| `maya_relationships` | Rapport score, preferred tone, recurring mood, and last meaningful topic. |
| `maya_game_sessions` | Saved state and results for supported activities. |
| `maya_youtube_sessions` | Co-watch video URL, title, notes, and creation time. |

---

## <a name="project-structure"></a>Project Structure

<details>
<summary>View the relevant application structure</summary>

```text
MAYA/
├── client/
│   └── src/
│       ├── components/
│       │   ├── MayaCompanion.tsx     # Main signed-in companion UI
│       │   ├── MayaActivities.tsx    # Games and YouTube co-watch drawer
│       │   └── ui/                   # Shared UI primitives
│       ├── pages/Home.tsx            # Home route
│       ├── main.tsx                  # React Query and tRPC client bootstrap
│       └── index.css                 # Global visual system
├── drizzle/
│   ├── schema.ts                     # Drizzle schema and inferred types
│   └── 000*.sql                      # Committed MySQL migrations
├── server/
│   ├── _core/
│   │   ├── index.ts                  # Express server, SSE stream, tRPC mount
│   │   ├── oauth.ts                  # Manus OAuth callback
│   │   ├── llm.ts                    # Forge-compatible LLM client
│   │   └── voiceTranscription.ts     # Server-side transcription client
│   ├── routers/maya.ts               # Protected companion procedures
│   ├── db.ts                         # Drizzle data-access helpers
│   ├── mayaBrain.ts                  # Prompt, memory, mood, streaming logic
│   └── *.test.ts                     # Vitest specifications
├── shared/                           # Shared constants and error types
├── package.json                      # Scripts and dependencies
└── vitest.config.ts                  # Test runner configuration
```
</details>

---

## <a name="features-and-operating-notes"></a>Features and Operating Notes

### Implemented

- ✅ Authenticated private companion data and Manus OAuth flow.
- ✅ Streaming emotional text chat with persisted context and relationship state.
- ✅ Server-side voice-note transcription and media storage.
- ✅ Browser voice-call mode and ten playback-style presets.
- ✅ Image messages, emoji reactions, GIFs, and stickers.
- ✅ Chess, Sudoku difficulty settings and hints, unbeatable tic-tac-toe logic, brainteasers, math, calendar, and a voice game.
- ✅ YouTube co-watch embed with private session notes.
- ✅ Daily check-ins and session-linked mood history.

### Operating notes

Browser `SpeechRecognition` is not universal; the voice-call and voice-game UI displays a fallback explanation where the capability is unavailable. Image generation, LLM replies, storage, and transcription depend on platform-provided Forge services and credentials. The codebase contains no Dockerfile, compose definition, or CI workflow, so container and CI instructions are not implied by this repository. [4] [8] [10]

---

## <a name="testing"></a>Testing

Run the documented validation commands:

```bash
pnpm test
pnpm check
```

The project uses Vitest. The committed suite covers session logout behavior, protected companion procedures, emotion/memory helpers and streaming-error handling, plus Sudoku and tic-tac-toe game logic. The current suite contains four test files and fifteen tests. [5] [13]

Format source files with:

```bash
pnpm format
```

No CI workflow file is committed at this time; run these commands locally or in your chosen CI provider before merging changes. [5]

---

## <a name="deployment"></a>Deployment

Build and launch the production server with the scripts defined in `package.json`:

```bash
pnpm build
pnpm start
```

`pnpm build` creates the Vite client build and bundles the server entry into `dist`. `pnpm start` runs `dist/index.js` with `NODE_ENV=production`, which serves static frontend files through the same Express server. Ensure the configuration variables in [Configuration](#configuration) are available in the deployment environment before starting the process. [4] [5]

This repository was created for a managed Manus web-app environment. It does not include an independent Docker, Kubernetes, Vercel, or GitHub Actions deployment configuration.

---

## <a name="contributing"></a>Contributing

Contributions should preserve the project’s typed, user-scoped companion model.

1. Create a focused branch, such as `feat/mood-insights` or `fix/voice-note-error`.
2. Install dependencies with `pnpm install`.
3. Make the smallest coherent change and add or update Vitest coverage when logic changes.
4. Run `pnpm test` and `pnpm check`.
5. Use a clear, imperative commit message, such as `feat: add mood journal filters`.
6. Open a pull request that explains the user impact, validation performed, and any migration requirements.

No separate `CONTRIBUTING.md` or code-of-conduct file is currently committed.

---

## <a name="security"></a>Security

Maya uses Manus OAuth for identity and protects companion procedures with the server’s `protectedProcedure`. The OAuth callback validates the one-time state/nonce before exchanging the authorization code, upserts the user, and creates the session. Companion procedure inputs are validated with Zod; recorded voice-note payloads are limited to 16 MB before transcription. [8] [12] [14]

Keep all service credentials in managed environment settings. Do not commit API keys, OAuth secrets, database URLs, session secrets, or recorded user content. If you discover a vulnerability, report it privately to the repository owner rather than opening a public issue with reproduction details.

---

## <a name="license"></a>License

`package.json` declares this project as **MIT**. A standalone `LICENSE` file is not currently present in the repository, so add the full chosen license text before distributing a public release. [5]

---

## <a name="acknowledgments"></a>Acknowledgments

Maya is built with the React, Express, tRPC, Drizzle, Vitest, Tailwind CSS, and Chess.js ecosystems listed in the project manifest. The repository’s configured Git author is **vincenzo-afk**. [5]

---

<p align="center">
  <a href="#maya">Back to top</a> ·
  <a href="https://github.com/vincenzo-afk/MAYA">GitHub</a> ·
  <a href="https://github.com/vincenzo-afk/MAYA/issues">Support</a>
</p>

<p align="center">Built with care by <strong>vincenzo-afk</strong>.</p>

## Code References

[1]: ./client/src/components/MayaCompanion.tsx
[2]: ./server/mayaBrain.ts
[3]: ./drizzle/schema.ts
[4]: ./server/_core/index.ts
[5]: ./package.json
[6]: ./server/_core/env.ts
[7]: ./client/src/main.tsx
[8]: ./server/routers/maya.ts
[9]: ./client/src/components/MayaCompanion.tsx
[10]: ./client/src/components/MayaActivities.tsx
[11]: ./client/src/components/MayaActivities.tsx
[12]: ./server/routers.ts
[13]: ./server/mayaBrain.test.ts
[14]: ./server/_core/oauth.ts
