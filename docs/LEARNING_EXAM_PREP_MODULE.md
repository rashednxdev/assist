# Learning module — Exam Preparation  
## Field-to-view specification (admin forms → learner input)

**Audience:** Developers, content admins, product owners.  
**Scope:** Exam-prep learning stack only (not salary, workflow, or blood bank).  
**Status:** Documentation of **what exists today**. Build-later gaps → [DEVELOPER_HANDBOOK.md](./DEVELOPER_HANDBOOK.md) Part IX / [GAPS_AND_ROADMAP.md](./GAPS_AND_ROADMAP.md).

| | |
|--|--|
| **Product shape** | Exam-prep / rule library (not a full LMS with course enrollment) |
| **API prefix** | `/api/v1/...` |
| **Schemas** | `packages/shared-types/src/{books,questions,exams,syllabus,papers,qotd,exam-routine,exam-prep,evaluation,user-questions}.ts` |
| **Content ops manual** | [ADMIN_DATA_ENTRY_MANUAL.md](./ADMIN_DATA_ENTRY_MANUAL.md) (task order) |
| **Process overview** | Handbook [Part VI-A](./DEVELOPER_HANDBOOK.md) |

---

## 0. How to read this document

1. **§1** — Access & Part scope (gates every screen).  
2. **§2** — End-to-end learner journey.  
3. **§3–§13** — Per submodule: **admin form fields** → **learner view & inputs** → APIs.  
4. **§14** — Admin pipeline order.  
5. **§15** — Field/UI legend.

**Legend**

| Mark | Meaning |
|------|---------|
| **R** | Required |
| O | Optional |
| EN / BN | English / Bangla content field |
| — | Not bilingual / N/A |

---

## 1. Access & Part scope (serves every learning screen)

### 1.1 What this serves

Controls **who can open** each learning tile and **which exam part’s** content they see.

### 1.2 Module → package map

| Module code | User-facing name | Access today |
|-------------|------------------|--------------|
| `QOTD` | Questions of the Day | **Free** (signed-in) |
| `EXAM_ROUTINE` | Exam Routine | **Free** |
| `LIVE_STREAM` | Live class | **Free** (module) |
| `BOOKS` | Books | **Exam-prep** package (or admin grant) |
| `QUESTIONS` | Question Bank (+ Marathon) | Exam-prep |
| `EXAM` | Exam Programs / Syllabus | Exam-prep |
| `PAPER` | Papers | Exam-prep |
| `EXAM_WEEK` | Exam of the Week | Exam-prep |
| `USER_QUESTIONS` | Submit a Question | Exam-prep |
| `ANSWER_PDF` | Answer PDF sheets | Exam-prep |

Also: module may be **stopped** centrally; unpaid → buy package; admin always open.

### 1.3 Learner inputs (access)

| Surface | What user sees | What user inputs |
|---------|----------------|------------------|
| Web `/packages?tab=exam_prep` | Package cards | Select package → pay |
| Mobile `/(app)/pricing?tab=exam_prep` | Same | Select → pay |
| Locked tile | Access required (unpaid / stopped / denied) | Tap → packages or dismiss |
| Part switcher | Part 1 / Part 2 (etc.) | Select part |

### 1.4 APIs

| Method | Path | Body / notes |
|--------|------|--------------|
| GET | `/exam-prep/parts` | List parts + ownership |
| PUT | `/exam-prep/part` | `{ exam_part_id }` |
| — | Billing entitlements | Via `/billing/...` |

### 1.5 Admin “form” for access (not content)

| Where | Fields / actions |
|-------|------------------|
| Admin → Users → module access | Per module: `can_read`, `can_create`, `can_update`, `can_delete`, `can_publish`, `can_grade`, optional `expires_at` |
| Admin → Packages | Package kind `exam_prep` + subjects / all subjects |

**After grant/purchase:** user should **log out and log in** (or refresh session) to refresh menus.

---

## 2. End-to-end learner journey (presentation)

