# Storage Security Hardening

## Changes Made

### 1. Magic Byte / File Signature Validation
Added `validateFileSignature()` to `lib/supabase/storage.ts` which checks actual file content bytes against known signatures (magic bytes) for:
- JPEG (`0xFF 0xD8 0xFF`)
- PNG (`0x89 0x50 0x4E 0x47`)
- GIF (`0x47 0x49 0x46 0x38`)
- WebP (`0x52 0x49 0x46 0x46` + `0x57 0x45 0x42 0x50`)
- PDF (`0x25 0x50 0x44 0x46`)

`validateFile()` now accepts an optional `fileBuffer` parameter. When provided, the function performs byte-level signature verification in addition to extension and MIME checks. This prevents renamed `.exe`/`.bat`/`.html` files from bypassing type restrictions.

### 2. SVG Removed from Image Types
SVG files were allowed in `image` and `logo` categories. SVGs can contain embedded JavaScript (`<script>`, `onload=`) and pose XSS risks when served in a browser context. SVG removed from:
- `ALLOWED_FILE_TYPES.image`
- `ALLOWED_FILE_TYPES.logo`

If SVG support is needed in the future, SVGs must be sanitized before storage (e.g., using `DOMPurify` or `svg-sanitizer`).

### 3. Rate Limiting on Upload Endpoint
Added per-user rate limit to `POST /api/upload`: **30 requests per 60 seconds**. This prevents abuse of the upload API by a single user.

### 4. Content-Type Enforcement
The upload endpoint now derives `Content-Type` from the validated extension-to-MIME mapping (`EXTENSION_TO_MIME`) rather than trusting the browser-provided `file.type`, which can be trivially spoofed.

### 5. Signed URL Removal
The upload endpoint no longer generates a signed URL alongside the public URL. Since the bucket is configured as `public: true`, signed URLs provide no additional security and create misleading security semantics.

## Remaining Gaps (Requiring Infrastructure Changes)

| Gap | Impact | Mitigation Needed |
|-----|--------|-------------------|
| **Public bucket** | All files world-readable | Create separate private bucket for sensitive docs (reports, exams), serve via signed URLs only |
| **No malware scanning** | Malicious files could be stored | Integrate ClamAV or VirusTotal API in upload pipeline |
| **No per-school/suer quotas** | Unlimited storage consumption | Track upload bytes per school in DB, enforce at upload time |
| **No request body size middleware** | Large uploads consume memory | Add `bodyParser` limit or middleware check |
| **SVG support blocked** | Some schools may use SVG logos | Re-add SVG with sanitization pipeline |
