# iBAS++ Admin Task Manual — Overview

# iBAS++ Admin Task Manual

Task-based guide for administrators. Each section is one **job from start to finish** — follow the steps in order. This is not a field reference; it tells you **what to do next** at each stage.

---

## How to use this manual

1. If you are setting up the system for the first time, follow **Module order (greenfield)** below.
2. If you are doing one job only, jump to that module’s process.
3. Finish one process completely before starting the next dependent job.
4. After changing a user’s access, that user must **log out and log in again** to see new menus.

**Default login (after database seed):** http://localhost:3000/login → `admin@ibas.gov.bd` / `Admin@123456`

---

## Module order (greenfield)

When building the system from empty to usable, run modules in this sequence:

| Order | Module | Why this order |
|-------|--------|----------------|
| 1 | Geography | Needed before user addresses |
| 2 | Users | Staff must exist before workflow |
| 3 | Books | Rules must exist before questions & syllabus links |
| 4 | Questions | Published questions needed for papers |
| 5 | Exams | Exam structure before syllabus & papers |
| 6 | Syllabus | Maps subjects to books (needs books + exam subject) |
| 7 | Papers | Needs exam subject + published questions |
| 8 | Workflow | Needs users with workflow roles |
| 9 | Audit | Review after go-live |

Tools (**PDF to Word**) can be used anytime for drafting content offline.

---

---

# Quick map: Menu → Module

| Sidebar | Module in this manual |
|---------|------------------------|
| Geography | Module 2 |
| Users | Module 3 |
| Book admin / Rule library | Module 4 |
| Regulations | Module 5 |
| New question / Question bank | Module 6 |
| Exam setup / Exam programs | Module 7 |
| Syllabus (from subject) | Module 8 |
| New paper / Practice papers | Module 9 |
| Workflow admin / Guided processes | Module 10 |
| PDF to Word | Module 11 |
| Audit log | Module 12 |

---

---

*iBAS++ · Overview · Admin data entry task manual · 2026*
