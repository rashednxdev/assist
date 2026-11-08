# iBAS++ / ProAssist — Project Guide

> **Prefer the single sequential file:** **[DEVELOPER_HANDBOOK.md](./DEVELOPER_HANDBOOK.md)** (this guide + gaps + user options + conventions in developer order).

Master reference for how this monorepo is structured today, who uses what, how features hang together, and how to grow the product without breaking the pattern.

Related docs:

| Doc | Topic |
|-----|--------|
| [GAPS_AND_ROADMAP.md](./GAPS_AND_ROADMAP.md) | UX gaps, SMS login, secure reset, LMS undelivered items |
| [USER_OPTIONS_AND_OPPORTUNITIES.md](./USER_OPTIONS_AND_OPPORTUNITIES.md) | PM presentation: user options & where to offer more |
| [PERMISSIONS.md](./PERMISSIONS.md) | Account / module / workflow access |
| [API_CONVENTIONS.md](./API_CONVENTIONS.md) | REST envelope, pagination, errors |
| [I18N_CONVENTION.md](./I18N_CONVENTION.md) | UI English vs bilingual content |
| [DENORMALIZATION.md](./DENORMALIZATION.md) | Mongo shape & indexes |
| [render-deploy.md](./render-deploy.md) | Deploy notes |
| [ADMIN_DATA_ENTRY_MANUAL.md](./ADMIN_DATA_ENTRY_MANUAL.md) | Content entry |
| [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) | Original phased plan (incl. Module J) |

---

## 1. Product snapshot

| Item | Value |
|------|--------|
| Workspace name | `ibas-plus` (folder often called `proAssist` / `assist`) |
| Product | **iBAS++** — learning, office tools, salary/pension calculators, community |
| Clients | **Web** (Next.js), **Mobile** (Expo), **API** (Express) |
| Database | MongoDB (Mongoose) |
| Contracts | Zod in `@ibas/shared-types` + enums in `@ibas/shared-constants` |
| Package manager | pnpm 9 + Turborepo |
| Node | ≥ 20 |

**Mental model**

```
[Expo mobile] ──┐
[Next.js web] ──┼──► API (/api/v1/…) ──► domains ──► MongoDB
                │         ▲
                └─────────┴── shared-types + shared-constants
```

Web browsers call the API through a **BFF proxy** (`/api/proxy/[...path]`) so cookies stay same-origin. Mobile calls the API directly with a bearer token.

---

## 2. Repository layout

```
assist/
├── apps/
│   ├── api/                 # @ibas/api — Express 5 REST
│   ├── web/                 # @ibas/web — Next.js 15 App Router
│   └── mobile/              # @ibas/mobile — Expo 57 + expo-router
├── packages/
│   ├── shared-constants/    # enums, module codes, locales
│   └── shared-types/        # Zod schemas + calculators (salary, pension…)
├── docs/                    # this guide + conventions
├── package.json             # pnpm scripts + turbo
├── pnpm-workspace.yaml
├── turbo.json
└── tsconfig.base.json
```

### Why this split

| Layer | Owns | Does not own |
|-------|------|----------------|
| **apps/api** | HTTP, auth middleware, persistence, side effects | UI copy, React |
| **apps/web** | Admin + salary/learner UI, BFF proxy | Business rules duplicated from types |
| **apps/mobile** | Primary officer/learner app | Admin-heavy CRUD (limited) |
| **shared-constants** | Stable string codes / enums | Runtime logic |
| **shared-types** | Zod DTOs + pure calc engines | DB connections |

**Rule for future projects:** put *shared truth* (codes, validation, pure math) in packages; put *I/O* in apps; never import an app from another app.

---

## 3. Apps in detail

### 3.1 API — `apps/api`

| Concern | Location |
|---------|----------|
| Boot | `src/server.ts` → `createApp()` in `src/app.ts` |
| Config / env | `src/config/` |
| Domains | `src/domains/<name>/` |
| Middleware | `src/middleware/auth.ts`, `requireModuleAccess.ts`, … |
| Shared helpers | `src/shared/errors`, pagination, audit |
| Seed / migrations | `scripts/seed/`, `scripts/migrations/` |
| Default port | **3001** |

**Domain folder convention (current):**

```
domains/<name>/
  models/           # Mongoose schemas (collection name as 3rd arg)
  *.service.ts      # Business logic + transactions
  *.controller.ts   # HTTP handlers
  *.routes.ts       # Express router
```

Mount all routers from `app.ts` under `/api/v1/...`.

### 3.2 Web — `apps/web`

