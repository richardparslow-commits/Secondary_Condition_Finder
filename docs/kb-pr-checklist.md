# Knowledge Base Mapping PR Data QA Checklist

Before merging any pull request modifying files under `data/knowledge-base/`, verify the following items:

- [ ] **Citation Presence:** Every suggestion includes valid 38 CFR regulatory references (e.g., `38 CFR 3.310`, `38 CFR 4.71a`).
- [ ] **Unverified Flag Enforcement:** All citations explicitly include `"verified": false` to indicate they require professional medical/legal validation.
- [ ] **No Placeholders:** Zero instances of `TODO`, `TBD`, or placeholder text exist if `draft: false`.
- [ ] **Rank Continuity:** Suggestion ranks are strictly unique, gapless, and start at `1` (`1, 2, 3...`).
- [ ] **Non-Self Reference:** No condition references its own ID as a secondary condition (`conditionId !== primaryId`).
- [ ] **Evidence Gap Depth:** Each suggestion outlines at least one actionable clinical evidence gap or diagnostic requirement.
- [ ] **Test Suite Green:** Running `npm test` passes all 83+ automated tests successfully without schema validation errors.
