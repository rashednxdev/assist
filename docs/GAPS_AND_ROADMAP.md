# Gaps, drawbacks & build-later roadmap

> **Also in:** **[DEVELOPER_HANDBOOK.md](./DEVELOPER_HANDBOOK.md) Part IX** (single sequential developer file).  
> **Intent:** Planning documentation only — **not** a current deploy checklist.  
> Use when you later implement auth hardening, SMS, LMS-shaped learning, Module J, or UX parity.

Complements: [PROJECT_GUIDE.md](./PROJECT_GUIDE.md) · [PERMISSIONS.md](./PERMISSIONS.md) · [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) · [API_CONVENTIONS.md](./API_CONVENTIONS.md)

---

## 0. How to use this document later

1. Pick a **wave** (A → E).  
2. Read **prerequisites / drawbacks** for that wave (§7) so you do not miss infrastructure.  
3. Implement only in the **ownership** modules (§5).  
4. Tick **definition of done** (§6).  
5. Add one line under PROJECT_GUIDE §7 when something actually ships.

---

## 1. User-facing efficiency gaps (document for later UX)

| Gap | User impact | Later home |
|-----|-------------|------------|
| Web has **no Forgot password** | Stuck unless mobile or admin temp password | `apps/web` `/forgot-password`, `/reset-password` + login link |
| Register **auto-verifies**; verify page orphaned | Demo OTP confusion; weak trust | `account` + restore verify gate |
| **Salary-only web** vs full mobile | Same account, different product surface | `salary-only.ts` policy or align entitlements |
| Timed MCQ exam **mobile-only** | Web cannot sit countdown papers | `papers` web UI + existing `PaperAttempt` API |
| Saved / history **device-local** | Lost on new device | `evaluation` or `learner-state` |
| Catalog practice, not “my path” | Users hunt content | Guided exam-prep home |
| Unclear why a module is locked | Support load | Account + locked-module CTA (package vs grant) |
| Salary TR / bill rules opaque | Surprise download block | Salary UI + admin salary-access help |
| No “sign out all devices” | Stolen session risk after phone loss | `account` + `token_version` |
| Admin temp-password path undocumented for end users | Confusion with self-serve reset | Help copy / admin runbook |

---

## 2. Auth & security — as-is vs build-later target

### 2.1 As-is (today)

| Capability | Status |
|------------|--------|
| Password login (email or BD phone) | Yes |
| Lockout after 5 fails / 15 min | Yes |
| Mobile one-device binding | Yes (web currently ignored) |
| Register consent checkbox | Yes (office bill-form consent copy) |
| Admin temp password + `must_change_password` | Yes |
| Password reset **email OTP** | API + **mobile UI only** |
| Registration OTP | **Stub** (demo codes; often auto-verified) |
| SMS gateway | **None** |
| Login SMS confirmation / MFA | **No** (`two_fa_enabled` unused) |
| Magic-link reset | **No** |
| Short-lived access JWT + refresh rotation | **Weak** (long-lived tokens; logout does not bump `token_version`) |
| Dedicated OTP rate limits | **Loose** (shared 100/15m with login) |

### 2.2 Build later — SMS confirmation on login

**Target behaviour:** correct password → SMS OTP challenge → only then issue tokens.

| Step | Module | Spec |
|------|--------|------|
| 1 | `shared-constants` | `AUTH_OTP_PURPOSES`: `login`, `register`, `reset`, `phone_change` |
| 2 | `shared-types` / `auth.ts` | `loginChallengeSchema`, `loginConfirmSchema` |
| 3 | `apps/api` SMS adapter | Provider interface + env; staging logs only until provider live |
| 4 | Credentials / OTP store | Hashed OTP, 15 min TTL, purpose=`login` |
| 5 | `auth.service` | Password OK → `{ challenge_required, challenge_id, phone_hint }` (no tokens); confirm → JWTs |
| 6 | `app-settings` | `login_sms_confirm_enabled` admin flag |
| 7 | Web + mobile | Two-step login UI |
| 8 | Audit | Log challenge issued / confirmed / failed; optional admin emergency skip |

**Rules (do not skip later)**

