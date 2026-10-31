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
- Delete requires typing the bucket name; only empty buckets can be deleted (`409 BUCKET_NOT_EMPTY` otherwise).

**Acceptance criteria**

| ID | Criterion | Status |
|---|---|---|
| **AC-STO-2.1** | Name "My_Bucket" shows the field error `storage.bucketNameInvalid` "Use 3–63 lowercase letters, numbers, dots and hyphens." before submit. | `planned` |
| **AC-STO-2.2** | Name "192.168.1.1" is rejected with `storage.bucketNameIp` "Bucket names can't look like IP addresses." | `planned` |
| **AC-STO-2.3** | Creating a bucket when quota is fully used (e2e: `POST /api/__test/set-usage`) shows `errors.QUOTA_EXCEEDED` "Storage quota is full. Free up space or ask an admin to raise the quota." in the dialog. | `planned` |
| **AC-STO-2.4** | Deleting a non-empty bucket shows `errors.BUCKET_NOT_EMPTY` "Empty the bucket before deleting it." | `planned` |