| Concern | Location |
|---------|----------|
| Routes | `app/` (App Router; flat feature folders) |
| Shell / nav | `components/layout/` + `nav-config.ts` |
| UI kit | `components/ui/` (ShadCN-style) |
| Feature UI | `components/<feature>/`, `app/<feature>/` |
| Client API | `lib/` + BFF `app/api/proxy/[...path]/route.ts` |
| Messages | `messages/en.json` (+ bn where used) |
| Default port | **3000** |

**Presentation layers**

1. **Public / auth** — `/login`, `/register`, `/register/verify`, `/set-password`
2. **User surface** — dashboard, salary, packages, community, learning (when enabled)
3. **Admin surface** — `/admin/*`, content CRUD, users, packages, salary-access
4. **Print / PDF** — salary TR forms, arrears bills (jsPDF / print CSS)

Nav visibility is **capability-driven** (`lib/capabilities.ts` → `buildVisibleNav`), not a hard-coded role menu alone.

**Temporary product gate:** `WEB_USERS_SALARY_ONLY` in `lib/salary-only.ts` can force ordinary users onto `/salary` only while admins keep full nav.

### 3.3 Mobile — `apps/mobile`

| Concern | Location |
|---------|----------|
| Entry | `index.js` → `app/_layout.tsx` |
| Auth routes | `app/(auth)/` — login, register, forgot/reset password |
| App routes | `app/(app)/` — home, modules, calculators, community |
| Feature libs | `src/lib/` (e.g. `salary-i18n.ts`, auth context) |
| Theme | `src/theme/` |

Home tiles in `app/(app)/home.tsx` group **services**, **office tools**, and **exam** modules.

---

## 4. Shared packages

### 4.1 `@ibas/shared-constants`

Single barrel (`packages/shared-constants/index.ts`). Notable groups:

- **Users:** `USER_TYPES`, `USER_STATUSES`, `WORKFLOW_ROLE_CODES`
- **Modules:** `MODULE_CODES`, free / exam-prep / basic module sets, `ACCESS_PACKAGE_KINDS`
- **Locales:** `DEFAULT_LOCALE`, `SUPPORTED_LOCALES` (`en` | `bn`)
- **Domain enums:** questions, books, workflow, policy, toolkit, circulars, iBAS areas, smart tools

### 4.2 `@ibas/shared-types`

Zod schemas + inferred types + **pure calculators** (no DB):

| Area | Files (examples) |
|------|------------------|
| Auth / users | `auth.ts`, `users.ts` |
| Learning | `books.ts`, `questions.ts`, `exams.ts`, `papers.ts`, `syllabus.ts`, `evaluation.ts` |
| Billing | `billing.ts`, `subscription.ts` (legacy) |
| Salary | `salary-2026.ts`, `salary-access.ts` |
| Pension / joining | `pension*.ts`, `joining-period*.ts` |
| Office tools | `policy.ts`, `toolkit.ts`, `org.ts`, `contacts.ts` |
| Community | `community.ts`, `blood-bank.ts` |

**Build order:** `shared-constants` → `shared-types` → apps (`pnpm build:packages`).

---

## 5. API domains (feature map)

Mounted under `/api/v1` (see `apps/api/src/app.ts`):

| Domain | Prefix (typical) | Responsibility |
|--------|------------------|----------------|
| health | `/health` | Liveness |
| auth | `/auth` | Login, register, OTP, tokens, `/me` |
| users | `/users` | User CRUD, module grants, recovery |
| account | `/account` | Own profile, summary, legacy plans |
| setup | `/setup` | Platform modules, BD geography |
| workflow | `/workflow` | Guided tasks, runs, inbox, audit |
| books | `/books` | Rule library / regulations tree |
| questions | `/questions` | Question bank, marathon, PDFs |
| exams / syllabus / papers | `/exams`, `/syllabus`, `/papers` | Exam hierarchy & content |
| evaluation | `/evaluation` | Attempts, progress, ratings |
| qotd / exam-routine / exam-prep | respective | Daily Q, calendars, packaging |
| user-questions | `/user-questions` | Learner-submitted questions |
| pension / joining-period | respective | Calculators + leave types |
| salary | `/salary` | 2026 fixation, offices, staff, bill access |
| billing | `/billing` | Packages, payments, entitlements |
| live-stream | `/live-streams` | Agora / Zoom classes |
| policy / circulars / ibas / search | respective | Policy library & search |
| toolkit | `/toolkit` | Checklists / templates / guides |
| schedule | `/schedule` | Official/personal calendar |
| org / contacts | respective | Offices, designations, directory |
| community | `/community` | Threads, answers, votes |
| blood-bank | `/blood-bank` | Donors, requests, donations |
| deductions | `/deductions` | VAT/IT/tax reference tables |
| terms / app-settings | respective | Legal text, global settings |
| notifications | admin + device | Broadcasts, Expo push |
| admin-overview / content-cache | `/admin/…` | Metrics, cache tools |

