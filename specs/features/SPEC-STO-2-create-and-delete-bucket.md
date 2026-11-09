---
id: SPEC-STO-2
title: "Create and delete bucket"
area: storage
day: 8
implements: [US-8.1]
---

# SPEC-STO-2 — Create and delete bucket [MVP]

Shared rules: [mf-contract](../shared/mf-contract.md) · [realtime](../shared/realtime.md) · [rbac](../shared/rbac.md) · [url-conventions](../shared/url-conventions.md) · [messages-and-format](../shared/messages-and-format.md)

**Implements:** US-8.1

**Behaviour**
- Create dialog: Name (S3 naming rules: 3–63 chars, lowercase, digits, dots, hyphens; no `..`; not IP-formatted), Versioning toggle.
- Delete requires typing the bucket name; only empty buckets can be deleted (`409 BUCKET_NOT_EMPTY` otherwise). *Delete* is offered for every bucket; the 409 shows inline and the dialog stays open, which also covers stale rows (D8-01).

**Acceptance criteria**

| ID | Criterion | Status |
|---|---|---|
| **AC-STO-2.1** | Name "My_Bucket" shows the field error `storage.bucketNameInvalid` "Use 3–63 lowercase letters, numbers, dots and hyphens." before submit. | `done` |
| **AC-STO-2.2** | Name "192.168.1.1" is rejected with `storage.bucketNameIp` "Bucket names can't look like IP addresses." | `done` |
| **AC-STO-2.3** | Creating a bucket when quota is fully used (e2e: `POST /api/__test/set-usage`) shows `errors.QUOTA_EXCEEDED` "Storage quota is full. Free up space or ask an admin to raise the quota." in the dialog. | `done` |
| **AC-STO-2.4** | Deleting a non-empty bucket shows `errors.BUCKET_NOT_EMPTY` "Empty the bucket before deleting it." | `done` |
| **AC-STO-2.5** | Deleting an empty bucket after typing its exact name removes it from the list and shows `storage.toast.deleted` "Bucket {name} deleted." (D8-15) | `done` |
| **AC-STO-2.6** | Creating a bucket with *Versioning* on shows it in the list with Versioning "On". (D8-15) | `done` |
