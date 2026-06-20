# Executive CRM — CLAUDE.md

## Project Overview
React 19 CRM application for Digital Atelier. Manages leads, clients, pipeline, analytics, and invoicing. Currently in active development — many pages are stubs.

## Tech Stack
| Tool | Version |
|---|---|
| React | 19.2.4 |
| Vite | 8.0.4 |
| Tailwind CSS | 4.2.2 (Vite plugin, no tailwind.config.js) |
| React Router | 7.14.1 |
| Lucide React | icons |
| React Icons | icons (tb, io, hi, pi, md, fi, fa, vsc, gr) |

## Commands
```bash
npm run dev      # start dev server
npm run build    # production build
npm run lint     # eslint
npm run preview  # preview build
```

## Folder Structure
```
src/
├── App.jsx                        # Root — renders AppRoutes
├── main.jsx                       # Entry — BrowserRouter + ReactDOM
├── index.css                      # Tailwind @import + @theme tokens
├── routes/
│   └── AppRoutes.jsx              # All route definitions
├── layouts/
│   ├── MainLayout.jsx             # Authenticated shell (Header + Sidebar + Outlet)
│   ├── Header.jsx                 # Top bar — search, notifications, avatar
│   └── Sidebar.jsx                # Collapsible nav — Menus + SupportMenu
├── pages/
│   ├── auth/
│   │   ├── Login.jsx              # Login page with glassmorphism right panel
│   │   └── ForgotPassword.jsx
│   ├── leads/
│   │   ├── Leads.jsx              # Leads list with table, tabs, filter/sort/export
│   │   ├── LeadEdit.jsx           # Lead detail + edit
│   │   ├── LeadDetails.jsx
│   │   ├── NewInquiriesform.jsx
│   │   └── EditInquiryform.jsx
│   ├── clients/
│   │   ├── Client.jsx             # Clients list (mirrors Leads structure)
│   │   ├── ClientProfile.jsx
│   │   ├── Addclientform.jsx
│   │   └── EditClientForm.jsx
│   ├── Dashboard.jsx              # Pipeline funnel + invoice cards
│   ├── Accounts.jsx               # Placeholder
│   ├── Pipeline.jsx               # Placeholder
│   ├── Analytics.jsx              # Placeholder
│   ├── Reports.jsx                # Placeholder
│   ├── Support.jsx                # Placeholder
│   └── Signout.jsx                # Clears localStorage + navigates to /
├── components/
│   ├── Table.jsx                  # Reusable data table with active row highlight
│   ├── Pagination.jsx             # Desktop + mobile responsive pagination
│   ├── InputField.jsx             # Unified input/select/textarea with error state
│   └── DateRangePicker.jsx        # Custom calendar range picker
├── data/
│   ├── TableData.jsx              # Mock leads data
│   └── ClientTableData.jsx        # Mock clients data
├── helperConfigData/
│   └── helperData.jsx             # Nav menus (Menus, SupportMenu, LeadsHeader)
└── assets/
    └── images/                    # ALL image assets live here
        ├── Google.png
        ├── HomePage.png
        ├── avatar.png
        ├── Client_avatar.png
        └── avatar-profile-user.svg
```

## Routing
```
/                    → Login
/forgot-password     → ForgotPassword
/ (MainLayout)
  /dashboard         → Dashboard
  /leads             → Leads
  /leads/:id         → LeadEdit
  /clients           → Client
  /clients/:id       → ClientProfile
  /accounts          → Accounts
  /pipeline          → Pipeline
  /analytics         → Analytics
  /reports           → Reports
  /support           → Support
  /signout           → Signout
```

## Color Tokens (index.css @theme)
All colors are defined as CSS variables in `src/index.css` and available as Tailwind utility classes.

| Variable | Hex | Tailwind Class |
|---|---|---|
| `--color-primary` | `#1a2b4d` | `text-primary`, `bg-primary` |
| `--color-select-blue` | `#1e3a8a` | `text-select-blue`, `bg-select-blue` |
| `--color-overallbg` | `#f4f4f4` | `bg-overallbg` |
| `--color-surface` | `#ffffff` | `bg-surface` |
| `--color-bg-soft` | `#f1f5f9` | `bg-bg-soft` |
| `--color-active-bg` | `#e2eefe` | `bg-active-bg` |
| `--color-bordergray` | `#e2e8f0` | `border-bordergray` |
| `--color-textcolor` | `#0f172a` | `text-textcolor` |
| `--color-text-muted` | `#64748b` | `text-text-muted` |
| `--color-text-subtle` | `#94a3b8` | `text-text-subtle` |
| `--color-grey` | `#475569` | `text-grey` |
| `--color-secondary` | `#9ca3af` | `text-secondary` |

**Always use these tokens** — do not hardcode hex values for these colors.

## Key Conventions

### Components
- `Table` — accepts `columns`, `data`, `activeRow`, `onRowClick`, `activeRowKey`
- `InputField` — handles `type="text"`, `"email"`, `"select"`, `"textarea"` in one component
- `Pagination` — purely controlled: `currentPage`, `totalPages`, `onPageChange`
- `DateRangePicker` — returns `{ start, end }` as `YYYY-MM-DD` strings via `onApply`

### Data flow (Leads / Client pages)
- Static mock data in `data/` is the base
- New records added via form are stored in `localStorage` and merged with mock data via `useMemo`
- Deleted record IDs are stored separately in `localStorage`
- No backend or API layer yet

### Sidebar state
- Sidebar owns its own `open` state — do not lift it to MainLayout
- `navClass` helper function handles active/inactive NavLink styling
- Menu config lives in `helperConfigData/helperData.jsx` (Menus, SupportMenu)

