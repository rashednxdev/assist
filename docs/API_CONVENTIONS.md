# iBAS++ API Conventions

---

## Base URL

```
/api/v1/{domain}/{resource}
```

Examples:

```
/api/v1/auth/login
/api/v1/users
/api/v1/setup/divisions
/api/v1/workflow/tasks
/api/v1/workflow/runs/:id/steps/:n/respond
/api/v1/books/:id/tree
```

---

## Response envelope

```json
{
  "data": {},
  "meta": { "page": 1, "limit": 20, "total": 142 }
}
```

Errors:

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "You are not allowed to complete this step"
  }
}
```

Error messages: **English** in `message`.

---

## Pagination & filters

```
?page=1&limit=20&sort=-created_at&status=active&locale=bn
```

List endpoints return `_bn` by default; pass `locale=en` to prefer `_en` in serialized `display_name` helper field.

---

## Soft delete

DELETE sets `is_active: false`. Hard delete only for dev environments.

---

## Locale serialization

List/detail responses include computed fields:

```json
{
  "name_bn": "ঢাকা",
  "name_en": "Dhaka",
  "display_name": "ঢাকা"
}
```

`display_name` resolved server-side via `display-text.ts`.

---

## Workflow inbox

```
GET /api/v1/workflow/inbox
```

Returns runs where `current_role` matches any active entry in `req.user.workflow_roles[].role_code`.

---

## User workflow role tags (admin)

```
POST   /api/v1/users/:id/workflow-roles        # assign tag
DELETE /api/v1/users/:id/workflow-roles/:code  # remove tag
```

No `office_code` on these endpoints.

---

## Audit

All mutating handlers call `auditService.log()` — append-only `audit_logs`.

---

*See PERMISSIONS.md · DENORMALIZATION.md · I18N_CONVENTION.md*
