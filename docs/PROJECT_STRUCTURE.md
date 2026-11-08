# iBAS++ Project Structure

> **Canonical sequential developer doc:** **[DEVELOPER_HANDBOOK.md](./DEVELOPER_HANDBOOK.md)** (architecture + conventions + product options + build-later gaps in one file).

This file stays as a short map into the docs set.

## Layout (summary)

```
assist/
├── apps/api       Express REST — domains under src/domains/
├── apps/web       Next.js App Router + BFF /api/proxy
├── apps/mobile    Expo Router — (auth) / (app)
├── packages/
│   ├── shared-constants
│   └── shared-types
└── docs/          Conventions + PROJECT_GUIDE.md
```

## Related docs

| Doc | Purpose |
|-----|---------|
| [DEVELOPER_HANDBOOK.md](./DEVELOPER_HANDBOOK.md) | **One file** — sequential for developers |
| [PROJECT_GUIDE.md](./PROJECT_GUIDE.md) | Architecture (merged into handbook) |
| [GAPS_AND_ROADMAP.md](./GAPS_AND_ROADMAP.md) | Build-later gaps (merged into handbook Part IX) |
| [USER_OPTIONS_AND_OPPORTUNITIES.md](./USER_OPTIONS_AND_OPPORTUNITIES.md) | PM options (merged into handbook Part VIII) |
| [PERMISSIONS.md](./PERMISSIONS.md) | Access layers |
| [API_CONVENTIONS.md](./API_CONVENTIONS.md) | REST envelope |
| [I18N_CONVENTION.md](./I18N_CONVENTION.md) | Locales |
| [DENORMALIZATION.md](./DENORMALIZATION.md) | Mongo patterns |
| [render-deploy.md](./render-deploy.md) | Deploy |

## Domain folder convention

```
domains/<name>/
  models/
  *.service.ts
  *.controller.ts
  *.routes.ts
```

MongoDB collection `modules` ≠ folder name `domains/`.