### Auth pages
- Login uses a glassmorphism right panel: `bg-[#E9E9FF]/40 backdrop-blur-xl border-l border-white/80`
- Left panel shows `HomePage.png` as background image
- Auth state is localStorage-backed via `src/auth/auth.js` (`login` / `logout` / `isAuthenticated`) — not real auth, but routes are now guarded
- Login sets the token then redirects to the intended URL (`state.from`), falling back to `/dashboard`; `Signout.jsx` clears the token

### Font
- `font-manrope` — apply on root layout containers, not individual elements

## Asset Imports
All assets live in `src/assets/images/`. Always use the full path:
```js
import avatar from "../../assets/images/avatar.png";     // from pages/
import avatar from "../assets/images/avatar.png";        // from layouts/
```
Filename casing matters on Linux — use exact casing (`Client_avatar.png`, not `client_avatar.png`).

## Known Issues / TODOs
- No state management library — will be needed as features grow
- `data/` folder is mock only — needs a real API integration layer
- `helperConfigData/` should be renamed to `utils/`
- `Support.jsx` is a placeholder — needs implementation
- `ErrorBoundary` logs to `console.error` — wire to a real error tracker (Sentry) when available
- No tests yet — Vitest + React Testing Library not set up
- JS only — no TypeScript / PropTypes
- Schedule activity log has no user identity — entries (work-start confirmed, room marked done, client notified) are timestamped but can't record *who* did them. Needs a backend + auth before it's a real audit trail.
- Client notifications are **logged, not sent** — the "Notify client" action in `ProjectSchedule.jsx` (`sendNotification`) only appends a timeline entry. Wire a mail/SMS service there when available; that function is the single send point.

## Allocation & Estimation (single source of truth)
- **Proposal Master is the only place allocation lives.** Per configuration: `categoryAllocations` (a `{ [category]: % }` map) holds Category Allocation %, and each scope item carries `allocationPct` for Scope Allocation % within its category. Both are persisted inside `quoteMaster` (`data/QuotePresets.js`) and preserved through `normalizePreset`.
- **Validation** (`ProposalMaster.jsx` → `collectAllocationIssues`): category totals and per-category scope totals must each equal 100% before an explicit save; percentages are never auto-adjusted silently.
- **Adjustment modal** (`AllocationAdjustModal` in `ProposalMaster.jsx`): when a category's scope total or the category total drifts off 100% (detected on input blur, via per-category "Balance" buttons, or on Save), a modal offers three resolutions with a live before→after impact preview — (1) **Adjust overall Property Preset Sq.ft**: `scaleSizeRange` resizes the preset by the over/under factor and normalises the offending group to 100%, preserving entered quantities; (2) **Redistribute** (`redistributeAllocation`): holds the edited entry fixed and rebalances the others to total 100%, Sq.ft unchanged; (3) **Cancel** and adjust manually. Editable Scope Qty ⇄ Scope % via `QtyInput`/`PctInput` (`setScopeAllocationFromQty` back-calculates the %).
- **Dynamic Estimation Engine** (`data/estimationEngine.js` → `estimateScopeQuantities(presetKey, propertyType, { sqft })`): derives scope quantities live in three named steps — `getStandardSqft(sizeRange)` (Standard Sq.ft = average/midpoint of the preset's range), `getCategorySqft(standardSqft, categoryPct)` (Category Sq.ft = Standard Sq.ft × Category %), and `getScopeQuantity(categorySqft, scopePct)` (Scope Quantity = Category Sq.ft × Scope %). Pass an actual built-up `sqft` (a property of the lead/site, not an allocation) to scale; otherwise it uses the preset's own Standard Sq.ft. Result fields: `standardSqft`, per-category `categorySqft`, per-scope `scopeQty` (older aliases `presetSqft`/`categoryArea`/`areaShare` retained).
- **Do NOT copy allocation values into Leads, Quotations, BOQ, Costing, Design Pipeline, or Site Visit.** Those modules must call `estimateScopeQuantities` to derive on the fly, storing at most a reference (presetKey + propertyType) and their own actual sqft.
- **Module integration** uses one shared read-only component, `components/EstimationReference.jsx` — give it `presetKey` (+ optional `propertyType`, `sqft`, or `sizeRange`) and it renders the live derived quantities as labelled *reference* values. It recomputes from the master on every render and refreshes live on `MASTER_EVENT` (in-tab edits), `storage` (cross-tab), and window focus, so Proposal Master edits reflect automatically everywhere. Mounted in: `leads/LeadEdit`, `components/QuoteModal`, `boq/BOQEditor`, `projects/ProjectDetail` (Costing), `sites/components/DesignPipeline` (BOQ & Costing stage), and `sites/SiteDetail`. Each consumer passes only reference fields (preset key + property type + its own sqft) — never allocation %s or derived quantities. Reuse this component for any new consumer rather than re-deriving inline.
- **Live broadcast:** `saveMaster`/`resetMaster` (`data/QuotePresets.js`) dispatch `MASTER_EVENT` (`"quoteMasterChanged"`). Anything that needs to react to Proposal Master changes should listen for it rather than poll or cache.

## Resolved
- ✅ Protected routes — `ProtectedRoute` (`routes/ProtectedRoute.jsx`) guards all app routes; unauthenticated visits redirect to login and remember the intended URL
- ✅ Error boundary — `components/ErrorBoundary.jsx` wraps the app with a recoverable fallback
- ✅ 404 handling — catch-all route renders `pages/NotFound.jsx` in-shell (inside the authenticated layout)
