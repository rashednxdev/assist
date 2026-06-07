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

# Module 1 — Sign-in & dashboard

## Process 1.1 — Start an admin work session

**Start:** Browser open, not logged in.  
**End:** You are on the dashboard with admin menus visible.

1. Open the application login page.
2. Sign in with your admin account.
3. Confirm you land on **Dashboard**.
4. Check the left sidebar — you should see **Administration**, **Content admin**, and/or **Workflow admin** sections (depends on your access).
5. If expected menus are missing, stop — complete **Process 3.2** (module access) for your user, then log in again.

---

# Module 2 — Geography

**Menu:** Administration → **Geography**

## Process 2.1 — Build the national location tree

**Start:** No divisions (or incomplete tree).  
**End:** All divisions, districts, and thanas your users need are in the system.

1. Open **Geography**.
2. Add every **division** you need (one form submit per division).
3. For the first division, add all its **districts**.
4. For each district, add all its **thanas**.
5. Repeat steps 3–4 for every remaining division.
6. Scan the tree on screen — every district sits under a division, every thana under a district.
7. Done when the tree matches your official geography list.

## Process 2.2 — Fix a wrong location name or code

**Start:** A division, district, or thana already exists but is wrong.  
**End:** Record updated in the tree.

1. Open **Geography**.
2. Find the row in the tree.
3. Click **Edit** on that row.
4. Change the details and save.
5. Confirm the tree shows the correction.

## Process 2.3 — Remove a location entry

**Start:** A location was added by mistake.  
**End:** Entry removed from tree.

1. Open **Geography**.
2. Find the row.
3. Click **Delete** and confirm.
4. If delete is blocked (children exist), delete or move children first, or use **Process 2.2** to correct instead.

---

# Module 3 — Users

**Menu:** Administration → **Users**

## Process 3.1 — Onboard a new staff member (full job)

**Start:** Person is not in the system.  
**End:** Person can log in, see the right menus, and act in workflow if needed.

1. Open **Users** → **Add user**.
2. Create the account and return to the user list.
3. Open the new user from the list.
4. On **Profile** — verify type is correct (`admin` for data entry staff, `officer` for process-only staff).
5. On **Workflow roles** — assign roles they will act as (e.g. SDO, DDO) if they use the inbox.
6. On **Module access** — grant **Read** for modules they browse; grant **Create** and **Update** for modules they maintain.
7. On **Addresses** — add at least one address using the division → district → thana picker.
8. Tell the user to log in with the password you set.
9. Ask them to confirm sidebar menus match their job.

## Process 3.2 — Give an existing user access to a learning module

**Start:** User exists but cannot see Books / Questions / Exams / etc.  
**End:** User sees that module after re-login.

1. Open **Users** → select the user.
2. Go to **Module access**.
3. Find the module (e.g. BOOKS) and enable **Read**.
4. If they will enter data, also enable **Create** and **Update**.
5. Save.
6. User logs out and logs in again.

## Process 3.3 — Enable someone for workflow inbox

**Start:** User exists but inbox is empty or hidden.  
**End:** User sees **Action inbox** and receives tasks for their role.

1. Open **Users** → select the user.
2. **Module access** — enable WORKFLOW **Read** (and **Create** if they manage tasks).
3. **Workflow roles** — assign the role code that matches process steps (e.g. DDO).
4. Save.
5. User re-logs in.
6. Verify a published workflow task exists (**Module 10**) and a run is at their step.

## Process 3.4 — Deactivate or update a user account

**Start:** User should no longer work or details changed.  
**End:** Profile updated; inactive users cannot work.

1. Open **Users** → select the user.
2. **Profile** — change status to inactive if they leave; update names/contact if needed.
3. **Module access** — revoke grants if they no longer need access.
4. **Workflow roles** — deactivate roles they no longer hold.
5. Save.

---

# Module 4 — Books (Rule library)

**Menu:** Content admin → **Book admin** → book detail

## Process 4.1 — Create a new rule book from scratch

**Start:** No book type or book for this title.  
**End:** Book exists with full chapter → topic → sub-topic structure ready for questions.

1. Open **Book admin**.
2. Create a **book type** (category) for this library — e.g. Government Rules.
3. Create the **book** under that type — you are taken to the book page.
4. Click **Edit content**.
5. Add **Chapter 1**, then Chapter 2, and so on until all chapters exist.
6. Select Chapter 1 → add every **topic/rule** for that chapter.
7. Select each topic → add **sub-topics** with the rule text.
8. Repeat steps 6–7 for every chapter.
9. Turn off edit mode and browse the tree — structure should match the printed rule book.
10. Job complete — proceed to **Module 6** (syllabus links) or **Module 5** (questions).

## Process 4.2 — Add more content to an existing book

**Start:** Book shell exists; new chapter or rules to add.  
**End:** New content appears in the tree.