- Never return raw OTP in production JSON (remove `demoCode` / `demo.*` leakage).  
- Rate limit OTP send and verify per phone and per IP.  
- Single-use challenge; invalidate on success or expiry.  
- Prefer SMS to registered BD mobile; email fallback if policy allows.

### 2.3 Build later — standard secure password recovery

```
Request (phone OR email)
  → always same response shape (anti-enumeration)
  → OTP to SMS and/or email (hashed, ~15 min)
  → submit OTP + new password + confirm
  → rehash password; clear OTPs/temp password; unlock
  → token_version++
  → optional “password changed” notice
```

| Gap vs today | Later fix |
|--------------|-----------|
| No web forgot/reset UI | Add pages + login link |
| Email-only OTP | SMS via shared adapter |
| Forgot schema phone-only | Allow email **or** phone |
| No change notification | Email (± SMS) |
| Shared loose rate limit | Dedicated `/password/*` + OTP limits |
| Sessions after reset | Keep `token_version++`; add logout-all |

**Keep:** admin temp-password + clear device as break-glass only.

### 2.4 Auth backlog (more)

| Item | Priority | Module |
|------|----------|--------|
| Web forgot/reset parity | P0 | `apps/web` |
| Real register verify before `active` | P0 | `account` |
| Strip demo OTP from production responses | P0 | `account` |
| Short access JWT + refresh rotation + `/auth/refresh` | P0 | `auth` |
| Logout / “sign out all” bumps `token_version` | P0 | `auth` / `account` |
| Per-phone / per-IP OTP limits | P0 | middleware |
| Login SMS confirm (§2.2) | P1 | `auth` + SMS |
| SMS on password reset | P1 | `account` + SMS |
| Admin TOTP 2FA | P2 | `auth` |
| Explicit web vs mobile device policy | P2 | `auth` |

---

## 3. Learning / LMS — as-is vs undelivered

### 3.1 Reality

Shipped product is an **exam-prep / rule-library**, not a general LMS:

```
Books ↔ Questions ↔ Exams/Syllabus ↔ Papers → self-evaluation → Progress
(+ QOTD, marathon, exam-week, exam-routine, user-questions)
```

Access = module grants + packages (`exam_prep` / `basic` / `live`), **not** course enrollment.

### 3.2 Already deployed (do not rebuild)

| Capability | Web | Mobile | API |
|------------|-----|--------|-----|
| Books / regulations | ✓ | ✓ | ✓ |
| Question bank | ✓ | ✓ | ✓ |
| Papers | ✓ | ✓ | ✓ |
| Timed MCQ attempt | — | ✓ | ✓ |
| Syllabus | ✓ | ✓ | ✓ |
| QOTD / exam-week / routine | ✓ | ✓ | ✓ |
| Marathon / progress | ✓ | ✓ | ✓ |
| Offline question sync | — | ✓ | sync |
| Saved / history | — | local | — |
| Exam-prep part scope | layouts | hub | ✓ |

### 3.3 LMS expectations **not deployed** (map for later)

| LMS expectation | Status | Later home | Drawback if skipped forever |
|-----------------|--------|------------|-----------------------------|
| Courses / enrollment | Missing | `learning-paths` or extend `exam-prep` | No “my curriculum” |
| Sequencing / unlock | Missing | paths + `evaluation` | Random practice only |
| Instructor assignments + grade | Missing | `evaluation` / `assignments`; use `can_grade` | No formal marking |
| Certificates | Missing | `certificates` + PDF | No completion proof |
| Learning cohorts | Missing | exam-prep + contacts cohort | Cannot run a batch class |
| Prerequisites | Missing | path rules | Learners skip foundations |
| Timed exam on **web** | Missing | `papers` web UI | Web/mobile parity break |
| Server bookmarks / history | Missing | `learner-state` | Cross-device loss |
| Learning notifications | Incomplete | `notifications` templates | Low daily engagement |
| SCORM / xAPI | Missing | **Defer** unless regulator requires | N/A for most BD exam-prep |
| **Module J candidate portal** | Seed/code only | `domains/candidate` | No registration/results/appeals |
| Instructor analytics | Partial counts | `admin-overview` + evaluation | Weak coaching insight |
| Live-class attendance cert | Missing | `live-stream` optional | — |

