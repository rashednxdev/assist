# iBAS++ / ProAssist — Developer Handbook

**Single sequential reference for developers.**  
Merges architecture, conventions, product context, gaps, and build-later specs that previously lived in separate docs.

| | |
|--|--|
| **Deploy auth/LMS gaps now?** | **No** — Part IX is planning only until a wave is chosen |
| **Stack** | pnpm · Turborepo · Express 5 · MongoDB · Next.js 15 · Expo 57 |
| **Node** | ≥ 20 |

**Reading order (developers):** Part I → II → III → IV → V → VI → **VI-A (Learning step-by-step)** → VII → VIII → IX (later work) → X → XI → XII.

Sources consolidated: `PROJECT_GUIDE`, `GAPS_AND_ROADMAP`, `USER_OPTIONS_AND_OPPORTUNITIES`, plus summaries of `PERMISSIONS`, `API_CONVENTIONS`, `I18N_CONVENTION`. Deeper admin content entry remains in `ADMIN_DATA_ENTRY_MANUAL.md`; original phase checklists in `IMPLEMENTATION_PLAN.md`; deploy notes in `render-deploy.md`.

---

# Part I — Local setup

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
| http://localhost:3000 | Web (`@ibas/web`) |
| http://localhost:3001 | API (`@ibas/api`) |
| http://localhost:3001/api/v1/health | Health |

Seed admin: `admin@ibas.gov.bd` / `Admin@123456`.

**Build order always:** `shared-constants` → `shared-types` → apps (`pnpm build:packages`).

---

# Part II — Architecture

## II.1 Mental model

```
[Expo mobile] ──┐
[Next.js web] ──┼──► API (/api/v1/…) ──► domains ──► MongoDB
                │         ▲
                └─────────┴── shared-types + shared-constants
```

- Web → BFF `apps/web/app/api/proxy/[...path]` → Express (same-origin cookies).  
- Mobile → API directly with bearer token.

## II.2 Repository layout

```
assist/
├── apps/
│   ├── api/                 # Express 5 REST
│   ├── web/                 # Next.js 15 App Router
│   └── mobile/              # Expo 57 + expo-router
├── packages/
│   ├── shared-constants/    # enums, module codes, locales
│   └── shared-types/        # Zod + pure calculators
├── docs/
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
└── tsconfig.base.json
```

| Layer | Owns | Does not own |
|-------|------|----------------|
| `apps/api` | HTTP, authz, persistence, side effects | React UI |
| `apps/web` | Admin + user UI, BFF | Duplicate business math |
| `apps/mobile` | Primary officer/learner app | Heavy admin CRUD |
| `shared-constants` | Codes / enums | Runtime logic |
| `shared-types` | Zod DTOs + pure calc | DB connections |

**Rule:** shared truth in packages; I/O in apps; never import one app from another.

## II.3 API app (`apps/api`)

| Concern | Path |
|---------|------|
| Boot | `src/server.ts` → `createApp()` in `src/app.ts` |
| Config | `src/config/` |
| Domains | `src/domains/<name>/` |
| Middleware | `src/middleware/auth.ts`, `requireModuleAccess.ts` |
| Shared | `src/shared/errors`, pagination, audit, mailer |
| Seed / migrate | `scripts/seed/`, `scripts/migrations/` |
| Port | **3001** |

Domain shape:

```
domains/<name>/
  models/
  *.service.ts
  *.controller.ts
  *.routes.ts
```

Mount routers in `app.ts` under `/api/v1/...`.  
Folder name is **`domains/`** (not `modules/`) to avoid clash with Mongo collection `modules`.

## II.4 Web app (`apps/web`)

| Concern | Path |
|---------|------|
| Routes | `app/` |
| Nav | `components/layout/nav-config.ts` + `lib/capabilities.ts` |
| UI | `components/ui/`, feature folders |
| BFF | `app/api/proxy/[...path]/route.ts` |
| Messages | `messages/en.json` |
| Port | **3000** |

Surfaces: auth → user → admin `/admin/*` → print/PDF.  
Temporary gate: `WEB_USERS_SALARY_ONLY` in `lib/salary-only.ts`.

## II.5 Mobile app (`apps/mobile`)

| Concern | Path |
|---------|------|
| Root | `app/_layout.tsx` |
| Auth | `app/(auth)/` |
| App | `app/(app)/` — home tiles in `home.tsx` |
| Libs | `src/lib/` |
| Theme | `src/theme/` |