1. Open **Rule library** → open the book.
2. Click **Edit content**.
3. Either add a new **chapter** at the end, or select an existing chapter.
4. Add new **topics** or **sub-topics** as needed.
5. Save each piece before moving to the next.
6. Browse to verify placement.

## Process 4.3 — Correct or remove book metadata

**Start:** Wrong title, type, or duplicate book.  
**End:** Catalog is accurate.

1. Open **Book admin**.
2. To fix a **book type** — edit or delete from the type list (delete only if no books use it).
3. To fix a **book** — edit from the book list or delete if the whole book should go.
4. For deep content fixes, use **Process 4.2** inside the book editor.

---

# Module 5 — Regulations

**Menu:** Learning → **Regulations** (or from book editor)

## Process 5.1 — Publish a standalone regulation

**Start:** Regulation text exists outside a book chapter.  
**End:** Regulation is searchable and linkable from syllabus.

1. Open **Regulations** (or create from **Book admin** / book editor if tied to a book).
2. Create a new regulation with its full text.
3. Optionally link it to a book, chapter, or topic.
4. Save and open the regulation detail page to review.
5. Done — regulation appears in search and syllabus reference picker.

## Process 5.2 — Record an amendment to a regulation

**Start:** Regulation exists; official amendment issued.  
**End:** Amendment history captured on the regulation.

1. Open **Regulations** → find and open the regulation.
2. Add an **amendment** entry with the new text or change note.
3. Save.
4. Verify the detail page shows the amendment in history.

## Process 5.3 — Retire a regulation

**Start:** Regulation should no longer be used.  
**End:** Regulation removed from active catalog.

1. Open the regulation detail page.
2. **Delete** (or edit to mark inactive per your policy).
3. Confirm it no longer appears in default search.

---

# Module 6 — Questions

**Menu:** Content admin → **New question** → question detail

## Process 6.1 — Build the question bank for a book

**Start:** Book structure exists (**Module 4**); no questions yet.  
**End:** Published questions ready for papers.

1. Open **New question**.
2. Create the first question — choose type (MCQ, True/False, etc.), write the stem, link it to the correct book/chapter/rule.
3. For MCQ — add options and mark correct answer(s).
4. Save — you are on the question detail page.
5. Click **Publish**.
6. Repeat steps 1–5 for every question in your bank.
7. Open **Question bank** list — filter or search to confirm published items show up.
8. Done when all needed questions are published.

## Process 6.2 — Draft questions first, publish later

**Start:** Large batch to enter; not ready for learners.  
**End:** Drafts saved; publish when reviewed.

1. Create each question and save (do not publish yet).
2. Review from **Question bank** — open each draft.
3. When approved, open detail → **Publish** one by one (or in batch during review meetings).

## Process 6.3 — Update or withdraw a question

**Start:** Published question has an error or is obsolete.  
**End:** Bank reflects current truth.

1. Open **Question bank** → open the question.
2. Edit content and save, **or** delete if it must leave the bank entirely.
3. If the question is already on a **draft paper**, open that paper and swap or remove it (**Module 9**).

---

# Module 7 — Exams

**Menu:** Content admin → **Exam setup**

## Process 7.1 — Set up a complete exam program (first time)

**Start:** No department/authority/exam for this program.  
**End:** At least one subject exists and is ready for syllabus.

1. Open **Exam setup**.
2. **Department** tab — create the controlling department (or select existing).
3. **Authority** tab — create the exam authority under that department.
4. **Exam** tab — create the named exam (e.g. SAS 2026).
5. **Part** tab — create exam parts (Part I, Part II, …).
6. **Type** tab — create exam types (Written, Viva, …) for that exam.
7. **Subject** tab — create each subject, linking it to the correct part and type.
8. On the last subject, use **Create & open syllabus** to jump straight to **Module 8**, or stay and use the **Overview** panel to verify the tree.
9. Done when every subject you need is listed under the exam.

## Process 7.2 — Add a new subject to an existing exam

**Start:** Exam program exists; new subject added to syllabus.  
**End:** New subject appears in exam tree and has its own syllabus page.

1. Open **Exam setup**.
2. Walk the cascade: select department → authority → exam → part → type.
3. **Subject** tab — create the new subject.
4. **Create & open syllabus** or open syllabus later from **Exam programs** → exam → subject link.
5. Complete **Process 8.1** for that subject.

## Process 7.3 — Fix or remove an exam hierarchy item

**Start:** Wrong name or duplicate at any level.  
**End:** Hierarchy corrected.

1. Open **Exam setup**.
2. Go to the tab for that level (department, authority, exam, part, type, or subject).
3. Select the item → switch to **Edit** mode → update and save.
4. To remove — select item → delete (only if nothing downstream depends on it).

---

# Module 8 — Syllabus

**Menu:** Exam programs → exam → subject → **Syllabus**  
(or from Exam setup → **Create & open syllabus**)

## Process 8.1 — Build syllabus for one exam subject

**Start:** Subject exists; syllabus empty.  
**End:** Full syllabus with groups, topics, and book references.

