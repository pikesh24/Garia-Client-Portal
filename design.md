# Garia Solutions — Client/Admin Portal Design Spec

## 1. What this app is

A B2B client portal for **Garia Solutions**, a software development agency. Two
user roles share the same shell with different nav:

- **Client** — `/` (Dashboard), `/feature-requests`, `/project-features`,
  `/tickets`, `/meetings`, `/maintenance`, `/profile`
- **Admin** — `/admin` (Global Dashboard), `/admin/users`, `/admin/meetings`,
  `/admin/tickets`, `/admin/feature-requests`, `/admin/billing`, `/admin/profile`
- **Shared** — `/login`

It's an internal ops tool, not a consumer app: invoices, support tickets,
feature-request approvals, maintenance cycles, billing/discounts, meeting
scheduling. The tone should read as **serious, premium, slightly severe** —
like a finance/ops dashboard crossed with a print-design studio site — never
playful or rounded-and-friendly.

## 2. Aesthetic direction

Two references define the visual language. Pull from **both**, don't pick one:

1. **E-reader app screens** (cream/charcoal/coral-red, rounded phone cards,
   oversized chapter numerals as background decoration, hairline rules,
   editorial serif-adjacent display type).
2. **Tech spec cards** (near-black/cream/coral-red, hard geometric layout,
   monospace labels, dense data rows, circuit-line texture, barcode/spec-sheet
   feel).

The fusion is **neo-brutalist editorial**: thick hard borders, **offset hard
shadows** (no blur, no glow — shadows are flat color blocks), big bold
uppercase display type, monospace for anything numeric/technical (IDs, prices,
dates, statuses), and oversized faint numerals/glyphs used as background
decoration behind cards. Corners are **sharp, not rounded** (radius 0)
everywhere except small circular accent dots/badges, which are full circles.

Avoid: soft drop shadows, gradients, rounded-xl cards, pastel palettes,
SaaS-generic blue, friendly micro-illustrations. This is not Notion/Linear —
it's closer to a brutalist print poster turned into a dashboard.

## 3. Color tokens

Both modes share the same accent (coral-red) and swap base/panel polarity.

### Light mode
| Token | Hex | Use |
|---|---|---|
| `bg-base` | `#E8E2D6` | Page background (warm cream) |
| `bg-panel` | `#3E444A` | Card chrome, sidebar, headers (dark slate) |
| `bg-panel-alt` | `#F2ECE0` | Secondary panel fill, slightly lighter than base |
| `accent` | `#ED4A3F` | Primary actions, highlights, critical states |
| `text-main` | `#2A2E33` | Body text on base |
| `text-inverse` | `#E8E2D6` | Text on panel (dark) backgrounds |
| `text-muted` | `#8A8F95` | Secondary/meta text |
| `border-strong` | `#2A2E33` | All structural borders (2-4px) |
| `border-subtle` | `rgba(42,46,51,0.15)` | Table row dividers, faint rules |

### Dark mode
| Token | Hex | Use |
|---|---|---|
| `bg-base` | `#151A21` | Page background (near-black navy) |
| `bg-panel` | `#E8E2D6` | Card chrome, sidebar, headers (cream — inverted) |
| `bg-panel-alt` | `#21272D` | Secondary panel fill |
| `accent` | `#ED4A3F` | Same coral-red, unchanged across modes |
| `text-main` | `#E8E2D6` | Body text on base |
| `text-inverse` | `#151A21` | Text on panel (light) backgrounds |
| `text-muted` | `#8A8F95` | Secondary/meta text |
| `border-strong` | `#E8E2D6` | All structural borders |
| `border-subtle` | `rgba(232,226,214,0.15)` | Faint rules |

Key rule: **panel and base invert roles between modes**, but the accent never
changes. Borders are always the strongest text color, full opacity, never gray.

## 4. Typography

- **Display/headings**: system sans (Helvetica Neue / Inter fallback), weight
  900 (black), uppercase, tight/negative letter-spacing on large sizes (page
  titles), wide positive letter-spacing on small labels (badges, nav, table
  headers).
- **Body**: same sans family, regular/medium weight, normal case, comfortable
  line-height.
- **Monospace**: used for anything that is data, not prose — IDs (`INV-00042`),
  dates, prices, statuses in dense tables, build/version strings, timestamps.
- Page titles are huge (e.g. `text-6xl`, black, uppercase) sitting on a thick
  bottom border — treat them as a poster headline, not a small "h1".
- Oversized faint numerals/icons (huge, ~10-20% opacity, `text-9xl`+) are used
  behind card content purely as background texture/section numbering (e.g. a
  giant "01" behind the invoices card, a giant "!" behind a critical-alert
  card). This is a signature motif — keep it.

## 5. Shape, borders, shadows

- Border radius: **0 everywhere** (cards, buttons, inputs, tables, modals).
  Exception: small avatar/status dots and the theme-toggle/account button are
  full circles.
- Border weight: 2px standard, 4px for emphasis (modals, page-header rule,
  critical-state cards).