## II.6 Shared packages

**`@ibas/shared-constants`** — `USER_TYPES`, `USER_STATUSES`, `WORKFLOW_ROLE_CODES`, `MODULE_CODES`, free/exam-prep/basic sets, `ACCESS_PACKAGE_KINDS`, `SUPPORTED_LOCALES` (`en`|`bn`), domain enums.

**`@ibas/shared-types`** — Zod + calculators, e.g. `auth.ts`, `users.ts`, `books.ts`, `questions.ts`, `salary-2026.ts`, `salary-access.ts`, `billing.ts`, `pension*.ts`, `community.ts`, `blood-bank.ts`.

---

# Part III — API conventions

Base: `/api/v1/{domain}/{resource}`

**Success**

```json
{ "data": {}, "meta": { "page": 1, "limit": 20, "total": 142 } }
```

**Error** (English `message`)

```json
{ "error": { "code": "FORBIDDEN", "message": "…" } }
```

Pagination: `?page=1&limit=20&sort=-created_at&status=active&locale=bn`  
Soft delete: set `is_active: false` (or domain-specific `trashed_at`).  
Content fields often expose `_en` / `_bn` plus computed `display_name`.

---

# Part IV — Permissions (RBAC)

Evaluate top → bottom; first denial wins (except documented super-admin bypass).

```
1. Account gate     → status, is_verified, credentials.status
2. Platform layer   → user_type, is_super_admin, user_module_access
3. Workflow layer   → users.workflow_roles[] (optional)
+ Package entitlements (billing UserEntitlement) for learning modules
```

### User types

| Type | Typical use |
|------|-------------|
| `system_admin` | Full platform (+ `is_super_admin`) |
| `admin` | Module-scoped CRUD via grants |
| `officer` | Workflow + granted modules |
| `applicant` | Default self-register (also salary users — dual purpose) |

Statuses: `active` | `inactive` | `suspended` | `pending_verify`.

### `user_module_access` flags

`can_read` | `can_create` | `can_update` | `can_delete` | `can_grade` | `can_publish` (+ optional `expires_at`, `task_restrictions`).

### Workflow role codes

`SDO`, `DDO`, `AO`, `FD`, `ADMIN`, `SYSTEM` — tags on profile; inbox eligibility by role + step.

### Who sees what

| Audience | Web | Mobile |
|----------|-----|--------|
| Platform admin | Full `/admin/*` | Limited admin tools |
| Ordinary user | Dashboard or salary-only | Full entitled tiles |
| Unauthenticated | Login / register | `(auth)` only |

Full matrix: historical detail still in `PERMISSIONS.md` if needed.

---

# Part V — i18n

| Layer | Language |
|-------|----------|
| Application UI | English primary (`messages/en.json`; salary/calc may toggle locally) |
| CMS / content fields | `_en` required pattern + optional `_bn` |

Do not put database content into locale JSON files.

---

# Part VI — Domains & features

## VI.1 Domain map (`/api/v1`)

| Domain | Responsibility |
|--------|----------------|
| health | Liveness |
| auth | Login, tokens, device bind |
| users | CRUD, grants, recovery |
| account | Profile, verify stubs, password reset API |
| setup | Modules, geography |
| workflow | Tasks, runs, inbox, audit |
| books / questions / exams / syllabus / papers | Learning content |
| evaluation | Self-eval, paper attempts, progress |
| qotd / exam-routine / exam-prep / user-questions | Daily / calendar / scope / submissions |
| salary | 2026 fixation, staff, bill access |
| billing | Packages, payments, entitlements |
| pension / joining-period / deductions | Calculators / refs |
| policy / circulars / ibas / search / toolkit / schedule | Office tools |
| org / contacts | Offices, directory |
| community / blood-bank | Q&A, donors |
| live-stream | Agora / Zoom |
| terms / app-settings / notifications | Legal, flags, push |
| admin-overview / content-cache | Metrics, cache |

## VI.2 Salary On 2026

| Piece | Path |
|-------|------|
| Engine | `packages/shared-types/src/salary-2026.ts` |
| Access | `salary-access.ts` + `domains/salary` |
| Web | `app/salary/`, `components/salary/*` |
| Mobile | `(app)/salary/`, TR PDF |
| Admin | `/admin/salary-access` |

**Arrears flow:** grade/basic → exceptional (increment exempt, promotion/higher scale, custom start) → months/duration → calculate → TR 13/15.

**Promotion / higher scale (current rules):**