1. Open the subject’s **Syllabus** page.
2. Create **Syllabus group 1** (major section of the syllabus).
3. Under that group, create each **topic**.
4. Under each topic, create **sub-topics** if the syllabus splits finer.
5. For each topic (or sub-topic), add **references** to book chapters, rules, or regulations (**Module 4** / **5** must be done first).
6. Repeat steps 2–5 for all syllabus groups until the subject is fully mapped.
7. Review the page — marks and references should cover the official syllabus document.

## Process 8.2 — Align syllabus after book content changes

**Start:** GFR/book updated; syllabus references outdated.  
**End:** References point to current rules.

1. Open the subject **Syllabus**.
2. Find topics with old references.
3. Edit or delete the reference → add new reference to the updated chapter/rule/regulation.
4. Save each change.

---

# Module 9 — Papers

**Menu:** Content admin → **New paper** → paper composer

## Process 9.1 — Create and publish a practice paper

**Start:** Exam subject exists; published questions exist.  
**End:** Learners can open a published paper.

1. Open **New paper**.
2. Pick the **exam** and **subject**, paper type, and paper name — create draft.
3. You are in the **composer** — add **Section 1** (e.g. Part A — MCQ).
4. Add questions from the bank into that section (only **published** questions appear).
5. Add more sections until the paper structure matches your blueprint.
6. Check **allocated marks** matches **total marks** (banner on page).
7. Click **Publish**.
8. Open **Practice papers** list — confirm status is Published.

## Process 9.2 — Revise a draft paper before publish

**Start:** Draft paper exists; not yet published.  
**End:** Draft ready for final review.

1. Open **Practice papers** → open the draft.
2. Add/remove/reorder sections.
3. Add/remove questions; adjust marks per question if allowed.
4. Re-check allocated vs total marks.
5. When ready, run **Process 9.1** step 7 (Publish).

## Process 9.3 — Unpublish or fix a live paper

**Start:** Published paper has errors.  
**End:** Learners no longer see bad paper, or corrected version live.

1. Open the paper composer.
2. Click **Unpublish** to take it offline.
3. Fix sections/questions.
4. Publish again when correct.

---

# Module 10 — Workflow (Guided processes)

**Menu:** Workflow admin → **Workflow admin**

## Process 10.1 — Define a new office process

**Start:** No task for this business process.  
**End:** Published task appears in process catalog.

1. Open **Workflow admin**.
2. Create a new **task** — name, code, and linked office module (e.g. BILL).
3. Add **Step 1** — title, which role acts (SDO, DDO, …), and fields officers must fill.
4. Add **Step 2**, **Step 3**, … in order until the process matches the official workflow.
5. Review the flow preview on screen.
6. **Publish** the task (requires at least one step).
7. Confirm it appears under **Workflow admin → Tasks** and **Guided processes → Process catalog**.

## Process 10.2 — Roll out a process to officers

**Start:** Task is published; no one can act yet.  
**End:** Officers receive inbox items when runs reach their step.

1. Complete **Process 3.3** for each officer — WORKFLOW access + correct workflow role.
2. Ask one officer to open **Process catalog** → start a **test run**.
3. First officer completes Step 1 → submit.
4. Next officer (next role) checks **Action inbox** → completes Step 2.
5. Repeat through all steps on the test run.
6. Fix task steps in **Workflow admin** if handoffs fail.
7. Go live — real users start runs from **Process catalog**.

## Process 10.3 — Change a live process

**Start:** Published task needs new step or field.  
**End:** Updated definition (note: in-flight runs may use old steps — coordinate with admins).

1. Open **Workflow admin** → select the task.
2. Edit task metadata or add/edit/delete steps.
3. Re-publish if the UI requires it after structural changes.
4. Communicate to officers; finish open runs or start new runs as policy dictates.

---

# Module 11 — PDF to Word (OCR tool)

**Menu:** Tools → **PDF to Word**

## Process 11.1 — Convert a scanned PDF to editable Word for data entry

**Start:** Source material is PDF (scan or digital).  
**End:** `.docx` file on your machine for copy-paste into books/questions.

1. Open **PDF to Word**.
2. Choose the PDF file.
3. Click **Convert & download Word**.
4. Wait — first run may take several minutes (language packs download once).
5. Open the downloaded Word file locally.
6. Copy cleaned text into **Book admin** or **New question** as part of **Module 4** or **Module 6**.
7. Always proofread OCR output before publishing.

---

# Module 12 — Audit

**Menu:** Administration → **Audit log**

## Process 12.1 — Review system activity after go-live

**Start:** Users have been working in workflow and admin modules.  
**End:** You have verified actions for compliance or troubleshooting.

1. Open **Audit log**.
2. Filter or scroll to the date range you care about.
3. Read entries for who did what (workflow submits, admin changes, etc.).
4. Follow up offline with users if something looks wrong.

*(No data entry — read only.)*

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

*Task manual for iBAS++ admin data entry · Process-oriented · 2026*