```
0. Login
1. Get access (free tiles and/or Exam-prep package / grant)
2. Select Exam Part (Part 1 / 2 / …)
3. Calendar: Exam Routine (free)
4. Daily: QOTD (free)
5. Study: Books + Syllabus
6. Practice: Question Bank + Marathon
7. Test: Papers (timed MCQ on mobile) + Exam Week
8. Progress dashboard (+ mobile Saved / History)
9. Optional: Submit a Question
```

---

## 3. Exams hierarchy (frames everything)

**Serves:** Define department → authority → exam → session → part → type → **subject** (join key for books, questions, papers, QOTD, syllabus).

### 3.1 Admin views

| Route | Purpose |
|-------|---------|
| `/exams/admin` | Full hierarchy CRUD |
| `/exams`, `/exams/[id]` | Learner browse (also used to reach syllabus) |

### 3.2 Admin form fields

#### Department
| Field | Req | UI label | EN/BN |
|-------|-----|----------|-------|
| `name` | **R** | Department name | EN |
| `short_name` | **R** | Short name | — |
| `identity` | O | Identity | — |
| `location` | O | Location | — |
| `address` | O | Address | — |
| `website` | O | Website | — |

#### Authority
| Field | Req | UI label |
|-------|-----|----------|
| `department_id` | **R** | (parent) |
| `name` | **R** | Authority name |
| `authority_type` | **R** | `central` / `regional` / `departmental` |
| `description` | O | Description |
| `contact_email` | O | Email |
| `contact_phone` | O | Phone |

#### Exam name
| Field | Req | UI label | EN/BN |
|-------|-----|----------|-------|
| `authority_id` | **R** | (parent) | — |
| `name` | **R** | Exam name | EN |
| `name_bn` | O | Exam name (Bangla) | BN |
| `short_name` | **R** | Short name | EN |
| `short_name_bn` | O | Short name (Bangla) | BN |
| `registration_fee` | **R** | Registration fee | — |
| `goal` | O | Goal | — |
| `description` | O | Description | — |
| eligibility / passing / attempts | O | (schema) | — |

#### Session
| Field | Req | UI label |
|-------|-----|----------|
| `exam_name_id` | **R** | (parent) |
| `label_en` | **R** | Label (English) |
| `label_bn` | O | Label (Bangla) |
| `sort_order` | O | Sort order |

#### Part
| Field | Req | UI label | EN/BN |
|-------|-----|----------|-------|
| `exam_name_id` | **R** | (parent) | — |
| `name` | **R** | Part name | EN |
| `name_bn` | O | Part name (Bangla) | BN |
| `part_number` | **R** | Part number | — |
| `total_marks` | **R** | Total marks | — |
| `pass_marks` | **R** | Pass marks | — |
| `total_marks_bn` / `pass_marks_bn` | O | Bangla display | BN |
| `description` | O | Description | — |

#### Type
| Field | Req | UI label |
|-------|-----|----------|
| `exam_name_id` | **R** | (parent) |
| `name` | **R** | Type name |
| `code` | O | Code |
| `total_marks` | **R** | Total marks |
| `pass_marks` | **R** | Pass marks |
| `total_time` | **R** | Duration (minutes) |
| `description` / `note` | O | — |

#### Subject (**central join**)
| Field | Req | UI label | EN/BN |
|-------|-----|----------|-------|
| `exam_part_id` | **R** | Part | — |
| `exam_type_id` | **R** | Type | — |
| `name` | **R** | Subject name | EN |
| `name_bn` | O | Subject name (Bangla) | BN |
| `total_marks` | **R** | Total marks | — |
| `pass_marks` | **R** | Pass marks | — |
| `*_bn` marks | O | Bangla marks display | BN |

**Status:** no `is_published`; soft `is_active` on updates.

### 3.3 Learner view & inputs