---

## 6. Users, admins, and access

### 6.1 User types

| Type | Typical use |
|------|-------------|
| `system_admin` | Full platform (with `is_super_admin`) |
| `admin` | Platform admin; scoped by module grants |
| `officer` | Cadre/office user; workflow + granted modules |
| `applicant` | Default self-registration type |

Statuses: `active` | `inactive` | `suspended` | `pending_verify`.

### 6.2 Three access layers

Documented fully in [PERMISSIONS.md](./PERMISSIONS.md):

1. **Account gate** — status, verification, credentials  
2. **Platform** — `user_type`, `is_super_admin`, `user_module_access` (CRUD / grade / publish flags)  
3. **Workflow tags** — optional `workflow_roles[]` (`SDO`, `DDO`, `AO`, `FD`, `ADMIN`, `SYSTEM`)

Plus **package entitlements** from billing (`UserEntitlement`, source `package`) for learning modules.

### 6.3 Who sees what (presentation)

| Audience | Web | Mobile |
|----------|-----|--------|
| Super / platform admin | Full `/admin/*`, content, users, packages, salary-access | Limited admin (users, notifications, …) |
| Ordinary learner / officer | Dashboard or salary-only gate; packages; community | Full module tiles when entitled |
| Salary-focused user | `/salary` primary under salary-only flag | Salary + salary-access screens |
| Unauthenticated | Login / register | Auth group only |

Registration consent (current product copy) is a checkbox about downloading office bill forms — not a terms-page link.

---

## 7. Major product features (process overview)

### 7.1 Salary On 2026

| Piece | Where |
|-------|--------|
| Pure engine | `packages/shared-types/src/salary-2026.ts` |
| Bill access rules | `salary-access.ts` + API `domains/salary` |
| Web UI | `app/salary/`, `components/salary/*`, TR Form print |
| Mobile UI | `app/(app)/salary/`, `SalaryArrearsCard`, TR PDF |
| Admin | `/admin/salary-access` — office free calcs / bills |

**Process (arrears):** choose grade/basic → optional exceptional issues (increment exempt, promotion/higher scale, custom start) → select months / bill duration → calculate → download TR Form 13/15 (consumes approved bill when required).

**Promotion / higher scale rules (current):**

- Target grade must be an **upper** grade of the previous grade (lower grade number).  
- Fixation Yes → choose NPS 2015 basic **≥ previous continuing basic**.  
- Fixation No → grade only; continuing drawn + entitlement calculated.

### 7.2 Learning loop

Books / questions / papers / exams → evaluation attempts → progress. Free modules (e.g. QOTD, exam routine) vs paid packages (`exam_prep`, `basic`, `live`).

### 7.3 Billing

| Kind | Opens |
|------|--------|
| `exam_prep` | Exam-prep module set |
| `basic` | Basic + iBAS area codes |
| `live` | Specific live-class packages |

Admin manages packages; learners buy via `/packages` or mobile `pricing`. Legacy `subscription` models still appear under `account`.

### 7.4 Office / policy workspace

Circulars, policy library, toolkit, schedule, contacts, org offices — module-gated under iBAS / policy codes.

### 7.5 Workflow

Configurable guided processes: task definitions → runs → step responses → inbox. Workflow roles tag users for step assignment.

### 7.6 Community & blood bank

Q&A threads; separate blood-bank donor/request flows (often highlighted in UI with strong red accents).

### 7.7 Pension / joining / deductions

Client-side heavy calculators with shared-types math; API for leave types / persistence where needed.

### 7.8 Live class

Agora / Zoom integration under `live-stream` domain; web and mobile viewers.

---

## 8. Presentation architecture

### 8.1 Web navigation groups (conceptual)

From `nav-config.ts` + `buildVisibleNav`:

1. Overview / dashboard  
2. iBAS++ & policy  
3. Learning  
4. Guided processes  
5. Static references / calculators  
6. Account  
7. Workflow admin  
8. Content admin  
9. Administration (users, setup, packages, salary-access, …)

### 8.2 Mobile home composition

Tile groups on `home.tsx`: services (salary, pension, …), office tools (ibas, circulars, contacts), exam modules (books, QOTD, papers, …).

### 8.3 UI patterns to reuse

- **Capability-first nav** — hide what the user cannot do.  
- **Shared calc + thin UI** — salary/pension math in packages; screens only gather inputs.  
- **Print surfaces** — separate print CSS / PDF builders from interactive screens.  
- **Locale** — shell English; bilingual `_en`/`_bn` fields for CMS content; salary/calc local toggles.

---

## 9. Data & process conventions

