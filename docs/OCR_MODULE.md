# PDF to Word (OCR module)

Converts uploaded PDF files to editable **Word (.docx)** documents.

## How it works

1. **Text PDFs** — Extracts embedded text (`pdf-parse` / PDF.js) and builds a `.docx` with one section per page.
2. **Scanned PDFs** — Renders each low-text page to an image and runs **Tesseract OCR** (default languages: `eng+ben`).
3. **Mixed** — Per-page: text extraction when possible, OCR otherwise.

## API

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/v1/ocr/info` | Bearer token |
| POST | `/api/v1/ocr/pdf-to-word` | Bearer token, `multipart/form-data`, field `pdf` |

Response: `.docx` file download with headers `X-Conversion-Pages`, `X-Conversion-Method` (`text` \| `ocr` \| `mixed`).

## Web UI

**Tools → PDF to Word** (`/tools/pdf-to-word`)

Requires **OCR** module access (or super admin). Run `pnpm seed` to register the `OCR` module, then grant access to users.

## Environment (`apps/api/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `OCR_MAX_FILE_MB` | `15` | Max upload size |
| `OCR_LANGUAGES` | `eng+ben` | Tesseract language codes |
| `OCR_MIN_TEXT_CHARS` | `40` | Below this per page → OCR |

## Limitations

- Layout, tables, images, and headers/footers are **not** preserved—output is editable **text in paragraphs**.
- Large scanned PDFs can be slow (OCR per page).
- Bengali OCR quality depends on scan quality and fonts.

## Dependencies

Installed with `@ibas/api`: `pdf-parse`, `pdfjs-dist`, `@napi-rs/canvas`, `tesseract.js`, `docx`, `multer`.

First OCR run downloads Tesseract language data (~tens of MB); cached afterward.
