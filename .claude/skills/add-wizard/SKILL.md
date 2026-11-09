---
name: add-wizard
description: Build a multi-step form (create tenant style) with per-step Zod validation from the generated schemas, a review step, and 409/422 mapping back to the right step. Use for any create flow with more than one step.
---

# Add a wizard

Reference: `apps/tenants/src/CreateTenantWizard.tsx` and its tests `CreateTenantWizard.test.tsx`; ui-kit `Wizard` (`libs/ui-kit/src/Wizard.tsx`).

1. **Schema.** Take the body schema from `@nimbus/api-client/zod` (e.g. `CreateTenantBody`) and derive each step with `.pick({...}).extend({...})` for UI-only rules. Never add `zod` as a dependency of a remote; never re-type the contract.
2. **Steps.** `Wizard` with `steps={[{ id, title, content }]}`; controlled (`step`, `onStepChange`) when you need *Edit* links on the review step or a jump back after a server error. *Next* validates only the current step; errors show on blur or on *Next*.
3. **Review step.** Every value with an `Edit {step}` link (`tenants.wizard.edit`), named so screen-reader users know where it goes.
4. **Submit.** One mutation through the generated function; disable while pending and guard with a ref against double clicks (D7-11). Map the `Problem`:
   - 409 on a field (e.g. `TENANT_NAME_TAKEN`) → jump to that field's step, show the catalogue message at the field;
   - 422 `VALIDATION_FAILED` with `errors[].field` → the same per field;
   - anything else → inline alert in the wizard, values kept; 403 goes to the shell's toast.
   Text always from `messageFor(problem)`, never `problem.detail` (H14).
5. **Close.** Escape on a dirty form asks to discard (a dialog over the wizard closes alone). Focus returns to the button that opened it. A success inserts the new row through the area's cache helper (D7-04) and shows the toast.
6. **Tests.** One per AC (`AC-…:`): blocked *Next*, plan limits, 409 jump, 422 mapping, focus. Stories for each step and the error states.