- New grade must be **upper** (lower grade number) than previous.  
- Fixation **Yes** → NPS 2015 basic ≥ previous continuing basic.  
- Fixation **No** → grade only; continuing drawn + entitlement auto-calculated.

## VI.3 Learning (exam-prep, not full LMS)

```
Books ↔ Questions ↔ Exams/Syllabus ↔ Papers → evaluation → Progress
(+ QOTD, marathon, exam-week, exam-routine, user-questions)
```

Access = grants + packages (`exam_prep` / `basic` / `live`), not course enrollment.  
Timed MCQ paper UI: **mobile yes**, web no (yet). Saved/history: **device-local** on mobile.

**Full step-by-step presentation for how Learning serves users:** → **Part VI-A** below.

## VI.4 Billing packages

| Kind | Opens |
|------|--------|
| `exam_prep` | Learning module set |
| `basic` | Basic + iBAS areas |
| `live` | Specific live classes |

## VI.5 Other pillars

- **Office:** circulars, policy, toolkit, schedule, contacts, workflow.  
- **Community / blood bank.**  
- **Pension / joining / deductions** calculators.  
- **Live class** Agora/Zoom.

---

# Part VI-A — Learning module presentation: what it serves & step-by-step processes

**Purpose of this part:** Explain to developers (and for stakeholder demos) **what the Learning stack serves**, then **how every process runs for users — step by step**.  

**Important:** This product’s learning stack is an **exam-prep / rule-library**, not a university LMS (no course enrollment model today). Users still experience a clear journey: get access → choose exam part → study rules → practice questions → sit papers → see progress.

| Role in this part | Who |
|-------------------|-----|
| **Learner** | Officer / applicant with learning entitlement |
| **Content admin** | Admin with BOOKS / QUESTIONS / EXAM / PAPER (etc.) grants |
| **Access admin** | Grants modules or sells packages |
| **System** | API + evaluation + entitlements |

**Surfaces:** Mobile `(app)/` (primary learner) · Web learning routes · Web admin content · API domains listed in Part VI.

---

## VI-A.1 What Learning serves (value map)

| Service to the user | What they get | Main modules |
|---------------------|---------------|--------------|
| **Access** | Permission to open learning features | Packages (`exam_prep`…) + `user_module_access` + free modules |
| **Exam framing** | Know which exam / part / subject they prepare for | `exams`, `exam-prep` |
| **Rules & law** | Read books, chapters, regulations | `books` |
| **Syllabus map** | See what topics/books map to a subject | `syllabus` |
| **Question practice** | Study MCQ / descriptive items, marathon filters | `questions` |
| **Daily habit** | One (or set) curated question per day | `qotd` (often **free**) |
| **Calendar** | Know upcoming exam dates | `exam-routine` (often **free**) |
| **Model tests** | Sit practice/model papers (timed MCQ on mobile) | `papers`, `evaluation` |
| **Exam week** | Time-boxed published paper set | `exam-week` / papers publish |
| **Progress** | See what was attempted / scored | `evaluation` dashboard |
| **Ask / submit** | User-submitted questions (where enabled) | `user-questions` |
| **Offline (mobile)** | Sync questions for practice without network | questions sync → SQLite |
| **Live class (related)** | Attend entitled live session | `live-stream` + `live` package |

**Not served yet (see Part IX):** course enrollment, certificates, instructor grading inbox, Module J register→result portal, web timed exam parity, cloud bookmarks.

---

## VI-A.2 End-to-end learner journey (big picture)

```
0. Register / login
1. Get access (free modules and/or package / grant)
2. Open Exam-prep → pick Part (1 / 2 / …)
3. Optional: Exam routine (dates) + QOTD (daily)
4. Study: Books / Syllabus for subject
5. Practice: Questions (+ Marathon)
6. Test: Papers (timed MCQ on mobile) / Exam-week
7. Review: Progress (+ local saved/history on mobile)
8. Repeat 3–7 until exam
```

Each numbered block below is a **process** with ordered steps.

---

## VI-A.3 Process 0 — Enter the product

**Serves:** Identity so progress and entitlements attach to one user.  
**Start:** Not logged in. **End:** Session active; home or salary gate visible.