| Route (web) | Route (mobile) | Sees | Inputs |
|-------------|----------------|------|--------|
| `/exams` | `/(app)/exams` | Program cards (name, authority, fee, goal) | Tap program |
| `/exams/[id]` | `/(app)/exams/[id]` | Parts → subjects (marks/pass) | Tap subject → syllabus |
| `/exams/subjects/[subjectId]/syllabus` | `/(app)/exams/subjects/[subjectId]` | Syllabus tree + book refs | Tap ref → book/chapter/rule |

**Access:** `EXAM` → exam_prep package.

**APIs:** `GET /exams/names`, `/exams/names/:id/tree`, `/exams/subjects/:id`.

---

## 4. Books (rules library)

**Serves:** Read acts/rules/chapters before drilling questions.

### 4.1 Admin routes

| Path | Role |
|------|------|
| `/books/admin` | Types + books + publish |
| `/books/[id]` | Content editor (chapters/topics) |
| `/books/regulations`, `/books/regulations/[id]` | Regulations |

### 4.2 Admin form fields

#### Book type
| Field | Req | UI label | EN/BN |
|-------|-----|----------|-------|
| `name` | **R** | Name (English) * | EN |
| `name_bn` | **R** | Name (Bengali) * | BN |
| `code` | **R** | Code * (`A-Z0-9_`) | — |
| `description` | O | Description | — |
| `sort_order` | O | Sort order | — |
| `icon` / `notes` | O | — | — |

#### Book
| Field | Req | UI label | EN/BN |
|-------|-----|----------|-------|
| `book_type_id` | **R** | Book type * | — |
| `name` | **R** | Title (English) * | EN |
| `name_bn` | **R** | Title (Bengali) * | BN |
| `short_name` | O | Short code | — |
| `description` | O | Description | — |
| `edition` | O | Edition | — |
| `published_by` | O | Published by | — |
| `language` | O (default `both`) | Language | — |
| `tags` | O | Tags (comma-separated) | — |
| `is_part` | O | Part flag | — |
| `cover_image_url` | O | — | — |

**Publish:** `is_published` via Publish / Unpublish on `/books/admin`.

#### Chapter
| Field | Req | UI label |
|-------|-----|----------|
| `chapter_number` | **R** | Chapter no. |
| `name` | O | Chapter title |
| `sub_name` | O | Sub-title |
| `description` | O | Description |
| `sort_order` | O | Sort |

#### Topic (rule)
| Field | Req | UI label |
|-------|-----|----------|
| At least one of `name` / `rule_number` / `description` | **R** (group) | — |
| `rule_number` | O | Rule no. |
| `name` | O | Title |
| `description` | O | Details |
| `note` | O | Note |
| `content_link` | O | Page/content link |
| `table` | O | Comparison table |
| `effective_date` | O | Effective date |

#### Sub-topic
| Field | Req | UI label |
|-------|-----|----------|
| At least one of name / rule_number / description | **R** (group) | Sub-rule no., Title, Details |

#### Regulation
| Field | Req | UI label |
|-------|-----|----------|
| `book_info_id` | **R** | (book context) |
| `book_chapter_id` / `book_topic_id` | O | Chapter / rule link |
| `regulation_no` | **R** | Regulation no. * |
| `title` | **R** | Title * |
| `full_text` | **R** | Full text * |
| `regulation_type` | **R** | `rule` / `circular` / `sro` / `act_section` / `order` |
| `effective_date` | **R** | Effective date |
| `applicable_to` | **R** (min 1) | Applicable to |
| `payment_related` / `receipt_related` | O | Flags |
| `tags` | O | Tags |

#### Book ↔ subject link
| Field | Req | UI |
|-------|-----|-----|
| `exam_subject_id` | **R** | + Subject… |
| `sort_order` | O | Sort |

### 4.3 Learner view & inputs

| Route (web) | Route (mobile) | Sees | Inputs |
|-------------|----------------|------|--------|
| `/books` | `/(app)/books` | Catalog cards (type, tags, subjects) | Search; subject filter; open book |
| `/books/[id]` | `/(app)/books/[bookId]` | Description, subjects, TOC | Open chapter / rule |
| `/books/.../chapter/...` | `.../chapter/...` | Chapter content | Scroll; open rules |
| `/books/.../rule/...` | `.../rule/...` | Rule text; linked questions | Open questions; mobile: save bookmark |
| `/books/[id]/progress` | (eval UI) | Book progress | — |
| `/books/regulations` | `/(app)/books/regulations` | Regulation search | Search; open detail |

