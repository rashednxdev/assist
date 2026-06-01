# iBAS++ Architecture Fixes Summary (v3.2)

Applied corrections from structure review per product decisions.

---

## 1. Workflow roles — optional tags on user profile

**Decision:** User may or may not have workflow roles. No office linkage. Part of basic user info.

**Implementation:** Embedded array on `users.workflow_roles[]` (Module A1).

```json
"workflow_roles": [
  { "role_id": "...", "role_code": "DDO", "is_active": true, "assigned_at": "...", "assigned_by": "..." }
]
```

**Inbox query:** Match `task_runs.current_role` against user's active `role_code` tags.

---

## 2. Bengali-first structure

**Decision:** Bengali is primary; English optional at schema level.

**Pattern:** `*_bn` (required) + `*_en` (optional) on all human-readable fields.

See: [`docs/I18N_CONVENTION.md`](../docs/I18N_CONVENTION.md)

---

## 3. Other fixes applied

| Issue | Fix | Document |
|-------|-----|----------|
| RBAC undefined | 3-layer permission matrix + `authorize()` | `docs/PERMISSIONS.md` |
| `modules` naming collision | API folders renamed to `domains/` | `docs/PROJECT_STRUCTURE.md` |
| Denormalization drift | Snapshot vs live-resolve rules | `docs/DENORMALIZATION.md` |
| Auth / CORS | Next.js BFF proxy | `docs/PROJECT_STRUCTURE.md` |
| No job queue | `jobs/` + `workers/` in API | `docs/PROJECT_STRUCTURE.md` |
| No transactions | Service-layer MongoDB sessions | `docs/PROJECT_STRUCTURE.md` |
| Tree N+1 | Aggregate tree endpoints | `docs/API_CONVENTIONS.md` |
| Role-based routes | Capability-based navigation | `docs/PERMISSIONS.md` |
| Dynamic form fields | Zod discriminated union | `docs/PROJECT_STRUCTURE.md` |
| Shared enums | `packages/shared-constants/` | repo |

---

## Document index

| File | Purpose |
|------|---------|
| `planning/ibas_unified_mongodb_schema.md` | Schema v3.2 (authoritative) |
| `docs/I18N_CONVENTION.md` | Bengali-first field rules |
| `docs/PERMISSIONS.md` | RBAC matrix |
| `docs/DENORMALIZATION.md` | Snapshot policy |
| `docs/PROJECT_STRUCTURE.md` | Monorepo layout |
| `docs/API_CONVENTIONS.md` | REST conventions |

---

*Ready for Phase 0 scaffolding*