| Step | Actor | Action |
|------|-------|--------|
| 0.1 | User | Open **web** `/login` or **mobile** login |
| 0.2 | User | Enter email **or** BD mobile + password |
| 0.3 | System | Validate credentials; apply lockout if too many fails; bind mobile device if first/allowed |
| 0.4 | System | Issue JWT; web may set refresh cookie via BFF |
| 0.5 | User | Land on home / dashboard (or `/salary` if salary-only web gate) |
| 0.6 | User (mobile) | If password forgotten: Forgot password → email OTP → Reset password (web parity = later, Part IX) |

---

## VI-A.4 Process 1 — Get Learning access

**Serves:** Unlock menus (books, papers, …). Without this, tiles show locked / unpaid.

### 1A — Free modules (no purchase)

| Step | Actor | Action |
|------|-------|--------|
| 1A.1 | User | Open **QOTD** or **Exam routine** |
| 1A.2 | System | Treat module as free (`QOTD`, `EXAM_ROUTINE`, …) — allow read |
| 1A.3 | User | Use daily question or calendar without package |

### 1B — Buy / activate a package

| Step | Actor | Action |
|------|-------|--------|
| 1B.1 | User | Open **Packages** (web) or **Pricing** (mobile) |
| 1B.2 | User | Choose **Exam-prep** / **Basic** / **Live** SKU |
| 1B.3 | User | Complete payment flow (demo/live depending on env) |
| 1B.4 | System | Create `UserEntitlement` (source `package`) for module set |
| 1B.5 | User | **Log out and log in again** (or refresh session) so nav/tiles update |
| 1B.6 | User | Open exam-prep / books / papers — access allowed |

### 1C — Admin grant (institutional)

| Step | Actor | Action |
|------|-------|--------|
| 1C.1 | Access admin | Admin → Users → select user → module access |
| 1C.2 | Access admin | Enable `can_read` (and other flags) on BOOKS, QUESTIONS, EXAM, PAPER, … |
| 1C.3 | System | Store `user_module_access` row(s) |
| 1C.4 | Learner | Log out / log in → menus appear |

**Lock UX today:** If blocked, user may not see a clear “package vs grant” reason — improvement listed in Part IX.

---

## VI-A.5 Process 2 — Frame the exam (Exam-prep part)

**Serves:** Scope learning to Part-1 / Part-2 (etc.) so content filters match the candidate’s attempt.

| Step | Actor | Action |
|------|-------|--------|
| 2.1 | Learner | Open **Exam-prep** hub (mobile) or use part-scope layout (web) |
| 2.2 | Learner | Select **exam part** (e.g. Part 1 / Part 2) |
| 2.3 | System | Remember part scope for subsequent books/questions/papers queries |
| 2.4 | Learner | Proceed to subjects / books / papers under that part |

---

## VI-A.6 Process 3 — Know the calendar (Exam routine)

**Serves:** Awareness of exam dates (usually free).

| Step | Actor | Action |
|------|-------|--------|
| 3.1 | Learner | Open **Exam routine** |
| 3.2 | System | Load published routines / countdown |
| 3.3 | Learner | Note dates; plan study weeks |
| 3.4 | Content admin (prep) | Admin publishes / edits exam-routine entries (web) |

---

## VI-A.7 Process 4 — Daily habit (QOTD)

**Serves:** Low-friction daily practice (usually free).

| Step | Actor | Action |
|------|-------|--------|
| 4.1 | Content admin | Admin → QOTD → pick date → attach question(s) → save/publish |
| 4.2 | Learner | Open **QOTD** on due date |
| 4.3 | System | Return today’s curated question(s) |
| 4.4 | Learner | Read / answer / self-check per UI |
| 4.5 | System | May record evaluation / view state depending on client |
| 4.6 | Learner | Return next day (streak reminders = later, Part IX) |

---

## VI-A.8 Process 5 — Study rules (Books)

**Serves:** Authoritative text (acts, rules, chapters) before drilling questions.

### 5A — Content admin prepares books (once)

| Step | Actor | Action |
|------|-------|--------|
| 5A.1 | Admin | Create **book type** → **book** (`name_en` / `name_bn`) |
| 5A.2 | Admin | Add **chapters / topics / sub-topics** tree |
| 5A.3 | Admin | Add **regulations / amendments** as needed |
| 5A.4 | Admin | Link subjects / publish for learners |
| 5A.5 | Admin | Confirm learner can open book in web/mobile |

*(Detailed field-level admin jobs: `ADMIN_DATA_ENTRY_MANUAL.md`.)*

### 5B — Learner reads

