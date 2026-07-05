# Garia Solutions — Dashboard Creative Brief

## Project Overview

**Garia Solutions** is a client portal built with **Next.js 14 (App Router)** and **Tailwind CSS v4**. It serves as the operational hub between Garia (a software agency) and its clients. There are two distinct user roles — **Client** and **Admin** — each with their own layout, sidebar, and dashboard.

The app has a **brutalist design system**: hard 4px borders, no border-radius, aggressive offset box-shadows (`8px 8px 0px 0px`), uppercase monospace labels, and giant decorative background numerals. Think terminal-meets-editorial.

---

## Tech Stack

- **Framework**: Next.js 14, App Router, TypeScript
- **Styling**: Tailwind CSS v4 with custom `@theme` tokens (no arbitrary values needed — all tokens are defined)
- **Icons**: Google Material Symbols Outlined (ligature-based, e.g. `<span class="material-symbols-outlined">dashboard</span>`)
- **Fonts**:
  - `Inter` — display headings, labels, UI text
  - `JetBrains Mono` — data, IDs, metadata, monospace readouts (class: `font-data-mono text-data-mono`)

---

## Design System

### Color Tokens (CSS Custom Properties)

| Token | Light Mode | Dark Mode | Usage |
|---|---|---|---|
| `--bg-base` | `#E8E2D6` (warm off-white) | `#151A21` (near-black navy) | Page background |
| `--bg-panel` | `#3E444A` (dark slate) | `#E8E2D6` (warm off-white) | Sidebar, card headers |
| `--bg-panel-alt` | `#F2ECE0` (cream) | `#21272D` (dark panel) | Card bodies, table rows |
| `--accent` / `coral-red` | `#ED4A3F` | `#ED4A3F` | Primary accent — buttons, active states, highlights |
| `--positive` | `#1E8A4F` (forest green) | `#00FF00` (terminal green) | Success, paid, resolved |
| `--warning` | `#B25E00` (amber) | `#FFC107` (yellow) | Pending, in-progress states |
| `--text-main` | `#2A2E33` | `#E8E2D6` | Body text |
| `--text-inverse` | `#E8E2D6` | `#151A21` | Text on dark panels |
| `--text-muted` | `#8A8F95` | `#c1c7ce` | Labels, secondary info |
| `--border-strong` | `#2A2E33` | `#E8E2D6` | All borders, shadow colors |
| `--border-subtle` | `rgba(42,46,51,0.15)` | `rgba(232,226,214,0.3)` | Table row dividers |

> The accent `#ED4A3F` is **coral red** — used on primary buttons, active nav items, card shadow offsets, and all critical/alert states. It's the single brand color.

### Typography Scale

| Class | Font | Size | Weight | Usage |
|---|---|---|---|---|
| `font-display-2xl text-display-2xl` | Inter | 72px | 900 | Hero numbers, stat values |
| `font-display-xl text-display-xl` | Inter | 48px | 900 | Page section titles |
| `font-headline-lg text-headline-lg` | Inter | 32px | 800 | Card headlines |
| `font-label-caps text-label-caps` | Inter | 12px | 700 | ALL CAPS labels, buttons, nav items |
| `font-data-mono text-data-mono` | JetBrains Mono | 14px | 500 | IDs, dates, amounts, metadata |
| `font-bg-numeral text-bg-numeral` | Inter | 120px | 900 | Decorative background watermark numerals |

### Spacing & Shape

- **Border radius**: `0` everywhere (brutalist — no rounded corners)
- **Card padding**: `2rem` (`p-card-padding`)
- **Box shadows**: Hard offset — `8px 8px 0px 0px var(--border-strong)` on cards, `4px 4px` on buttons, `16px 16px` on modals
- **Hover interaction**: Buttons physically shift `translate-x-1 translate-y-1` and lose their shadow — simulating a physical press
- **Grid**: 12-column on desktop (`md:grid-cols-12`), stacked on mobile

### Key Component Patterns

```
Card            — 4px border, 8px offset shadow, bg-bg-base
CardHeader      — dark bg-panel header strip with inverted text
Button primary  — coral-red bg, white text, physical press animation
Button secondary — dark panel bg, coral-red offset shadow
StatusBadge     — tiny mono pill: positive=green, warning=amber, danger=coral, neutral=muted
Alert           — 4px left border coral-red, mono font, indented panel
Modal           — 16px offset shadow, dark header strip, closes on backdrop click
EmptyState      — dashed border, centered mono text, warning icon
PageHeader      — word-broken stacked title + optional action slot, bordered bottom
```

### Status Badge Mapping

| Status | Color |
|---|---|
| open, in_progress, requested, under_review, reschedule_pending | warning (amber) |
| resolved, confirmed, completed, approved, paid, active, finalized | positive (green) |
| declined, denied, rejected | danger (coral-red) |
| pending, cancelled, out_of_scope, draft, inactive | neutral (muted gray) |

---

## Navigation Structure

### Client Sidebar
- Dashboard (`/`)
- Feature Requests (`/feature-requests`)
- Base Project (`/project-features`)
- Support Tickets (`/tickets`)
- Meetings Calendar (`/meetings`)
- Maintenance (`/maintenance`)
- **Footer CTA**: "NEW TICKET" button (coral-red offset shadow)
- **Project Switcher**: Clients can have multiple projects — a dropdown at the top of the sidebar switches context

### Admin Sidebar
- Global Dashboard (`/admin`)
- Client Accounts (`/admin/users`)
- Unified Calendar (`/admin/meetings`)
- Support Tickets (`/admin/tickets`)
- Features (`/admin/feature-requests`)
- Billing (`/admin/billing`)
- Maintenance (`/admin/maintenance`)