### 3.4 Learning efficiency (later, existing modules first)

1. Guided exam-prep home (next paper / QOTD / weak topics).  
2. Web timed paper exam (reuse mobile API).  
3. Server-backed saved + history.  
4. Progress CTA: “Continue …” not stats-only.  
5. Explicit lock reason (package vs grant vs subject).  
6. Optional QOTD reminder (push; SMS after SMS adapter exists).

### 3.5 Module J (candidate) — still undelivered

From [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) Phase 7. `CANDIDATE` module code exists; **no domain**.

| Later capability | Home |
|------------------|------|
| Exam registration | `domains/candidate` + `ExamName.registration_fee` |
| Admit / schedule | candidate + `exam-routine` |
| Results / appeals | candidate |
| Applicant portal UI | web `/candidate`, mobile `(app)/candidate` |
| Fee payment | `billing` order kind |

**Caution:** `applicant` user_type is also used for general registration / salary users — document dual purpose before Module J UI.

---

## 4. Delivery waves (build later — not current deploy)

| Wave | Focus | When to start |
|------|--------|----------------|
| **A** | Trust & account — web reset, real verify, JWT harden | First auth work |
| **B** | SMS adapter + login SMS confirm + SMS reset | After provider + Wave A schemas |
| **C** | Learning efficiency — web timed exam, guided home, sync | Independent of SMS |
| **D** | LMS-shaped — paths, certificates, Module J | After C clarity |
| **E** | Admin TOTP, SCORM (if required), full classrooms | Optional |

---

## 5. Ownership cheat-sheet

| Concern | Package / app |
|---------|----------------|
| OTP purposes, thresholds | `shared-constants` |
| Auth Zod schemas | `shared-types` → `auth.ts` |
| SMS send | `apps/api` shared `sms/` + env |
| Login / JWT / device | `domains/auth` |
| Register / verify / reset | `domains/account` |
| Mail | `shared/mailer.ts` |
| Feature flags | `domains/app-settings` |
| Web auth pages | `apps/web/app/{login,forgot-password,reset-password,register/verify}` |
| Mobile auth | `apps/mobile/app/(auth)/*` |
| Timed papers (web) | `apps/web` + evaluation/papers API |
| Paths / certificates / candidate | new or extended domains (§3.3) |

---

## 6. Definition of done (for when you implement)

**Password recovery**  
- [ ] Web + mobile same flow  
- [ ] OTP email and/or SMS; hashed; ~15 min TTL  
- [ ] Rate limited; anti-enumeration response  
- [ ] `token_version++`; optional notify  
- [ ] No OTP in production API JSON  

**SMS login confirmation**  
- [ ] Password OK → challenge only  
- [ ] SMS (or staging log)  
- [ ] Confirm → tokens; single-use  
- [ ] Admin enable/disable flag  

**Learning efficiency**  
- [ ] Web timed MCQ paper  
- [ ] Guided “next step” on exam-prep home  
- [ ] Bookmarks survive reinstall when logged in  

---

## 7. Prerequisites & drawbacks you can miss

Infrastructure and product risks to plan **before** coding a wave. These are easy to overlook.

### 7.1 Cross-cutting

| Item | Why it matters | Later note |
|------|----------------|------------|
| **Env / secrets** | SMS, SMTP, JWT TTL, feature flags | Document in `.env.example` when building; never commit keys |
| **Staging vs production** | Demo OTP OK on staging only | `NODE_ENV` / `OTP_DELIVERY=log\|email\|sms` |
| **Redis / job queue** | Original plan assumed BullMQ for OTP workers | Optional; can send sync first, queue later for scale |
| **Audit log** | Auth challenges, reset, admin skip | Reuse workflow/audit patterns |
| **Rate-limit store** | In-memory fails on multi-instance | Redis or provider-side limits for production SMS |
| **Clock skew** | OTP expiry | Server time only; show remaining minutes in UI |
| **i18n** | Auth + learning CTAs | English shell + Bangla where product already mixes |
| **Docs drift** | IMPLEMENTATION_PLAN still says mobile OOS / stub SMS | Prefer **this file** for post-MVP auth/LMS; keep Phase 7 for Module J detail |

### 7.2 SMS-specific drawbacks

