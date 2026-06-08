# Deploy on Render (API + Web)

Use **two Web Services** from the same GitHub repo.

## 1. API service

| Setting | Value |
|---------|--------|
| Build | `pnpm install && pnpm build:packages && pnpm --filter @ibas/api build` |
| Start | `pnpm --filter @ibas/api start` |

**Environment variables:**

| Variable | Example |
|----------|---------|
| `NODE_ENV` | `production` |
| `MONGODB_URI` | MongoDB Atlas connection string |
| `JWT_SECRET` | Long random string (16+ chars) |
| `CORS_ORIGIN` | `https://YOUR-WEB-SERVICE.onrender.com` |
| `JWT_ACCESS_EXPIRES_IN` | `8h` |
| `JWT_REFRESH_EXPIRES_IN` | `30d` |

Copy the API URL after deploy, e.g. `https://ibas-api.onrender.com` (no trailing slash).

Test: open `https://YOUR-API.onrender.com/api/v1/health` — should return JSON `{"data":{"status":"ok",...}}`.

## 2. Web service

| Setting | Value |
|---------|--------|
| Build | `pnpm install && pnpm build:packages && pnpm --filter @ibas/web build` |
| Start | `pnpm --filter @ibas/web start` |

**Environment variables:**

| Variable | Example |
|----------|---------|
| `NODE_ENV` | `production` |
| `API_URL` | `https://YOUR-API.onrender.com` |
| `NEXT_PUBLIC_APP_URL` | `https://YOUR-WEB.onrender.com` |

`API_URL` is **required** in production. If missing, login shows errors because the proxy cannot reach the API.

## 3. After both are live

1. Set `CORS_ORIGIN` on the API to the **exact** web URL (including `https://`).
2. Redeploy the API if you change `CORS_ORIGIN`.
3. Run seed once (API Shell): `pnpm seed` — optional, creates admin user.

## Login issues

| Symptom | Fix |
|---------|-----|
| "Invalid response from server" | Web `API_URL` wrong or unset; API returning HTML (cold start / error page). |
| "API_URL is not set" | Add `API_URL` on the **web** service in Render dashboard. |
| "Cannot reach API" | API down or wrong URL; wake API (free tier sleeps). |
| "Invalid email or password" | Run `pnpm seed` or use a user that exists in MongoDB. |

## MongoDB Atlas

- Network Access: allow `0.0.0.0/0` (or restrict to Render egress later).
- Use the same `MONGODB_URI` only in Render env, never commit `.env`.
