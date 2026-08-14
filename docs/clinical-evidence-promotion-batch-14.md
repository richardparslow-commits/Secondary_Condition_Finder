# Clinical Evidence Promotion Batch 14

Batch 14 preserves the exact **300 catalog / 300 knowledge-base** integrity contract while repairing the published `sleep-apnea` mapping, which previously relied only on rating-schedule and secondary-service-connection authority for four medical relationships.

## Obstructive sleep apnea → hypertension

- Retained as the rank-1, commonly explored relationship.
- Replaced legal/rating-only support with a 2025 systematic review describing OSA as an independent hypertension risk factor and reviewing intermittent hypoxia, sympathetic activation, oxidative stress, inflammation, and related mechanisms.
- The repository remains case-specific: it requires OSA severity/desaturation data, longitudinal blood-pressure chronology, competing hypertension causes, treatment history, and a qualified individual medical opinion before causation or aggravation is asserted.
- No causal pathway metadata is authored automatically.

## Obstructive sleep apnea → depressive disorder

- Retained as the rank-2, sometimes explored relationship.
- Replaced legal/rating-only support with a 2024 systematic review and dose-response meta-analysis reporting greater depression risk with increasing OSA severity.
- The source base is cross-sectional and heterogeneous, so the mapping explicitly avoids converting the population association into an automatic individual causal or aggravation nexus.
- Development safeguards distinguish depressive disorder from overlapping OSA symptoms and require chronology, competing-cause review, and qualified individual assessment.

## Obstructive sleep apnea → anxiety disorder

- Retained as the rank-3, sometimes explored relationship.
- Replaced legal/rating-only support with an OSA-specific systematic review/meta-analysis that found anxiety symptoms common and characterized the OSA/anxiety/depression relationship as probably bidirectional.
- The mapping remains association-focused and requires a qualified anxiety diagnosis, chronology, competing-cause review, and individual directionality assessment.

## Obstructive sleep apnea → GERD

- Withdrawn rather than clinically overclaimed.
- Recent meta-analyses support co-occurrence/association but disagree on the strength and statistical significance of the relationship, and the observational evidence does not establish a directional OSA → GERD causal or aggravation pathway.
- A future reintroduction would require stronger direction-specific evidence or a deliberately nondirectional representation supported by the product schema.

## Citation position

Batch 14 removes eight legal/rating-only references from the published OSA mapping and adds three condition-specific clinical-evidence references, all with canonical PubMed URLs and `verified: false` pending qualified-human review.

The projected citation ratchet is:

- total references: **123**;
- verified: **14**;
- unverified: **109**;
- published-unverified review findings: **107**;
- clinical-evidence references with canonical URLs: **at least 56**.

No source is automatically promoted to `verified: true`.

## Expansion state

Batch 14 repairs legacy published debt rather than promoting another Wave 1-7 expansion identity. The controlled expansion ledger therefore remains **13 individually promoted / 94 of 107 expansion mappings still draft**. The overall catalog and knowledge-base universe remains frozen at 300/300.