| Step | Actor | Action |
|------|-------|--------|
| 5B.1 | Learner | Open **Books** (with access) |
| 5B.2 | Learner | Pick book → open chapter / topic |
| 5B.3 | Learner | Read regulation text; open linked chapter questions if offered |
| 5B.4 | Learner (mobile) | Optionally bookmark locally (**Saved** — device only today) |

---

## VI-A.9 Process 6 — Map the syllabus

**Serves:** “What to study for this subject” — links topics to books.

| Step | Actor | Action |
|------|-------|--------|
| 6.1 | Admin | Under exam **subject** → build syllabus groups → topics → sub-topics → book refs |
| 6.2 | Learner | Open **Exams** → subject → **Syllabus** |
| 6.3 | Learner | Follow topic → open linked book section |
| 6.4 | Learner | Jump to related questions / papers for that subject |

---

## VI-A.10 Process 7 — Practice questions

**Serves:** Drill bank items (MCQ / descriptive / differences).

### 7A — Admin publishes questions

| Step | Actor | Action |
|------|-------|--------|
| 7A.1 | Admin | Create question (body_en/bn, type, options, answer/explanation) |
| 7A.2 | Admin | Link to book chapter and/or exam subject |
| 7A.3 | Admin | QC / publish (needs `can_publish` where enforced) |
| 7A.4 | Admin | Optional: import / trash / similarity tools on web |

### 7B — Learner practices

| Step | Actor | Action |
|------|-------|--------|
| 7B.1 | Learner | Open **Questions** (entitled) |
| 7B.2 | Learner | Filter by subject / book / type as UI allows |
| 7B.3 | Learner | Open item → attempt answer |
| 7B.4 | System | For MCQ: may show correctness; for descriptive: self-rate |
| 7B.5 | System | Upsert `UserQuestionEvaluation` (progress index / rating) |
| 7B.6 | Learner | Continue next item |

### 7C — Marathon (filtered review)

| Step | Actor | Action |
|------|-------|--------|
| 7C.1 | Learner | Open **Marathon** |
| 7C.2 | Learner | Choose filters (e.g. weak / unanswered — per UI) |
| 7C.3 | System | `GET` marathon-review style list |
| 7C.4 | Learner | Rapid practice loop → evaluations update |

### 7D — Offline sync (mobile)

| Step | Actor | Action |
|------|-------|--------|
| 7D.1 | Learner | Trigger sync (or auto on enter) while online |
| 7D.2 | System | `/questions/sync` → store in SQLite |
| 7D.3 | Learner | Practice offline; sync/eval rules per client implementation |

---

## VI-A.11 Process 8 — Sit a paper (model / practice test)

**Serves:** Exam-like attempt with duration (especially mobile MCQ).

### 8A — Admin composes paper

| Step | Actor | Action |
|------|-------|--------|
| 8A.1 | Admin | Create paper under exam subject (title, duration_minutes, type) |
| 8A.2 | Admin | Add groups / attach **published** questions |
| 8A.3 | Admin | Publish paper (and/or include in **exam-week**) |
| 8A.4 | System | Paper visible to entitled learners |

### 8B — Learner takes paper (mobile timed MCQ — current primary)

| Step | Actor | Action |
|------|-------|--------|
| 8B.1 | Learner | Open **Papers** → select paper |
| 8B.2 | Learner | Start exam → timer uses `duration_minutes` |
| 8B.3 | Learner | Answer MCQs; navigate items |
| 8B.4 | Learner | Submit (or auto-submit on timeout — per UI) |
| 8B.5 | System | Create / append **PaperAttempt** history; score MCQ |
| 8B.6 | Learner | View result summary; may retake (history log) |

### 8C — Learner on web (today)

| Step | Actor | Action |
|------|-------|--------|
| 8C.1 | Learner | Browse paper / per-question evaluator (not full countdown exam UI) |
| 8C.2 | Note | **Web timed parity = Part IX Wave C** |

### 8D — Exam-week pack

| Step | Actor | Action |
|------|-------|--------|
| 8D.1 | Admin | Publish papers into an exam-week window |
| 8D.2 | Learner | Open **Exam-week** → see this week’s set |
| 8D.3 | Learner | Sit each paper via Process 8B |
| 8D.4 | Learner | Review progress after the week |

---

## VI-A.12 Process 9 — See progress

**Serves:** Motivation and “what’s left”.

