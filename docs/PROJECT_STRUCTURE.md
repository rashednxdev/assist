# iBAS++ Project Structure

Corrected monorepo layout addressing naming collisions, BFF auth, jobs, and shared libraries.

---

## Repository tree

```
proAssist/
├── apps/
│   ├── api/                         # Express.js REST API
│   │   ├── src/
│   │   │   ├── config/
│   │   │   ├── domains/             # NOT "modules" — avoids MongoDB modules collision
│   │   │   │   ├── auth/
│   │   │   │   ├── users/
│   │   │   │   ├── setup/
│   │   │   │   ├── workflow/
│   │   │   │   ├── books/
│   │   │   │   ├── questions/
│   │   │   │   ├── exams/
│   │   │   │   ├── syllabus/
│   │   │   │   ├── papers/
│   │   │   │   └── candidate/       # Module J
│   │   │   ├── jobs/                # Job definitions (BullMQ / Agenda)
│   │   │   ├── workers/             # OTP, notifications, auto workflow steps
│   │   │   ├── shared/
│   │   │   │   ├── authorize.ts
│   │   │   │   ├── audit/
│   │   │   │   ├── errors/
│   │   │   │   ├── pagination/
│   │   │   │   ├── transactions/
│   │   │   │   └── display-text.ts  # Bengali-first locale resolver
│   │   │   └── app.ts
│   │   └── package.json
│   └── web/                         # Next.js 15 App Router
│       ├── app/
│       │   ├── api/[...path]/       # BFF proxy → Express (same-origin cookies)
│       │   ├── (auth)/
│       │   └── (app)/               # Single shell; nav built from capabilities
│       ├── components/
│       │   ├── ui/                  # ShadCN
│       │   └── domains/
│       ├── lib/
│       │   ├── api-client.ts
│       │   └── permissions.ts
│       └── messages/
│           ├── bn.json              # Primary UI strings
│           └── en.json
├── packages/
│   ├── shared-types/                # Zod schemas (all collections)
│   └── shared-constants/            # ROLE_CODES, MODULE_CODES, USER_TYPES
├── scripts/
│   ├── seed/
│   └── migrations/                  # Indexes, TTL (confirm retention first)
└── docs/
    ├── PERMISSIONS.md
    ├── DENORMALIZATION.md
    ├── I18N_CONVENTION.md
    └── API_CONVENTIONS.md
```

---

## BFF proxy (auth same-origin)

Browser never calls Express directly in production.

```
Browser → https://app.ibas.gov.bd/api/proxy/v1/users/me
       → Next.js Route Handler
       → http://api:3001/api/v1/users/me
```

Refresh token: `httpOnly` cookie on app domain. Access token: memory or short-lived cookie.

---

## Domain folder convention

Each domain follows:

```
domains/workflow/
  models/
  services/       # Transactions live here
  controllers/
  routes/
  validators/
```

**MongoDB collection `modules`** ≠ folder name `domains/`.

---

## Multi-document transactions

Use MongoDB sessions in **services** for:

- Start / advance workflow run
- Publish question (question + options + answers)
- Compose paper (paper + groups + questions)

```ts
async function advanceStep(runId, payload, session) {
  session.startTransaction();
  try {
    // update task_runs, insert step_responses, insert notification, insert audit_log
    await session.commitTransaction();
  } catch (e) {
    await session.abortTransaction();
    throw e;
  }
}
```

---

## Job queue (Phase 0 stub)

| Job | Trigger |
|-----|---------|
| `send-otp` | Login / verify |
| `workflow-handoff-notify` | Step advance |
| `workflow-auto-step` | `task_steps.is_auto === true` |

Start in-process; move to Redis + BullMQ for staging/prod.

---

## Tree read APIs (avoid N+1)

| Endpoint | Purpose |
|----------|---------|
| `GET /books/:id/tree?depth=3` | Book hierarchy |
| `GET /exams/:id/setup-tree` | Exam → subject tree |
| `GET /syllabus/subjects/:id/tree` | Syllabus + references |

---

## Dynamic workflow fields

Validate `task_steps.fields[]` with Zod discriminated union in `packages/shared-types`:

`text | number | select | date | otp | file`

Validate on task publish **and** step submit.

---

## Testing layout

```
apps/api/tests/integration/
apps/web/e2e/                        # Playwright: login + workflow happy path
```

---

*Stack: Express · MongoDB Atlas · Next.js · Tailwind · ShadCN*