1. **Validate at the edge** with Zod from shared-types.  
2. **Persist in domain services**; controllers stay thin.  
3. **Soft-delete** where content is reusable (`is_active` / `trashed_at` patterns).  
4. **Indexes** via `pnpm migrate:indexes` (see DENORMALIZATION.md).  
5. **English error `message`** in API envelopes.  
6. **Response shape:** `{ data, meta? }` / `{ error: { code, message } }`.

Typical request flow:

```
Client → (web proxy?) → authenticate → requireModuleAccess?
      → controller → service → model → MongoDB
      → Zod-shaped DTO out
```

---

## 10. Local development

```bash
pnpm install
# copy apps/api/.env and apps/web/.env.local from examples
pnpm build:packages
pnpm seed
pnpm migrate:indexes
pnpm dev                 # API + web
pnpm dev:mobile          # Expo
```

| URL | Service |
|-----|---------|
| http://localhost:3000 | Web |
| http://localhost:3001 | API |
| http://localhost:3001/api/v1/health | Health |

Seed admin (after seed): `admin@ibas.gov.bd` / `Admin@123456`.

---

## 11. How to add a new feature (checklist)

Use this when extending this repo or mirroring the structure elsewhere.

1. **Constants** — add module / enum codes in `shared-constants` if needed.  
2. **Types** — Zod DTO + any pure logic in `shared-types`; build packages.  
3. **API domain** — `models` → `service` → `controller` → `routes`; mount in `app.ts`.  
4. **Authz** — wire `requireModuleAccess` / grants; update PERMISSIONS if rules change.  
5. **Web** — page under `app/`, components, nav entry in `nav-config` + capabilities.  
6. **Mobile** — route under `(app)/`, home tile if primary.  
7. **i18n** — bilingual content fields; English UI strings (or feature-local copy).  
8. **Seed / migrate** — indexes or bootstrap data scripts.  
9. **Typecheck** — `pnpm --filter @ibas/shared-types build` then web/api typecheck.

---

## 12. Known gaps (summary — documentation only)

Full detail for **build later** (not deploying now): **[GAPS_AND_ROADMAP.md](./GAPS_AND_ROADMAP.md)** — includes SMS login confirm, secure reset, LMS undelivered items, Module J, and **prerequisites/drawbacks** easy to miss (SMS cost, JWT revoke, applicant vs candidate collision, etc.).

| Area | Highest-impact gaps |
|------|---------------------|
| **Auth** | No SMS login confirmation; password reset email-only + **web UI missing**; register OTP stubbed; long-lived JWTs |
| **Learning** | Exam-prep stack, not full LMS — no courses/enrollment, certificates, instructor grading, Module J candidate portal; timed exam web parity missing; saved/history not synced |
| **UX** | Lock reasons unclear; salary-only web vs full mobile; orphaned verify page |

Waves (when you choose to build): **A** trust → **B** SMS → **C** learning UX → **D** LMS-shaped / Module J → **E** niceties.

## 13. Lessons for a future “more structural” project

Patterns that aged well here:

| Do | Why |
|----|-----|
| Monorepo with **shared contracts first** | Web/mobile/API stay in sync |
| Name API folders **`domains/`** not `modules/` | Avoids clash with Mongo “modules” collection |
| Keep **calculators pure** in packages | Testable; identical results on all clients |
| **Capability-based UI** | Safer than role-only menus |
| One **BFF proxy** for browser cookies | Simpler CSRF/cookie story |
| Document **permissions, API, i18n** early | Onboarding cost drops |

Gaps / caution for a greenfield rebuild:

| Watch | Note |
|-------|------|
| Temporary flags (`WEB_USERS_SALARY_ONLY`) | Document expiry; don’t leave forever |
| Legacy subscription vs billing entitlements | Prefer one commerce model |
| Doc drift | Keep this guide updated when domains mount change |
| Web vs mobile feature parity | Decide explicitly per module |

---

## 14. Quick index of important paths

```
apps/api/src/app.ts                          # domain mounts
apps/api/src/middleware/auth.ts              # JWT
apps/web/components/layout/nav-config.ts     # nav definitions
apps/web/lib/capabilities.ts                 # who sees what
apps/web/lib/salary-only.ts                  # salary-only gate
apps/mobile/app/(app)/home.tsx               # mobile hub
packages/shared-constants/index.ts           # codes
packages/shared-types/src/index.ts           # schema barrel
packages/shared-types/src/salary-2026.ts     # salary engine
docs/PERMISSIONS.md                          # RBAC detail
```

---

*Last aligned with gaps roadmap (auth SMS / LMS undelivered). When you add a domain, update §5 and §14; when a wave ships, update [GAPS_AND_ROADMAP.md](./GAPS_AND_ROADMAP.md).*