| Step | Actor | Action |
|------|-------|--------|
| 9.1 | Learner | Open **Progress** |
| 9.2 | System | `GET /evaluation/dashboard` — MCQ stats, paper attempt rollups |
| 9.3 | Learner | Optionally open book/paper progress trees (web/mobile) |
| 9.4 | Learner | Decide next action (QOTD / weak marathon / next paper) |
| 9.5 | Gap | No forced “Continue paper X” coach yet — Part IX Wave C |

### Mobile-only local loops

| Step | Actor | Action |
|------|-------|--------|
| 9M.1 | Learner | **Saved** — bookmarks stay on device |
| 9M.2 | Learner | **History** — answer-read history in SQLite |
| 9M.3 | Gap | Not restored on new phone until server sync (Part IX) |

---

## VI-A.13 Process 10 — User-submitted questions (optional)

**Serves:** Learner asks / contributes items outside the bank.

| Step | Actor | Action |
|------|-------|--------|
| 10.1 | Learner | Open **User questions** (if entitled) |
| 10.2 | Learner | Submit question text |
| 10.3 | Admin | Review / moderate / respond per product rules |
| 10.4 | Learner | See status / answer when available |

---

## VI-A.14 Process 11 — Live class (adjacent to Learning)

**Serves:** Instructor-led session when `live` package / entitlement allows.

| Step | Actor | Action |
|------|-------|--------|
| 11.1 | Admin | Create live stream (Agora/Zoom config) |
| 11.2 | Learner | Entitlement check → open **Live** |
| 11.3 | Learner | Join session |
| 11.4 | Gap | Attendance certificate = later |

---

## VI-A.15 Content pipeline (admin) — order that serves learners

Greenfield order so learner processes above have data:

| Order | Admin job | Unlocks learner process |
|-------|-----------|-------------------------|
| 1 | Users + module grants / packages | Process 1 |
| 2 | Exams hierarchy (dept → … → subject) | Processes 2, 6, 8 |
| 3 | Books tree | Process 5 |
| 4 | Questions published + linked | Processes 7, 8 |
| 5 | Syllabus for subject | Process 6 |
| 6 | Papers composed + published | Process 8 |
| 7 | QOTD / exam-routine / exam-week | Processes 3, 4, 8D |

---

## VI-A.16 Sequence diagram (learner happy path)

```
Learner          Web/Mobile           API                DB
   |                 |                 |                  |
   |-- login ------->|-- POST /auth/login --------------->|
   |<-- token -------|<-----------------------------------|
   |-- open pricing->|-- billing / entitlements --------->|
   |<-- unlocked ----|<-----------------------------------|
   |-- set part ---->|-- exam-prep scope ---------------->|
   |-- QOTD -------->|-- GET qotd today ----------------->|
   |-- books ------->|-- GET books/tree ----------------->|
   |-- questions --->|-- GET + POST evaluation ---------->|
   |-- start paper ->|-- POST paper attempt (mobile) ---->|
   |-- submit ------->|-- score + store attempt --------->|
   |-- progress ---->|-- GET evaluation/dashboard ------->|
   |<-- stats -------|<-----------------------------------|
```

---

## VI-A.17 Presentation cheat-sheet (one slide)

**What we serve:** Access → Exam frame → Study (books/syllabus) → Practice (questions/QOTD/marathon) → Test (papers/exam-week) → Progress.  

**How it serves:** Step-gated by **entitlement**; content prepared by **admins** in Books→Questions→Exams→Syllabus→Papers order; learners loop daily (QOTD) and weekly (exam-week).  

**Honest limit:** Exam-prep platform, **not** full LMS — certificates, enrollment paths, Module J portal, and web timed exam are **documented for later** (Part IX), not current deploy.

---

# Part VII — Presentation (UI)

### Web nav groups (capability-filtered)

Overview → iBAS/policy → Learning → Guided processes → Calculators → Account → Workflow admin → Content admin → Administration.

### Mobile home

Services (salary, pension, …) · Office tools · Exam modules · Blood card · Pricing when relevant.

### Patterns

- Capability-first nav.  
- Pure calc in packages; thin forms in UI.  
- Separate print/PDF from interactive screens.  
- Register consent (current): Bangla office bill-download commitment (red); no terms link.

---

# Part VIII — Product context (what users can do / more options)

*For developers: know the job-to-be-done before coding. Full PM slides were in USER_OPTIONS; condensed here.*

### Segments

| Segment | Need |
|---------|------|
| Accounts / office staff | Salary TR / arrears |
| Exam candidates | Practice, papers, progress |
| Colleagues | Contacts, blood, community |
| Admins | Users, packages, content, salary-access |
| Live attendees | Classes |

