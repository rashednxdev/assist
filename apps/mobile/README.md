# ProAssist (Mobile)

Expo mobile app scoped to **User** authentication and **Learning** modules only.

## Features (phase 1)

- Smart login & registration screens
- Home dashboard with profile activity and learning content counts
- Four module entry points:
  - Rule Library & Tools (Books)
  - Question Bank
  - Exam Programs
  - Practice Papers

## Setup

```bash
# From repo root
npx pnpm@9.15.9 install
npx pnpm@9.15.9 build:packages

# Copy env and set API URL
cp apps/mobile/.env.example apps/mobile/.env
```

### API URL by device

| Target | `EXPO_PUBLIC_API_URL` |
|--------|------------------------|
| iOS Simulator | `http://localhost:3001/api/v1` |
| Android Emulator | `http://10.0.2.2:3001/api/v1` |
| Physical device | `http://<your-pc-lan-ip>:3001/api/v1` |

Start API + web from root:

```bash
npx pnpm@9.15.9 dev
```

Start mobile:

```bash
npx pnpm@9.15.9 dev:mobile
```

If Expo Go shows **"Failed to download remote update"**:

1. Stop any old Metro process and restart with `dev:mobile` (uses `--clear` and monorepo-safe Metro paths).
2. Phone and PC must be on the **same Wi‑Fi**; scan the QR code from the terminal (LAN URL).
3. If LAN still fails, use tunnel mode: `pnpm --filter @ibas/mobile dev:tunnel`
4. Update **Expo Go** to SDK 54 on the device.
5. For a native debug APK, rebuild after manifest changes: `npx expo run:android`

## Stack

- Expo 52 + Expo Router
- Secure token storage (`expo-secure-store`)
- Shared types from `@ibas/shared-types`
