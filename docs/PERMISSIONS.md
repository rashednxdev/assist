# iBAS++ Permission Model

Single authoritative RBAC ruleset. All authorization goes through one service: `authorize(action, context)`.

---

## Three layers (evaluation order)

```
1. Account gate     → status, is_verified, credentials.status
2. Platform layer   → user_type, is_super_admin, user_module_access
3. Workflow layer   → users.workflow_roles[] (optional tags on profile)
```

Evaluate top to bottom. First denial wins unless `is_super_admin` applies (see matrix).

---

## Layer 1 — Account gate

| Check | Deny if |
|-------|---------|
| `users.status` | not `active` |
| `users.is_verified` | `false` for exam registration / sensitive actions |
| `credentials.status` | `locked` or `reset_required` |

---

## Layer 2 — Platform access

### `user_type`

| Type | Default access |
|------|----------------|
| `system_admin` | Full platform; same as `is_super_admin` |
| `admin` | Scoped by `user_module_access` |
| `officer` | Workflow inbox + read modules granted explicitly |
| `applicant` | Applicant portal (Module J) + own profile |

### `user_module_access`

Required for **admin CRUD** on module data (books, questions, exams, etc.).

| Flag | Allows |
|------|--------|
| `can_read` | GET list/detail |
| `can_create` | POST |
| `can_update` | PATCH |
| `can_delete` | Soft-delete (`is_active = false`) |
| `can_grade` | Grade exam answers |
| `can_publish` | Publish questions/papers |
| `task_restrictions` | Limit to specific task codes (empty = all in module) |

Check: `{ user_id, module_code, is_active: true }` and optional `expires_at`.

### Super admin bypass

| Action type | `is_super_admin` |
|-------------|------------------|
| Module CRUD (A–J admin) | Bypass `user_module_access` |
| Workflow step action | **Does not bypass** — must hold matching `workflow_roles` tag unless acting as `ADMIN` role |
| Audit log read | Bypass |
| Grant module access | Bypass |

---

## Layer 3 — Workflow roles (optional user tags)

Workflow roles live on the **user profile** as an optional embedded array. A user may have **zero or more** tags. **Not tied to office.**

```json
"workflow_roles": [
  { "role_id": "...", "role_code": "DDO", "is_active": true, "assigned_at": "...", "assigned_by": "..." }
]
```

### Inbox eligibility

User sees a `task_run` when **all** match:

1. `task_run.status === 'in_progress'`
2. `task_run.current_role === user.workflow_roles[].role_code` (any active tag)
3. User passes Layer 1 account gate

### Step action eligibility

User may POST step response when:

1. Inbox eligibility (above)
2. `step_responses` for this step not already finalized (idempotent guard)
3. `action` is allowed for step (`submit / approve / reject / return / skip`)

### Role codes (Module G seed data)

`SDO`, `DDO`, `AO`, `FD`, `ADMIN`, `SYSTEM`

- `SYSTEM` — auto steps only; no human user tag
- `ADMIN` — workflow super-user tag; can act on any `current_role` step

---

## Permission matrix

| Action | Layer 1 | Layer 2 | Layer 3 |
|--------|---------|---------|---------|
| Login | ✓ | — | — |
| Admin: list users | ✓ | `user_type` admin+ | — |
| Admin: CRUD questions | ✓ | `user_module_access` EXAM | — |
| Workflow: view inbox | ✓ | `user_type` officer or admin | active `workflow_roles` tag |
| Workflow: submit step | ✓ | — | matching `role_code` |
| Applicant: register exam | ✓ | `user_type` applicant | — |
| Super admin: grant module access | ✓ | `is_super_admin` | — |

---

## API middleware shape

```ts
// apps/api/src/shared/authorize.ts
authorize('module:questions:create', { user, moduleCode: 'EXAM' })
authorize('workflow:step:submit', { user, run, step })
```

Controllers call `authorize` once per mutating handler. No ad-hoc checks in routes.

---

## Frontend navigation

Build sidebar from **capabilities**, not URL prefixes:

```ts
canManageUsers(user)
canAccessWorkflowInbox(user)      // workflow_roles.length > 0
canAccessModule(user, 'EXAM')
canRegisterExam(user)             // user_type === 'applicant'
```

One user may see workflow inbox **and** applicant menu if they hold both `officer`/`admin` type and applicant registrations.

---

*Schema v3.2 · See `users.workflow_roles` in unified schema*
