# Garia Solutions Frontend

Next.js (App Router) + TypeScript + Tailwind v4 implementation of the client/admin
portal wireframe spec, wired to the [garia-solutions-backend](../garia-solutions-backend) FastAPI API.

## Design tokens

The Vercel-minimalist / GitHub-dark / amber-accent theme from the spec is implemented
as Tailwind v4 `@theme` tokens in `src/app/globals.css` (`bg-canvas`, `bg-surface`,
`bg-element`, `border-border-default`, `border-border-muted`, `text-amber`, `text-gold`,
`text-text-primary`, `text-text-heading`, `text-text-muted`). Radii are capped at 4-6px
via Tailwind's default `rounded-sm`/`rounded-md`. Status tickers, IDs, and prices use
`font-mono` (the spec's monospace stack); everything else uses the system sans stack.

## Setup

1. `npm install`
2. Copy `.env.local.example` to `.env.local` and point `NEXT_PUBLIC_API_BASE_URL` at
   the running backend (defaults to `http://localhost:8000`).
3. `npm run dev`

The backend must be running and its `CORS_ORIGINS` must include this app's origin
(`http://localhost:3000` is in the backend's `.env.example` by default).

## Structure

- `src/app/(client)/` — client portal routes (`/`, `/meetings`, `/tickets`,
  `/feature-requests`, `/project-features`, `/maintenance`, `/profile`)
- `src/app/(admin)/admin/` — admin portal routes, mirrors the spec's admin nav
- `src/app/login/` — shared login page (role-based redirect happens after auth)
- `src/lib/api.ts` — fetch wrapper with JWT attach + automatic refresh-on-401
- `src/lib/auth.tsx` — `AuthProvider`/`useAuth()`, holds the current user
- `src/components/RouteGuard.tsx` — redirects unauthenticated/wrong-role users
- `src/components/ui.tsx` — shared primitives (Card, Button, Table, StatusBadge, Modal, etc.)

All pages are client components that call the FastAPI backend directly via `fetch`
(no Next.js server actions/route handlers) — this keeps the data layer identical to
what a deployed SPA would do against `clients.gariasolutions.com`'s backend.

## Known simplifications (base project)

- Tokens are stored in `localStorage` (access + refresh). Fine for a first pass; move
  to httpOnly cookies if XSS exposure becomes a concern before going to production.
- File downloads (ticket attachments, maintenance proofs) hit the backend's
  `/uploads/...` static mount directly and are not access-controlled beyond knowing
  the path returned by an authenticated API call.
- No optimistic UI/toasts — actions refetch the list on success and show inline errors.
