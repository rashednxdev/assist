# iBAS++ Internationalization Convention

**English is the application UI language.** Bengali and English are stored together only at **data entry** level.

---

## Two layers

| Layer | Language | Where |
|-------|----------|--------|
| **Application UI** | English only | Labels, buttons, errors, navigation (`messages/en.json`) |
| **User-entered data** | English + Bengali (optional) | Database fields with `_en` / `_bn` suffixes |

---

## Data entry field pattern

Forms that capture human-readable content expose **both** fields where relevant:

| Field | Required | Purpose |
|-------|----------|---------|
| `*_en` or base English field | Yes | Primary value; shown in English UI |
| `*_bn` | No | Bengali text; entered when available |

### Examples

| Concept | English (required) | Bengali (optional at entry) |
|---------|-------------------|----------------------------|
| User name | `full_name_en` | `full_name_bn` |
| Book title | `name_en` | `name_bn` |
| Question body | `body_en` | `body_bn` |
| Workflow field label | `label` | `label_bn` |

---

## Display resolution

```ts
function displayText(doc: { name_en?: string; name_bn?: string }): string {
  return doc.name_en ?? doc.name_bn ?? '';
}
```

Default platform locale: **`en`**.

---

## Static UI strings

All UI copy lives in `apps/web/messages/en.json` via `next-intl`. Do not duplicate database content in locale files.

---

## Validation (Zod / API)

```ts
full_name_en: z.string().min(1),
full_name_bn: z.string().optional(),
```

Rich text fields allow HTML/Markdown. Sanitize on write.

---

*Schema v3.2+ · UI English · bilingual data entry*