| Drawback | Mitigation when you build |
|----------|---------------------------|
| BD operator / DND / gateway approval delay | Choose provider early; keep `OTP_DELIVERY=log` until approved |
| Cost per OTP | Cap resends; challenge reuse window; admin budget alert |
| Phone number changes | Re-verify phone; invalidate login SMS until verified |
| SIM swap / OTP interception | Optional: require recent password + device binding; admin 2FA later |
| Dual channel (SMS + email) confusion | One primary channel per flow; state clearly in UI |
| International numbers | Product is BD `01[3-9]…` — keep that unless you expand schema |

### 7.3 Password-recovery drawbacks

| Drawback | Mitigation |
|----------|------------|
| Account enumeration | Same timing + body whether user exists |
| Email goes to spam | SMS primary for BD; SPF/DKIM for mail domain |
| Placeholder emails (`@phone.proassist.app`) | Already blocked on reset — keep that rule |
| User has phone but no email access | SMS reset path |
| Compromised email inbox | Prefer SMS confirm; notify on both channels after change |

### 7.4 Login SMS confirmation drawbacks

| Drawback | Mitigation |
|----------|------------|
| Extra friction | Flag off for low-risk; remember-device cookie N days (optional) |
| SMS delay → abandon | Resend with cooldown; voice OTP later if needed |
| Admin lockout if SMS down | Break-glass: temp password / disable flag / email OTP fallback |
| Web + mobile both need two-step UI | Shared API contract first |

### 7.5 JWT / session drawbacks

| Drawback | Mitigation |
|----------|------------|
| 365d tokens hard to revoke | Short access + refresh; bump `token_version` on logout/reset |
| No `/auth/refresh` today | Add when shortening access TTL |
| Web ignores device bind | Decide: keep exempt **or** bind browsers — document choice |

### 7.6 Learning / LMS drawbacks

| Drawback | Mitigation |
|----------|------------|
| Building a full LMS overkill for exam-prep | Prefer Wave C efficiency before Wave D paths |
| Paths without good content → empty shells | Content ops first (ADMIN_DATA_ENTRY_MANUAL) |
| Certificates without verification | Signed PDF + verify URL / code |
| Instructor grading vs self-eval confusion | Separate models; keep self-rating for practice |
| Module J vs salary `applicant` collision | Separate nav + status machine for candidates |
| Offline sync vs server history conflicts | Last-write or merge policy for bookmarks |
| Web timed exam cheating | Same constraints as mobile (timer, submit lock); no SCORM needed |
| Package vs grant lock UX | Single “access reason” helper shared by web/mobile |

### 7.7 Billing / notifications / other product gaps (related)

| Gap | Later home | Note |
|-----|------------|------|
| bKash OTP demo (`123456`) | `billing` | Replace before real payments |
| Unpaid / entitlement messaging | `app-settings` + clients | Already partially used |
| Learning-specific pushes | `notifications` | Templates for QOTD / exam-week |
| Workflow OTP email/SMS stubs (original plan) | `workflow` jobs | Distinct from login OTP; can share SMS adapter |
| Content-cache / CDN | `content-cache` | Scale for books/PDFs later |
| E2E tests for auth + exam take | Playwright / Detox | Phase 8 hardening in IMPLEMENTATION_PLAN |

### 7.8 Explicit non-goals (unless requirements change)

- Full SCORM/xAPI LMS packager  
- Bangladesh Bank EFT  
- Replacing salary calc with a third-party payroll  
- Forcing web device binding identical to mobile without a product decision  

---

## 8. Suggested build order (reminder)

```
Wave A (trust) ──► Wave B (SMS login/reset)
                └──────────────► Wave C (learning UX) ──► Wave D (paths / certs / Module J) ──► Wave E
```

Wave C can run in parallel with A/B if different owners.

---

## 9. Status

| | |
|--|--|
| **Deploy to current system now?** | **No** — documentation only |
| **Purpose** | Capture gaps, LMS undelivered items, auth SMS/reset design, and missable drawbacks |
| **Update when** | A wave is actually implemented, or product priorities change |

---

*Last updated for documentation-only planning (auth SMS, secure reset, LMS gaps, Module J, infra drawbacks).*
