# BlackHole progress

Last updated: 2026-11-22

## Completed

- [x] Next.js 16, TypeScript, Tailwind CSS foundation
- [x] Premium responsive black-and-gold application shell
- [x] Durable local persistence with seeded starter knowledge
- [x] PostgreSQL state adapter and pgvector embedding mirror
- [x] Normalized PostgreSQL reference schema and SQL migration
- [x] Memory create, read, edit, archive, delete, search, filter, import, and export
- [x] Deterministic local embeddings with optional OpenAI embeddings
- [x] RAG chat with source citations and explicit insufficient-evidence behavior
- [x] Automatic semantic connections and manual connection endpoints
- [x] Cinematic full-screen React Three Fiber universe with memory fragments, constellation lines, orbital arcs, procedural nebulae, and a luminous animated black hole
- [x] Project pages, progress controls, goals, knowledge, tasks, and summaries
- [x] Task board with status movement, priority, project, and due dates
- [x] Markdown, TXT, PDF, DOCX, JSON, CSV, and Obsidian ZIP import
- [x] Exact duplicate detection and import audit history
- [x] Owner password authentication and signed HTTP-only sessions
- [x] Server-side API authorization and user-controlled data deletion
- [x] Unit tests for semantic retrieval
- [x] Heading-level hybrid retrieval with precise section and line citations
- [x] Confirmation-gated local Jarvis actions with a persistent audit trail
- [x] Automatic skill/vault sync with status, concurrency protection, and full-content indexing
- [x] Rich Markdown, GFM, Obsidian wikilink, and Mermaid rendering
- [x] Domain-aware Roblox universe clusters and dedicated vault/Roblox filters
- [x] Automatic and manual backups with restore preview, safety copy, and retention
- [x] Unit tests for chunk retrieval and Jarvis action parsing
- [x] Quiet one-click Windows launcher with Desktop and Start-menu shortcut support
- [x] Codex skill-reference ingestion in addition to top-level `SKILL.md` memory
- [x] Live Obsidian vault ingestion with explicit wikilink graph connections and stale-note cleanup
- [x] Filtered Skills & Vault library with progressive card loading
- [x] Type check, lint, and production build validation

## Deliberate deployment follow-ups

- [ ] Choose a production host and secret manager.
- [ ] Replace single-owner password login with a production identity provider if multi-user access is needed.
- [ ] Add object storage for original large document binaries; extracted text is already retained.
- [ ] Add a pgvector ANN index after choosing one fixed embedding dimension for production.
- [ ] Add browser-level end-to-end tests to the deployment CI pipeline (local visual and API smoke checks are complete).

## Local setup

1. Run `npm install`.
2. Run `npm run dev` and open `http://localhost:3000`.
3. Optionally copy `.env.example` to `.env.local` for password protection, OpenAI synthesis, or PostgreSQL.
4. For PostgreSQL, run `docker compose up -d`, uncomment `DATABASE_URL`, and restart the app.
5. Validate changes with `npm test`, `npm run lint`, and `npm run build`.
