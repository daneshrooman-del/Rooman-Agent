# Persona — AI Avatar · Video · Live AI · Agents

One digital identity, used everywhere:

```
AVATAR  →  VIDEO GENERATION  →  LIVE AI  →  AI AGENTS
identity    content layer        interaction   orchestration → workforce
```

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build
```

## Stack

Vite · React 19 · TypeScript · Tailwind CSS v4 · React Router 7 · lucide-react. No UI or animation libraries — the design system is in-repo.

## Backend integration

All data flows through **`src/lib/api.ts`** — the single integration point.

- `VITE_API_URL` **unset** → demo mode: the sample workspace in `src/data/demo.ts` is used, and the UI shows a "Demo data" marker.
- `VITE_API_URL` **set** (see `.env.example`) → every call goes to the REST API, using the endpoints listed in `api.ts` (`/me`, `/workspace`, `/avatars`, `/voices`, `/videos`, `/agents`, `/live-sessions`, `/assets`, `/analytics/usage`, plus the POST/PUT mutations).

In demo mode, long-running jobs (avatar training, video rendering, agent builds, knowledge ingestion) are simulated with `useSimulatedJob`. With a real backend, drive the same UI from polling or websocket progress events via `setProgress`. The live conversation engine (`src/components/live`) is a scripted simulation. Real-time audio and video (WebRTC or WebSocket) would plug in at that hook.

## Structure

```
src/
  index.css            design tokens (@theme), utilities, motion, reduced-motion
  types.ts             domain model — Avatar is the identity every other entity references
  data/demo.ts         demo dataset (clearly separated from API data)
  lib/                 api client, formatting, cn
  state/workspace.tsx  workspace provider: snapshot + mutations
  hooks/               useSimulatedJob, useOnline, useDocumentTitle
  components/
    ui/                Button, Card, Badge, StatusIndicator, Form controls, Tabs, Dialog, Menu, States, Toast…
    layout/            AppShell, Sidebar, Topbar, MobileNav, MobileDrawer, CommandPalette (Ctrl/⌘K)
    navigation/        nav config, logo
    avatar/ video/ live/ agents/ builder/ workflow/ knowledge/ analytics/ assets/ settings/ home/
  pages/               route-level pages, lazy-loaded
```

## Routes

| Route | Experience |
| --- | --- |
| `/` | Home |
| `/avatars`, `/avatars/new`, `/avatars/:id` | Avatar library, onboarding (upload → consent → training → ready), detail page |
| `/create?avatar=` | Create Video studio |
| `/videos` | Video library |
| `/live?avatar=` | Live AI conversation |
| `/agents`, `/agents/new`, `/agents/:id?tab=` | My Agents, conversational Agent Builder, agent command center |
| `/assets`, `/analytics`, `/settings?section=` | Library and workspace |

## Accessibility

- Semantic landmarks, a skip link and one `h1` per page.
- Native `<dialog>` for modals, with a focus trap and Esc to close.
- Roving-focus tabs, segmented controls and menus.
- `aria-live` on progress and transcripts; visible focus rings; `prefers-reduced-motion` respected.