**Access:** `BOOKS` → exam_prep.  
**APIs:** `GET /books`, `/books/:id/reader-outline`, `/books/:id/reader-full`, topics, subject-links, regulations search.

---

## 5. Syllabus

**Serves:** Map subject topics → book references.

### 5.1 Admin

| Route | Purpose |
|-------|---------|
| `/exams/subjects/[subjectId]/syllabus` | Tree builder (groups → topics → sub-topics → references) |

#### Group
| Field | Req | UI label |
|-------|-----|----------|
| `exam_subject_id` | **R** | (subject) |
| `name` | **R** | Group name |
| `marks_allocated` | **R** | Marks allocated |
| `sort_order` | O | Sort |

#### Topic
| Field | Req | UI label |
|-------|-----|----------|
| `name` | **R** | Topic name |
| `syllabus_group_id` **or** `exam_subject_id` | **R** (exactly one) | Parent |
| `description` | O | Description |
| `marks_weightage` | O | Marks weightage |

#### Sub-topic
| Field | Req | UI label |
|-------|-----|----------|
| `syllabus_topic_id` | **R** | (topic) |
| `name` | **R** | Sub-topic name |
| `description` | O | Description |

#### Reference
| Field | Req | UI label |
|-------|-----|----------|
| `syllabus_topic_id` | **R** | (topic) |
| `exam_subject_id` | **R** | Subject |
| `ref_level` | O | `book` / `chapter` / `rule` / `regulation` |
| `book_info_id` | O | Book |
| `book_chapter_id` | O | Chapter |
| `book_topic_id` | O | Rule / book topic |
| `regulation_id` | O | Regulation |
| `relevance_note` | O | Relevance note |

**Status:** `is_active` (no publish flag).

### 5.2 Learner view & inputs

Same subject syllabus routes as §3.3 — tree + tappable book refs.  
**APIs:** `GET /syllabus/subjects/:subjectId/tree`.

---

## 6. Questions (Question Bank)

**Serves:** Drill MCQ / true-false / descriptive items; feed papers & QOTD.

### 6.1 Admin routes

| Path | Role |
|------|------|
| `/questions/new` | Create |
| `/questions` | List, filters, batch import, review actions |
| `/questions/[id]` | Edit / publish workflow |
| `/questions/trash` | Soft-deleted |

### 6.2 Admin form fields (`question-editor`)

| Field | Req | UI label | EN/BN | Notes |
|-------|-----|----------|-------|-------|
| `question_type_id` | **R** | Type * | — | MCQ / TF / descriptive / differences |
| `body_en` | **R** | Question * | EN | UI may mirror BN→EN |
| `body_bn` | O | (same / Bangla) | BN | |
| `difficulty` | **R** | Difficulty | — | `easy` / `medium` / `hard` |
| `marks` | **R** | Marks | — | |
| `negative_marks` | O | Negative marks | — | |
| `time_seconds` | **R** | Time (seconds) | — | |
| `language` | O | Language | — | default `both` |
| `options[]` | MCQ **R** | Answer options * | `option_text_en` **R**, `option_text_bn` O | keys `a`–`e` |
| `correct_option_key` | MCQ **R** | Correct option (radio) | — | |
| `correct_true_false` | TF **R** | Correct answer (True/False) * | — | |
| `explanation_sections` | O | Explanation | title/details/note | |
| `model_answer_sections` | O | Model / short answer | same | |
| `model_answer_comparison` | O | Differences table | — | |
| `circular_ids` | O | Tagged circulars | — | |
| `mother_question_id` | O | Link another Q’s answer | — | |
| `note` | O | Note | — | |