### Already available (do not rebuild blindly)

Pay fixation & arrears · TR download · staff bills · pension/joining · books/QB/papers · QOTD/marathon/exam-week · progress · circulars/toolkit/schedule/contacts · community/blood · packages · mobile password reset · mobile device bind.

### High-value “more options” (map to Part IX waves)

| Offer | Segment | Wave |
|-------|---------|------|
| Web forgot password | All | A |
| SMS login confirmation | Salary/office | B |
| Secure SMS/email reset | All | A–B |
| “What to study today” | Learners | C |
| Timed exam on web | Learners | C |
| Bill / access alerts | Accounts | C-ish / salary |
| Sync bookmarks | Mobile users | C |
| Paths + certificates | Institutions | D |
| Module J candidate portal | Candidates | D |

**Commercial SKUs to explain in UI:** Free · Exam-prep · Basic · Live · admin grants · salary bill quotas.

---

# Part IX — Gaps & build-later (not deploying now)

> Planning only. Implement when a wave is explicitly chosen.

## IX.1 UX / efficiency gaps

| Gap | Later home |
|-----|------------|
| No web Forgot password | `apps/web` auth pages |
| Register auto-verify; orphaned verify page | `account` |
| Salary-only web vs full mobile | `salary-only.ts` policy |
| Timed exam mobile-only | `papers` web UI |
| Saved/history device-local | `learner-state` / `evaluation` |
| Catalog not “my path” | Guided exam-prep home |
| Unclear lock reason | Shared access-reason helper |
| Opaque TR/bill rules | Salary copy + admin help |
| No sign-out-all-devices | `account` + `token_version` |

## IX.2 Auth as-is

Password login · lockout 5/15m · mobile device bind (web ignored) · email OTP reset (mobile UI only) · register OTP **stubbed** · **no SMS** · **no login SMS confirm** · long-lived JWT · logout does not bump `token_version`.

## IX.3 Build later — SMS login confirmation

Password OK → SMS challenge → confirm → tokens.

| Step | Module |
|------|--------|
| OTP purposes | `shared-constants` |
| Challenge schemas | `shared-types` / `auth.ts` |
| SMS adapter + env | `apps/api` shared `sms/` |
| Hashed OTP store | Credentials |
| Challenge/confirm | `auth.service` |
| Flag | `app-settings` `login_sms_confirm_enabled` |
| UI | Web + mobile two-step login |

Rules: no production `demoCode`; rate limits; single-use; BD mobile primary.

## IX.4 Build later — secure password recovery

```
Request (phone OR email) → anti-enumeration response
→ OTP SMS and/or email (hashed, ~15 min)
→ OTP + new password → token_version++ → optional notify
```

Also: web forgot/reset UI; dedicated rate limits; keep admin temp-password as break-glass.

## IX.5 Auth backlog

| Item | P | Module |
|------|---|--------|
| Web reset UI | P0 | web |
| Real register verify | P0 | account |
| Strip demo OTP in prod | P0 | account |
| Short JWT + `/auth/refresh` | P0 | auth |
| Logout / sign-out-all bumps version | P0 | auth/account |
| OTP rate limits | P0 | middleware |
| Login SMS confirm | P1 | auth + SMS |
| SMS reset | P1 | account + SMS |
| Admin TOTP | P2 | auth |

## IX.6 LMS undelivered (map into modules later)

| Expectation | Home |
|-------------|------|
| Courses / enrollment / unlock | `learning-paths` or `exam-prep` |
| Instructor assignments + grade | `evaluation` / `assignments` (`can_grade`) |
| Certificates | `certificates` + PDF |
| Cohorts | exam-prep + contacts |
| Web timed exam | `papers` web |
| Server bookmarks/history | `learner-state` |
| Learning notifications | `notifications` |
| SCORM/xAPI | **Defer** unless required |
| Module J candidate | `domains/candidate` |
| Instructor analytics | `admin-overview` + evaluation |

**Learning efficiency first (Wave C):** guided home · web timed exam · sync saved/history · progress CTA · lock reason · optional QOTD reminder.

**Module J:** registration, schedule, results, appeals, fee via billing — caution: `applicant` dual use with salary.

## IX.7 Waves

```
A Trust (web reset, verify, JWT) ──► B SMS login/reset
                                   └─► C Learning UX ──► D Paths/certs/Module J ──► E Optional
```

