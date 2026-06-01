# iBAS++ — Phase 0

## Prerequisites

- Node.js 20+
- pnpm 9+
- MongoDB (local or Atlas)

## Setup

> **Network note:** If `pnpm install` fails with `ECONNRESET`, retry on a stable connection or use a registry mirror:
> ```powershell
> pnpm config set registry https://registry.npmmirror.com
> ```

```bash
# Install dependencies
pnpm install

# Copy env files
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local

# Build shared packages
pnpm --filter @ibas/shared-constants build
pnpm --filter @ibas/shared-types build

# Seed super admin + sync indexes
pnpm seed
pnpm migrate:indexes
```

## Development

```bash
pnpm dev
```

- Web: http://localhost:3000
- API: http://localhost:3001
- Health: http://localhost:3001/api/v1/health

## Default login (after seed)

| Field | Value |
|-------|-------|
| Email | `admin@ibas.gov.bd` |
| Password | `Admin@123456` |

## Project structure

```
apps/api/     Express REST API
apps/web/     Next.js + ShadCN UI
packages/     shared-constants, shared-types
docs/         Architecture & implementation plans
planning/     MongoDB schema v3.2
```