- Shadows are **flat offset shadows** in the border color, never blurred:
  `4px 4px 0 <border-strong>` resting, `6-8px` on hover, `0` (collapsed) when
  pressed, paired with a `translate` of the element itself so the shadow
  appears to "catch up" — this is the signature button/card interaction.
- Decorative circles (full opacity color blobs, sometimes `mix-blend-multiply`)
  are used behind stat callouts (e.g. a big red circle bleeding off the corner
  of a discount card) — keep 1-2 per page max, don't overuse.

## 6. Core components (behavior + look)

- **Card**: bg-panel, 2px border-strong, hard offset shadow, no radius.
  Header is a bordered strip with black uppercase tracked-out label; body has
  generous padding (~32px).
- **Button**: border-strong 2px, no radius, hard offset shadow that grows on
  hover (`translate(-1,-1)`) and disappears with the element pressing down
  into the shadow on active (`translate(1,1)`, shadow none). Variants:
  `primary` (accent fill), `secondary` (panel fill), `danger` (base fill +
  accent text/border), `ghost` (borderless, subtle hover fill).
- **Input/Select/Textarea**: base fill, 2px border, sharp corners, focus state
  swaps border to accent and adds a small accent-colored offset shadow (no
  glow ring).
- **StatusBadge**: small bordered uppercase tracked-out chip; bucket-based
  coloring (positive = panel-inverse fill, warning = accent fill, neutral =
  base fill, danger = accent border/text on base).
- **Table**: bordered container with its own offset shadow; header row is
  bg-panel/text-inverse uppercase mono-tracked; body rows separated by hairline
  `border-subtle`, hover tints with `border-subtle` fill.
- **Modal**: heavier 4px border, large offset shadow, dark overlay, header
  strip matches Card header but bolder.
- **EmptyState**: dashed border container, small bordered icon chip, bold
  uppercase message.
- **Sidebar**: fixed-width dark/panel-colored rail, logo mark (small accent
  circle + wordmark + mono subtitle), nav items uppercase bold tracked-out,
  active item gets full accent fill + arrow icon + label nudges right; footer
  shows mono build/status strings.
- **Header/topbar**: breadcrumb trail in muted uppercase mono with `/`
  separators (last crumb bold/dark), circular theme-toggle button (sun/moon
  icon swap), bordered account-menu button with dropdown (panel-colored header
  block showing name/email in mono, list of actions, destructive item in
  accent).
- **PageHeader**: oversized black uppercase title on a thick bottom border,
  optional action button at the right.

## 7. Motion

Keep motion minimal and mechanical (befitting the brutalist tone) — no easing
curves that feel bouncy/soft. Use linear/short `ease` transitions (~150-300ms)
for: theme toggle (color values), hover/active translate+shadow on
buttons/cards, nav item underline/translate, dropdown open/close. No parallax,
no spring physics, no skeleton shimmer — use the bordered spinner (a
border-strong ring with an accent-colored top segment) for loading states.

## 8. Light vs. dark mode toggle

A persistent circular icon button (sun in light mode, moon in dark mode) in
the topbar toggles a `dark` class on the root element; every token above is
implemented as CSS variables so components don't need per-mode conditionals.
Both modes must look intentional and complete — dark mode is not just an
inverted filter, it's panel/base role-swap as described in §3.

## 9. Page-by-page content briefs

- **Login**: centered single card, small accent dot + wordmark, email/password
  fields, full-width primary submit, inline error alert above the form.
- **Client Dashboard**: page header "Command Center"; conditional critical
  alert card (rejected maintenance, accent border, giant faint "!" backdrop)
  above the fold when present; two-column grid — invoices table (left, 2 cols
  wide, giant faint "01" backdrop) and an active-discount spotlight card
  (right, giant percentage/value in display type, decorative accent circle
  bleeding off a corner).
- **Admin Global Dashboard**: same density/format as client dashboard but
  aggregated across all clients — multi-client tables, org-wide totals.
- **Tickets / Feature Requests / Maintenance / Meetings**: list-first layout —
  page header with a primary "New/Request" action on the right, filter row,
  bordered table or card-list with `StatusBadge` per row, row click opens a
  detail `Modal` with status history and an action form (textarea + select +
  submit) at the bottom.
- **Project Features**: read-mostly catalog of what's included in the base
  project package — card grid, no actions, informational.
- **Profile**: account details form (name/email/password) in a single card,
  plus a read-only "account meta" panel (role, mono-styled join date/ID).
- **Admin Users / Client Accounts Matrix**: dense table of all client
  accounts with status badges, drill-in to per-client detail.
- **Admin Billing**: invoices/discounts management — table + create/edit
  modal forms, draft/finalized/paid status badges.

## 10. What to hand Google Stitch

Generate both a **light** and a **dark** theme screen set for: Login, Client
Dashboard, a list page (Tickets), and the Sidebar+Topbar shell, using the
exact tokens in §3, the type rules in §4, and the shape/shadow rules in §5.
Keep layouts data-dense and utilitarian (this is an ops tool for a dev
agency, not a marketing site) while preserving the editorial/brutalist
personality from the two references — oversized faint numerals as backdrop
texture, hard offset shadows, uppercase tracked-out labels, monospace for all
IDs/dates/prices, sharp corners except circular accent dots.