C can parallel A/B with different owners.

## IX.8 Definition of done (when implementing)

**Password recovery:** web+mobile · OTP email/SMS hashed · rate limit · anti-enumeration · `token_version++` · no OTP in prod JSON.

**SMS login:** challenge without tokens · SMS/staging log · single-use confirm · admin flag.

**Learning efficiency:** web timed MCQ · guided next step · bookmarks survive reinstall.

## IX.9 Prerequisites & drawbacks (easy to miss)

| Area | Watch |
|------|--------|
| Infra | Env secrets · `OTP_DELIVERY=log\|email\|sms` · Redis for multi-instance rate limit · audit · server clock for OTP |
| SMS | BD gateway approval · cost · SIM swap · phone change re-verify · stick to `01[3-9]…` unless schema expands |
| Reset | Anti-enumeration · spam · placeholder emails already blocked · SMS if no email |
| Login SMS | Friction · delay · admin break-glass if SMS down · shared API before dual UI |
| JWT | Short access + refresh · decide web device bind policy |
| Learning | Paths need content · separate self-eval vs instructor grade · offline merge policy · access-reason helper |
| Other | Replace bKash demo OTP · learning push templates · E2E later |
| Non-goals | Full SCORM LMS · BB EFT · third-party payroll replacement |

## IX.10 Ownership when coding later

| Concern | Where |
|---------|--------|
| OTP purposes | `shared-constants` |
| Auth schemas | `shared-types` / `auth.ts` |
| SMS | `apps/api` `sms/` |
| Login/JWT/device | `domains/auth` |
| Register/verify/reset | `domains/account` |
| Mail | `shared/mailer.ts` |
| Flags | `domains/app-settings` |
| Web auth pages | `apps/web/app/...` |
| Mobile auth | `apps/mobile/app/(auth)` |
| Timed papers web | `apps/web` + papers/evaluation API |
| Paths / certs / candidate | new or extended domains |

---

# Part X — How to add a feature (checklist)

1. Codes in `shared-constants` if needed.  
2. Zod (+ pure logic) in `shared-types` → `pnpm build:packages`.  
3. API: `models` → `service` → `controller` → `routes` → mount in `app.ts`.  
4. Authz: `requireModuleAccess` / grants; update Part IV if rules change.  
5. Web: `app/` page, components, `nav-config` + capabilities.  
6. Mobile: `(app)/` route + home tile if primary.  
7. i18n: `_en`/`_bn` content; English UI (or feature-local copy).  
8. Seed / migrate indexes.  
9. Typecheck shared-types, api, web (mobile as needed).

**Data habits:** validate with Zod · thin controllers · soft-delete · English API errors · `{ data, meta }` envelope.

```
Client → (web proxy?) → authenticate → requireModuleAccess?
      → controller → service → model → MongoDB → DTO out
```

---

# Part XI — Path index

```
apps/api/src/app.ts
apps/api/src/middleware/auth.ts
apps/api/src/domains/*/
apps/web/app/api/proxy/[...path]/route.ts
apps/web/components/layout/nav-config.ts
apps/web/lib/capabilities.ts
apps/web/lib/salary-only.ts
apps/mobile/app/(app)/home.tsx
packages/shared-constants/index.ts
packages/shared-types/src/index.ts
packages/shared-types/src/salary-2026.ts
docs/DEVELOPER_HANDBOOK.md          ← this file
docs/ADMIN_DATA_ENTRY_MANUAL.md     ← content ops
docs/IMPLEMENTATION_PLAN.md         ← original phases / Module J checklists
docs/render-deploy.md               ← deploy
docs/DENORMALIZATION.md             ← indexes
```

---

# Part XII — Lessons for future structural projects

| Do | Why |
|----|-----|
| Shared contracts first | Clients stay in sync |
| `domains/` not `modules/` | Avoid Mongo name clash |
| Pure calculators in packages | Same results everywhere |
| Capability-based UI | Safer than role-only menus |
| BFF proxy for web cookies | Simpler auth story |
| Document gaps before coding waves | Avoid half-SMS / half-LMS |

| Watch | Note |
|-------|------|
| Temporary flags | Expiry / remove |
| Legacy subscription vs billing | One commerce model |
| Doc drift | Update this handbook when mounts change |
| Web/mobile parity | Decide per feature |

---

*Canonical developer sequence. Prefer updating this file when architecture or build-later specs change; keep specialty manuals (admin data entry, denormalization, deploy) as satellites.*