#### Book links (conditional)
| Field | Req | UI label |
|-------|-----|----------|
| `link_level` | when linking | `chapter` / `rule` / `sub_rule` |
| Book | **R** if linking | Book |
| Chapter | **R** if linking | Chapter |
| `book_topic_id` | if rule/sub_rule | Rule |
| Sub-topic | if sub_rule | Sub-rule |
| Regulation | O | Regulation |

#### Subject tags
| Field | Req | UI |
|-------|-----|-----|
| `exam_subject_id` | **R** per tag | + Subject… |

### 6.3 Publish / status

| State | Meaning |
|-------|---------|
| `review_status`: `draft` | Editable |
| `quality_check` | Submitted for QC |
| `published` | Live (`is_published` true) |
| Trash | Soft-delete → unpublished + draft |

Actions: submit for QC → publish / return to draft / unpublish.

### 6.4 Learner view & inputs

| Route (web) | Route (mobile) | Sees | Inputs |
|-------------|----------------|------|--------|
| `/questions` | `/(app)/questions` | Filtered bank list | Search; filters (difficulty, type, book, subject, sort); open Q |
| `/questions/[id]` | `/(app)/questions/[id]` | Stem, options, explanation | Show/Hide answer; **mobile:** select MCQ → submit eval; self-rating (Overall / Understand / Confidence); next; save |

**Self-rating values (evaluation):** overall ~50% · understand ~75% · confidence ~100%.

**Access:** `QUESTIONS` → exam_prep (QOTD-opened questions may bypass QUESTIONS grant).  
**APIs:** `GET /questions`, types, catalogs, `:id`; `PUT /evaluation/questions/:id`; mobile `GET /questions/sync`.

---

## 7. Marathon

**Serves:** Fast short Q&A review grouped by book/chapter.

| | Web | Mobile |
|--|-----|--------|
| Route | `/marathon` | `/(app)/marathon` |
| Sees | Grouped teasers; reveal answer | + filters, save, resume |
| Inputs | Search; book filter; reveal / show-all | Same + save |
| API | `GET /questions/marathon-review` | Local sync cache |
| Access | `QUESTIONS` → exam_prep | Part-scoped |

---

## 8. Papers (practice / model tests)

**Serves:** Exam-like sheets; **timed MCQ attempt on mobile**.

### 8.1 Admin routes

| Path | Role |
|------|------|
| `/papers/new` | Create metadata |
| `/papers` | List + inline edit |
| `/papers/[id]/edit` | Composer: sections, bank questions, publish, exam-week |

### 8.2 Admin form fields

#### Paper
| Field | Req | UI label |
|-------|-----|----------|
| `exam_subject_id` | **R** | Subject (via Exam → Session → Subject) |
| `paper_type_id` | **R** | Paper type |
| `name` | **R** | Paper name |
| `exam_session_id` | **R** | Session / Year / Training |
| `total_marks` | **R** | Total marks |
| `pass_marks` | **R** | Pass marks |
| `duration_minutes` | **R** | Duration (minutes) |
| `instructions` | O | Instructions |

#### Section (group)
| Field | Req | UI label |
|-------|-----|----------|
| `name` | **R** | Section name |
| `group_number` | **R** | Section number |
| `marks` | **R** | Section marks |
| `instructions` | O | Instructions |

#### Paper question
| Field | Req | UI label |
|-------|-----|----------|
| `from_question_bank` | default | Bank picker |
| `question_id` | **R** if bank | Published bank question |
| `paper_group_id` | O | Section |
| `question_number` | **R** | Serial order |
| `display_question_number` | O | Display number on paper |
| `header_text` | O | Question header |
| `marks` | **R** | Marks allocation |
| `marks_display_bn` | O | Marks display (Bangla) |
| `is_compulsory` | default true | Compulsory |

Child parts: `part_label`, `marks`, optional `marks_display_bn`.

### 8.3 Publish channels

| Channel | Fields / action |
|---------|-----------------|
| Practice | `is_published` — Publish / Unpublish |
| Exam of the Week | `is_exam_of_week`, `exam_week_date`, `exam_week_publish_time` |

