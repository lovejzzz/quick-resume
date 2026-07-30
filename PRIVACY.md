# Privacy and threat model

Quicky Resume is designed so the service never receives a resume.

## Data flow

- Resume fields, photos, and resume variants are stored on the device.
- PDF, Word, text, image, backup, OCR, matching, coaching, fitting, and export
  operations run in the browser.
- There is no account, application database, analytics, advertising, or
  telemetry endpoint.
- The app shell and optional OCR assets are fetched from the same origin.
- A restrictive Content Security Policy limits network connections and image
  sources to the application origin and local `data:`/`blob:` content.

## What users should know

Browser storage is not a cloud backup. Clearing site data, using a temporary
profile, or losing the device can remove the only copy. Quicky Resume keeps a
local recovery snapshot and supports downloadable backups, but users should
store important backups somewhere they control.

Anyone with access to the browser profile may be able to read its local
storage. Use device-level encryption and a locked account on shared computers.

## Untrusted input

Imported documents and backups are treated as untrusted. The application caps
file sizes, PDF page counts, Word archive expansion, backup size, document
count, and embedded photo sources. Imported text remains a first draft that the
user must verify.

## Network verification

Automated production checks verify that the canonical HTTPS URL presents a
valid certificate and contains the expected editor shell. CI also tests that
the core app works with no unintended external data service.
