# Implementation Plan - Project Shield Passive Inspector

## 1. Overview

Implement a "Passive Inspector" workflow that monitors a directory, cryptographically verifies PDF deeds, appends a Certificate of Integrity to valid documents, and escalates flagged documents via email.

## 2. Component Updates

### A. `apps/watcher` (The Inspector)

- **Dependencies**: Add `chokidar`, `axios`, `pdf-lib`, `dotenv`, `form-data` (if sending files), and link `@deed-shield/core`.
- **Configuration**: Load `SOURCE_DIR` and `API_URL` from `.env`.
- **Ingest Logic**:
  - Monitor `SOURCE_DIR` for new `.pdf` files.
  - **Zero-Storage**: Read file into memory (`Buffer`).
  - **Cryptographic Integrity**: Compute SHA-256 (Keccak-256) hash using `packages/core` utilities.
- **Verification**:
  - Send payload (Meta + Hash) to `apps/api`.
- **Action Logic**:
  - **If PASS (`ALLOW`)**:
    - Use `pdf-lib` to create a new PDF buffer.
    - Copy pages from source.
    - Append a standardized "Certificate of Integrity" page containing the Receipt Hash and Timestamp.
    - Write to `[OriginalFilename]_verified.pdf` (to avoid infinite watch loops on absolute overwrite, or use a separate `PROCESSED_DIR`).
  - **If FLAG/BLOCK**:
    - Log alert.
    - (API handles the email escalation).

### B. `apps/api` (The Brain)

- **Database Schema**:
  - Add `Organization` model to `prisma/schema.prisma`:
    ```prisma
    model Organization {
      id          String   @id @default(uuid())
      name        String
      adminEmail  String
      createdAt   DateTime @default(now())
    }
    ```
- **Escalation Logic**:
  - Modify `POST /verify`.
  - If `decision` is `FLAG` or `BLOCK`:
    - Query the _Logic assumes single tenant or default_ `Organization`.
    - "Send" Email: Log a structured alert to stdout simulating an email to `adminEmail` with the subject "Deed Shield Alert: [Risk Score] [Reasons]".

### C. `packages/core` (The Standard)

- Ensure `keccak256Buffer` and `signReceipt` (already added) are exported and usable by `watcher`.

## 3. Step-by-Step Execution

1.  **Schema Update**: Add `Organization` to `apps/api/prisma/schema.prisma` and push db.
2.  **API Logic**: Implement Organization lookup and email logging in `apps/api/src/server.ts`.
3.  **Watcher Setup**:
    - Initialize `apps/watcher/package.json` with correct dependencies.
    - Implement `apps/watcher/src/inspector.js` (or update `index.js`) with `chokidar`, `pdf-lib`, and API integration.
    - Implement the "Certificate of Integrity" page generation using `pdf-lib`.

## 4. Risks & Mitigations

- **Infinite Loops**: Writing to the watched directory.
  - _Mitigation_: Ignore files ending in `_verified.pdf` in `chokidar` config.
- **Memory Usage**: Large PDFs in memory.
  - _Mitigation_: Node.js buffers handle reasonably sized deeds (5-20MB). For massive files, streams would be needed, but "Zero-Storage" mandates memory processing.
- **Hallucinations**:
  - _Check_: Do we have an email provider? No.
  - _Solution_: Log to stdout "MOCK EMAIL SENT TO [email]".

## 5. Verification

- Run `api`.
- Run `watcher`.
- Drop a "Good" PDF -> Check for `_verified.pdf` with appended page.
- Drop a "Bad" PDF (hash mismatch or policy flag) -> Check API logs for "Sending Email".
