# Evidence ingestion and local review

## Purpose

Step 4 can optionally identify exact evidence excerpts that may help a Veteran organize a later discussion with a qualified medical provider or accredited representative. This feature is an evidence-review aid. It does not determine medical causation, legal competency, credibility, probative weight, or VA entitlement.

## Privacy boundary

Raw supporting-document text stays in the browser. The application server receives only the existing `documentsShared` yes/no workflow choice. Raw medical text and locally extracted quotations are not written to application logs, aggregate recommendation events, workflow cookies, URLs, or user accounts.

The browser stores only the extracted excerpt objects needed for Step 6 in `sessionStorage`. That storage is tab-scoped, is removed when the tab is closed, and can be cleared manually from Step 4.

## Supported input

Direct local parsing currently supports text formats (`text/*`, TXT, Markdown, CSV, JSON, LOG) up to 5 MB per source. PDF and DOCX records are not directly parsed in this privacy-first slice. A user may instead export/copy exact text from those records, supply the source name plus page/section locator, and run the same local classifier. Scanned-image records require OCR outside this application before text can be reviewed.

This limitation is deliberate: the application does not send medical records to a third-party OCR or document-analysis API merely to obtain text.

## Evidence classification

The deterministic classifier looks for narrowly defined evidence categories:

- diagnosis
- causation
- aggravation
- treatment
- medication
- timeline/progression
- alternative-cause language

An excerpt receives the stronger `nexus-relevant` label only when all of the following are true:

1. the user identifies the source as clinician-authored;
2. the excerpt contains explicit causation, aggravation, or alternative-cause language; and
3. the excerpt mentions at least one condition selected in the workflow.

Everything else is retained, when relevant, as `supporting` evidence. The product must not describe `nexus-relevant` as a determination that the evidence is legally competent, medically correct, sufficient, or persuasive.

## Exact-quote requirement

The classifier does not rewrite an excerpt. Step 6 displays the exact extracted sentence together with:

- source name;
- line locator or user-supplied page/section locator;
- evidence category;
- matched selected-condition terms.

If the app cannot preserve exact text and provenance, it must not present the text as a quotation from the source.

## Non-goals for this slice

- no claim-success probability;
- no automated medical diagnosis;
- no determination that a clinician opinion satisfies VA nexus requirements;
- no server-side medical-record retention;
- no third-party OCR/document API;
- no direct PDF/DOCX parser yet.

Future direct PDF/DOCX support must preserve the same privacy and provenance invariants before it can replace the paste/export fallback.
