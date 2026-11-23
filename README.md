# BlackHole

BlackHole is a private, AI-powered second brain built around a cinematic 3D knowledge universe. It stores memories, connects related ideas, retrieves grounded context for chat, and keeps projects and tasks attached to the knowledge behind them.

## What works

- Persistent memory CRUD, archive, semantic search, tags, categories, sources, and JSON/Markdown export
- Heading-level hybrid retrieval with exact source sections, line references, and a citation-first no-key fallback
- Confirmation-gated Jarvis actions for tasks, memories, project progress, and library sync, with an audit history
- Automatic embedding-based connections plus editable connection APIs
- Interactive Three.js / React Three Fiber universe with real memory stars, clusters, lines, filters, orbit controls, and memory navigation
- Dashboard, projects, progress, tasks, document importer, import history, settings, and data deletion
- TXT, Markdown, PDF, DOCX, JSON, CSV, and Obsidian ZIP imports with exact duplicate detection
- Server-side password protection with an HTTP-only signed cookie
- Immediate local JSON persistence and optional PostgreSQL + pgvector persistence
- Persistent skill memory that mirrors installed Codex skills and their reference guides into the universe
- Automatic 30-second Obsidian/skill sync with visible health, full-content indexing, and `[[wikilinks]]` preserved as graph connections
- Filtered Skills & Vault library for browsing skills, detailed references, and vault notes without a crowded all-at-once view
- Rich Markdown, tables, code blocks, wikilinks, and Mermaid diagrams in memory views
- Daily and on-demand local backups with restore preview, safety snapshots, and 24-snapshot retention
- Roblox knowledge clustered into Luau, security, economy, gameplay, 3D, animation, VFX, UI/UX, world, and live-operations domains
- Live skill-usage telemetry: retrieved or opened skills pulse with bright halos in the universe for 15 minutes, with usage counts and a local integration API

## Quick start on Windows

Requirements: Node.js 20.9 or newer. Node.js 24 is recommended.

```powershell
git clone https://github.com/Kushal700/BlackHole.git
cd BlackHole
npm install
npm run dev
```

Open `http://localhost:3000`. No service or API key is required for local mode; data is saved to `data/blackhole.json` and survives restarts.

### One-click Windows launcher

Run `scripts/Start-BlackHole.ps1` to start the production app quietly in the background and open the immersive universe in a dedicated app window without browser tabs or an address bar. The launcher reuses an existing BlackHole server, finds another local port if port 3000 is busy, and prepares dependencies/build output automatically when needed. A Windows shortcut can target:

```text
powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "<project>\scripts\Start-BlackHole.ps1"
```

## Configuration

Copy `.env.example` to `.env.local` and set only the services you want:

```powershell
Copy-Item .env.example .env.local
```

- `APP_PASSWORD`: enables the owner login screen.
- `AUTH_SECRET`: strengthens signed session cookies; use a random value of at least 32 characters.
- `OPENAI_API_KEY`: enables OpenAI embeddings and synthesized RAG answers. Without it, deterministic local vectors and citation-first extractive answers remain available.
- `DATABASE_URL`: moves persistence to PostgreSQL and mirrors embeddings into pgvector. Without it, the local JSON store is used.
- `OPENAI_CHAT_MODEL` and `OPENAI_EMBEDDING_MODEL`: optional model overrides.
- `BLACKHOLE_SKILL_ROOTS`: optional extra folders containing `SKILL.md` files. Installed Codex skills are detected automatically.
- `BLACKHOLE_VAULT_ROOTS`: optional Obsidian vault folders. On this Windows setup, `Documents\ObsidianVaults\Roblox Developer Mastery` is detected automatically.

API keys are used only in server routes and are never exposed to client code.

## PostgreSQL + pgvector

Docker Desktop provides the shortest local path:

```powershell
docker compose up -d
Copy-Item .env.example .env.local
```

Then uncomment `DATABASE_URL` in `.env.local` and restart the development server. The application initializes its durable state and pgvector tables automatically. A normalized reference schema and SQL migration are included under `prisma/` for teams that later want fully relational storage.

## Verification

```powershell
npm test
npm run lint
npm run build
```

## Privacy notes

- For private use, set `APP_PASSWORD` and protect the Windows account/disk that stores the local data file.
- For deployment, use PostgreSQL with TLS, a unique `AUTH_SECRET`, a strong owner password, and platform secret storage.
- BlackHole creates recoverable snapshots; keep an exported copy outside the project as an additional safeguard.