---

## Current Dashboard State

### Client Dashboard — "COMMAND CENTER"

**Layout**: 12-col grid, full-width page background numeral watermark `"04"` at 10% opacity.

**Current sections (top to bottom):**
1. **Critical Alert Card** (col-span-8, conditionally rendered) — coral-red bg, shows rejected maintenance records with penalty deadlines. Has a large `"!"` watermark. CTA button navigates to tickets.
2. **Promo/Discount Spotlight Card** (col-span-4 or 12 if no alert) — dark panel bg with coral-red offset shadow. Shows active discount code + value in a big coral-red box. If no discount, shows empty state.
3. **Recent Ledger Entries Table** (col-span-12) — dark header strip, invoice rows with ID, date, total, status badge (green for paid, coral for unpaid), download button.
4. **Active Nodes Visualization** (col-span-6) — dark panel, three animated bar charts (hardcoded heights), capacity percentage readout at bottom.
5. **Latest Docs** (col-span-6) — coral-red header, two hardcoded document links with hover animations.

**Data fetched**: invoices, active discount, maintenance records.

**Known weaknesses**: Nodes visualization is hardcoded/decorative. Docs are hardcoded. No quick-action shortcuts. No upcoming meetings widget. No ticket summary. No "what needs my attention today" prioritization.

---

### Admin Dashboard — "GLOBAL DASHBOARD"

**Layout**: 5-card stat row + single full-width ticket list. Background numeral `"00"`.

**Current sections:**
1. **Stat Cards** (5 cards, responsive grid) — each shows a label + giant coral-red number:
   - Active Clients (count of `is_active === true` users)
   - Pending Meeting Actions (`requested` or `reschedule_pending`)
   - Open Tickets (not `resolved`)
   - Feature Requests Awaiting Review (`under_review`)
   - Draft Invoices (`draft`)
2. **Recently Filed Tickets** — flat list of 5 most recent tickets, shows `#ID` in coral badge + description snippet (first 80 chars).

**Data fetched**: all users, all meetings, all tickets, all feature requests, all invoices.

**Known weaknesses**: Stats are dead — not clickable, no drill-down. Ticket list has no priority, no status badge, no client name. No revenue data shown despite all invoices being fetched. No meeting schedule shown despite meetings being fetched. No client health view. No activity feed. Entire right half of the page is empty.

---

## Feature Pages (Reference for Dashboard Widgets)

| Section | Key Data Available |
|---|---|
| **Tickets** | ID, description, priority (low/medium/high/critical), status, client, resolution, created_at |
| **Feature Requests** | title, status, client, discussion thread, created_at |
| **Meetings** | title, date/time, status (requested/confirmed/denied/reschedule_pending), client, notes |
| **Billing/Invoices** | ID, total, status (draft/finalized/paid), line items, discount applied, finalized_at |
| **Maintenance** | cycle_year, status (pending/proof_submitted/approved/rejected), rejection_reason, penalty_deadline |
| **Project Features** | base features, extra features, hours breakdown (frontend/backend/production), pricing |
| **Infrastructure** | modules, billing type (one-time/monthly/annual), overhead cost |

---

## What We Want: Creative Dashboard Ideas

We're looking for **creative, opinionated ideas** for redesigning both the client and admin dashboards to be genuinely useful and visually striking. They should stay true to the brutalist aesthetic — no softening, no rounded corners, no gradients, no glass morphism. The design language is hard edges, bold type, and purposeful information density.

### Constraints
- Must use the existing color tokens and typography scale listed above
- Material Symbols Outlined for icons only
- No new external libraries (no chart libraries, no animation libraries beyond what Tailwind provides)
- CSS-only or SVG-only charts if charts are needed (bar charts with `div` heights, SVG `<polyline>`, etc.)
- Responsive: stacks to single column on mobile

### Questions to answer creatively:

**For the Client Dashboard:**
- What is the most useful "at a glance" view for a client checking in on their project?
- How do we make the action-needed items feel urgent without being annoying?
- What would replace the fake "Active Nodes" bar chart with something real and useful?
- How do we surface upcoming meetings and open tickets without making it feel like a data dump?
- What would a meaningful "project health score" look like visually in this brutalist style?
- How should the quick-action shortcuts (new ticket, book meeting, request feature) be surfaced?

**For the Admin Dashboard:**
- How do we turn the 5 dead stat cards into something actionable (clickable, drill-down-able)?
- What would a revenue snapshot look like with only `div`-based bar charts?
- How do we show "client health" across all clients on one screen?
- What's the right way to show a unified triage queue (tickets + meetings + feature requests sorted by urgency)?
- How should the admin see "what happened since I last logged in" — an activity feed?
- What visual metaphors work in the brutalist style for "system status across all clients"?

### Inspiration References (style, not copy)
- Terminal/command-line dashboards (dark panels, monospace readouts)
- Bloomberg Terminal information density
- Swiss editorial design (grid-heavy, typography-first)
- Tactical military display aesthetics (status indicators, readout panels)

---

## Deliverable Expected

Detailed descriptions (or ASCII mockup layouts) of redesigned dashboard sections for both client and admin. Include:
1. Proposed layout grid breakdown (e.g. "col-span-8 left panel + col-span-4 right sidebar")
2. What each section shows and why it's useful
3. How it fits the brutalist design language
4. Any interaction patterns (hover states, click-through behavior, conditional rendering)
5. Which real data fields feed each section (reference the data table above)

No code needed — just the creative direction and rationale.
