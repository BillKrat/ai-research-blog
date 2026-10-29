# Decision 2026-10: no audit trail, and no regulated use

**Decided by the owner, 2026-10-29.** Applies to `ai-research-blog` and `Adventures.Foundation`.

## Decision
1. **The software ships no audit trail and makes no audit claim.** The `AuditRecord` schema, the rows the repository wrote on every change, the acting-user ("changedBy") plumbing that fed them and the planned audit history screen are removed or dropped. Nothing in the product, the documents or the messages may present an audit trail, a compliance feature or a regulatory capability.
2. **Regulated use is outside the licence.** The Additional Use Grant gains a third condition (no Regulated Use), and `NOTICE` carries the full "Regulatory disclaimer and field of use" text. The definition is generic: any use that is subject to, or must satisfy, a law, regulation, standard, certification or oversight body, in any field. Health care and clinical research are named only as examples next to finance, safety-critical, government and others. The README states it plainly.

## Why
- An audit trail, even a partial one, invites the reading that the software meets a requirement (a validated system, 21 CFR Part 11 style records). It does not, and presenting it as a feature creates a misunderstanding the owner must prevent.
- A regulated deployment turns the software itself into part of a regulatory review. The licensor cannot offer a licence for that and does not want the product to look as if it could be used that way.

## What stays
- `Lifecycle` markers (a deleted entity and a superseded value are not physically removed) are storage mechanics: no actor, no tamper evidence, no claim. They are described that way in the code comment.
- Acting-user checks that protect administrators (the self-lockout guard, the rights editor, the last-administrator rule) stay; they are access safety, not an audit log.
- The exception log, health and diagnostics are operational tooling, not an audit record.
- Collaboration items keep their own author, time and approval fields; they are a review workflow, not an audit trail.

## What changed in storage, and what did not
- New and fresh installs no longer define the `AuditRecord` schema and write no audit rows.
- **Existing stores keep the `AuditRecord` rows already written** (including the live store). Nothing was deleted from any live data; the rows are simply no longer written or read. Deleting them is a separate, explicit data step if the owner wants it.
- The reference sandbox `poc` is frozen and still contains the schema; it is a reference, not part of the product.

## Consequences to accept
- Who made a given data change is no longer recorded. Accountability for admin actions rests on the access rules, the rights model and the operational logs, not on a change history.
- The licence text is under attorney review; a version already released keeps the terms it was released under.
