# iBAS++ Denormalization Policy

Rules for duplicated fields across collections. Prevents silent data drift and wrong "fixes."

---

## Rule A — Historical snapshot (never update retroactively)

Write once at event time. **Do not backfill** when master data changes.

| Collection | Snapshot fields | When written |
|------------|-----------------|--------------|
| `task_runs` | `task_name`, `task_version` | Run start |
| `step_responses` | `step_number`, `role_code` | Step action |
| `audit_logs` | `actor_name`, `actor_role` | Each audit entry |
| `notifications` | `title`, `message` | Notification create |

**Why:** Audit and legal traceability require point-in-time accuracy.

---

## Rule B — Live resolve on read (prefer over stale copy)

For **configuration** data still being edited, resolve from source on GET; do not rely on denormalized copies for writes.

| Collection | Denormalized field | Resolution |
|------------|-------------------|------------|
| `tasks` | `module_name` | `$lookup` → `modules.name_bn` on read; optional cache on publish |
| `task_steps` | `role_name` | `$lookup` → `roles.name_bn` on read |
| `user_module_access` | `module_code` | Set once at grant; update only if module code renamed (rare admin script) |

**API pattern:**

```ts
// GET /workflow/tasks/:id — populate module and steps with live names
Task.findById(id).populate('module_id').populate('steps.role_id');
```

---

## Rule C — User workflow role tags

| Field | Location | Policy |
|-------|----------|--------|
| `role_code` | `users.workflow_roles[]` | Snapshot at assign time; refresh if admin renames role in `roles` collection via migration script |
| `role_id` | `users.workflow_roles[]` | Source of truth link |

Inbox matching uses **`role_code`** on both `task_runs.current_role` and `users.workflow_roles[].role_code`.

---

## Rule D — Bengali-first display names

When snapshotting human-readable names, prefer **`_bn` fields**:

```json
"actor_name": "মোঃ রফিকুল ইসলাম",
"task_name": "মাসিক বেতন বিল জমা"
```

Include `actor_name_en` / `task_name_en` in snapshots only when English was present at write time.

---

## Forbidden operations

| Collection | Forbidden |
|------------|-----------|
| `audit_logs` | UPDATE, DELETE (append-only) |
| `step_responses` | UPDATE after finalize (create correction entry instead) |
| `task_runs` | Change `task_name` after `started_at` |

Enforce in Mongoose hooks + Atlas custom roles on `audit_logs`.

---

*Schema v3.2*
