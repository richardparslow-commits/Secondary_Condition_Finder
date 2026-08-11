# P3-C Citation & Claim Verification Report

## Scope

This audit distinguishes three different propositions that must not be conflated:

1. **Legal framework** — whether VA law permits a secondary-service-connection theory.
2. **Clinical evidence** — whether medical literature supports an association or mechanism.
3. **Individual nexus** — whether the evidence supports causation or aggravation in a particular veteran's case.

A legal citation such as 38 CFR 3.310 does **not** establish the clinical nexus. Published mappings must not imply otherwise.

## Sources verified during this P3-C pass

| Source | Scope | Verification | Evidence |
|---|---|---|---|
| 38 CFR §3.310(a)-(b) | Legal framework | Verified 2026-08-10 | Secondary service connection for disabilities proximately due to or aggravated by service-connected disease/injury; aggravation requires baseline/current medical evidence. |
| Zhang et al., *Sleep Medicine* (2017), PMID 28735910 | Clinical evidence | Verified 2026-08-10 | Meta-analysis found OSA commonly occurs in people with PTSD; this establishes association/comorbidity, not individual causation. |
| Nitsche et al., *Headache* (2026), PMID 41705319 | Clinical evidence | Verified 2026-08-10 | Systematic review found a positive association between PTSD and migraine across included studies; it does not establish individual-level causation. |
| Brugi et al., *Journal of Sexual Medicine* (2026), PMID 42466890 | Clinical evidence | Verified 2026-08-10 | Systematic review found SSRI-associated sexual dysfunction across studies; it does not establish that an individual veteran's ED was caused by an SSRI. |

## Corrections made

### PTSD → OSA

The previous rationale stated that PTSD could aggravate or proximately cause OSA and cited only 38 CFR 3.310. That was too strong and used a legal authority as though it were medical evidence.

The rationale now describes the evidence as an association and explicitly requires an individual medical nexus. It also identifies the obesity-intermediate-step theory as requiring evidence specific to the veteran.

### PTSD → migraine

The previous rationale described a causal/aggravating relationship based only on 38 CFR 3.310. It now distinguishes the documented PTSD–migraine association from the individual nexus requirement.

### PTSD → erectile dysfunction

The previous rationale asserted that PTSD medications frequently cause ED but provided only 38 CFR 3.310. It now identifies SSRI-associated sexual dysfunction as the clinical evidence and requires medication exposure, timing, diagnosis, and an individual medical nexus.

## Remaining P3-C work

The repository contains many additional published mappings whose source references remain `verified: false`. Those have **not** been mass-promoted to `verified`; doing so without claim-by-claim source review would create false provenance.

Run:

```bash
npm run citations:audit
```

The audit reports every published mapping that still contains unverified sources and every instance where 38 CFR 3.310 is being used in a note that appears to make a medical-causation proposition.

A mapping should only be promoted to verified status when the source actually supports the proposition stated in its note/rationale and the verification metadata is recorded.