### 8.4 Learner view & inputs

| Route (web) | Route (mobile) | Sees | Inputs |
|-------------|----------------|------|--------|
| `/papers` | `/(app)/papers` | Paper list (marks, duration, count) | Filters; open paper |
| `/papers/[id]` | `/(app)/papers/[id]` | Bangla-style sheet / sections | Tap question → answer |
| `/papers/[id]/questions/[qid]` | → question detail | Evaluator | MCQ / self-rate |
| — | **Timed MCQ UI** | Preview → Start/Retake → countdown | Select options → Submit → score |
| `/papers/[id]/progress` | inline | Progress / attempts | Open results |

**Timed exam API:** `POST /evaluation/papers/:id/attempts` `{ answers[], duration_seconds? }`.  
**Access:** `PAPER` → exam_prep (or `EXAM_WEEK` when opened from week).  
**Gap:** Web has **no** countdown timed UI yet.

---

## 9. Exam Week

**Serves:** Time-boxed set of published papers.

| | Admin | Learner |
|--|-------|---------|
| Where | Paper composer → Publish date/time for exam-week | `/exam-week`, `/exam-week/[weekStart]` (web + mobile) |
| Fields | `exam_week_date` **R**, `exam_week_publish_time` O | — |
| Sees | — | Weeks list → paper cards |
| Inputs | — | Tap week → tap paper → Process §8.4 |
| APIs | `POST .../publish-exam-week` | `GET /papers/exam-week/weeks`, `.../weeks/:weekStart` |
| Access | Admin publish | `EXAM_WEEK` → exam_prep |

---

## 10. QOTD (Questions of the Day)

**Serves:** Daily free practice.

### 10.1 Admin

| Route | Fields / UI |
|-------|-------------|
| `/qotd/admin` | Dates list; settings `show_past_days` (0–365) |
| `/qotd/admin/[date]` | Per date |

| Field | Req | UI label |
|-------|-----|----------|
| `exam_subject_id` | **R** | Subject |
| `date` | **R** | Date (YYYY-MM-DD) |
| `publish_time` | O (default `00:00`) | Publish time |
| `question_ids` | **R** (1–50) | Search/select **published** subject-tagged questions |

Visibility = date + `publish_time` (not a separate `is_published`).

### 10.2 Learner

| Route | Sees | Inputs |
|-------|------|--------|
| `/qotd` · `/(app)/qotd` | Dates: Today / Yesterday / This week / Earlier | Tap date |
| `/qotd/[date]` · mobile same | Subjects → question teasers | Tap → question detail |

**Access:** **Free** (`QOTD`). Part-scoped.  
**APIs:** `GET /qotd/dates`, `/qotd/dates/:date`.

---

## 11. Exam Routine

**Serves:** Free countdown calendar.

### 11.1 Admin

| Route | Fields |
|-------|--------|
| `/exam-routine/admin` | Create: `exam_name_id` **R**, `start_date` **R**, `start_date_note` O |
| `/exam-routine/admin/[id]` | Entries |

#### Entry
| Field | Req | UI label |
|-------|-----|----------|
| `exam_subject_id` | **R** | Subject |
| `date` | **R** | Date |
| `time` | **R** | Time |
| `instruction` | O | Instruction |
| `sort_order` | O | Sort |

### 11.2 Learner

| Route | Sees | Inputs |
|-------|------|--------|
| `/exam-routine` · mobile | Exam cards + countdown | Tap routine |
| `/exam-routine/[id]` · mobile | Hero countdown; subject rows (date, time, instructions) | Expand instructions |

**Access:** **Free**.  
**APIs:** `GET /exam-routine/list`, `/exam-routine/names/:examNameId`.

---

## 12. Evaluation & Progress

**Serves:** Personal practice state (not instructor grading).

### 12.1 Learner inputs (no admin content form)

| Context | Input | API |
|---------|-------|-----|
| MCQ practice | `selected_option_id` | `PUT /evaluation/questions/:id` |
| Descriptive | `self_rating`: `overall` / `understand` / `confidence` | same |
| Timed paper (mobile) | `answers[]`, `duration_seconds` | `POST /evaluation/papers/:id/attempts` |

### 12.2 Progress view

| Route | Sees | Inputs |
|-------|------|--------|
| `/progress` · `/(app)/progress` | MCQs answered, accuracy, papers started, attempt list | Refresh; open paper from results |

**API:** `GET /evaluation/dashboard`.  
**Access:** authenticated (not package-gated).

---

## 13. User-submitted questions

**Serves:** Learner proposes a question; admin links or rejects.

### 13.1 Learner form

| Field | Req | UI label |
|-------|-----|----------|
| Exam | **R** | Exam select |
| `exam_subject_id` | **R** | Subject |
| `body` | **R** (5–2000 chars) | Question |

| Route | Sees | Inputs |
|-------|------|--------|
| `/user-questions` | Form + my list (pending/accepted/rejected) | Submit; open linked Q if accepted |
| Mobile list + `/user-questions/new` | Same | Confirm dialog; limit note (~10/subject) |

**API:** `POST /user-questions`, `GET /user-questions/mine`.  
**Access:** `USER_QUESTIONS` → exam_prep.

### 13.2 Admin review

| Route | Actions / fields |
|-------|------------------|
| `/user-questions/admin` | Tabs by status |
| Accept | `linked_question_id` **R** (published bank Q) |
| Reject | `admin_note` O (max 500) |

---

## 14. Mobile-only: Saved & History

| Screen | Route | Sees | Inputs | Storage |
|--------|-------|------|--------|---------|
| Saved hub | `/(app)/saved` | Counts | Open lists | Device |
| Saved books/questions/marathon | `.../books` etc. | Bookmarks | Open item | Device |
| History | `/(app)/history` | ≥5s answer dwell | Search/filter/remove; PDF if entitled | SQLite |

**No server sync today** (Part IX). Web has no equivalent.

---

## 15. Admin content pipeline (order that serves learners)

| Order | Admin job | Unlocks learner |
|-------|-----------|-----------------|
| 1 | Users + exam_prep grants / packages | Access |
| 2 | Exams hierarchy → subjects | Part scope, syllabus, papers, QOTD |
| 3 | Books (+ publish) + subject links | Books reader |
| 4 | Questions (+ publish) + book/subject links | Bank, marathon, paper bank picks, QOTD |
| 5 | Syllabus for subject | Syllabus view |
| 6 | Papers (+ publish / exam-week) | Papers & Exam Week |
| 7 | QOTD entries + Exam routine | Daily + calendar |

---

## 16. Quick API index (learning)

| Area | Prefix |
|------|--------|
| Exam-prep part | `/exam-prep` |
| Books | `/books` |
| Questions | `/questions` |
| Exams | `/exams` |
| Syllabus | `/syllabus` |
| Papers (+ exam-week) | `/papers` |
| QOTD | `/qotd` |
| Exam routine | `/exam-routine` |
| Evaluation | `/evaluation` |
| User questions | `/user-questions` |

---

## 17. One-page presentation summary

| Layer | What we serve | User does |
|-------|---------------|-----------|
| Access | Free QOTD/Routine + paid Exam-prep set | Buy/grant → Part switch |
| Structure | Exam → Part → Subject | Browse programs / syllabus |
| Study | Books + regulations | Read TOC → rules |
| Practice | Questions + Marathon | Filter → answer → rate |
| Daily | QOTD | Open today’s items |
| Calendar | Exam routine | Watch countdown |
| Test | Papers + Exam Week | Sit sheet; **mobile timed MCQ** |
| Feedback | Progress | Review accuracy / attempts |
| Contribute | User questions | Submit → admin accept/reject |

**Honest product name:** Exam Preparation learning module (exam-prep package) — **not** a full LMS with enrollment/certificates (those are documented for later only).

---

*Update this file when admin form fields or learner screens change. Link from DEVELOPER_HANDBOOK Part VI-A.*
