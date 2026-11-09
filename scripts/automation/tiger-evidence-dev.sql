-- Tiger Cloud DEV only. Executed once by an authorized DEV administrator.
-- No patient data, no application runtime writes, and NO clinical approval.
-- The scheduled runner receives SELECT/INSERT only (not CREATE/UPDATE/DELETE).
CREATE SCHEMA IF NOT EXISTS scf_autonomous_evidence_dev;

CREATE TABLE IF NOT EXISTS scf_autonomous_evidence_dev.runs (
    run_id text PRIMARY KEY CHECK (run_id ~ '^[a-f0-9]{64}$'),
    source_ledger_id text NOT NULL CHECK (source_ledger_id ~ '^[a-f0-9]{64}$'),
    source_commit text NOT NULL,
    observed_at timestamptz NOT NULL,
    pathway_count integer NOT NULL CHECK (pathway_count BETWEEN 1 AND 350),
    article_count integer NOT NULL CHECK (article_count BETWEEN 0 AND 1000),
    clinical_approval text NOT NULL DEFAULT 'NOT_GRANTED'
        CHECK (clinical_approval = 'NOT_GRANTED'),
    report_state text NOT NULL DEFAULT 'RESEARCH_REVIEW_ONLY'
        CHECK (report_state = 'RESEARCH_REVIEW_ONLY'),
    inserted_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS scf_autonomous_evidence_dev.pubmed_articles (
    run_id text NOT NULL REFERENCES scf_autonomous_evidence_dev.runs(run_id),
    pmid text NOT NULL CHECK (pmid ~ '^[0-9]{4,9}$'),
    status text NOT NULL CHECK (status IN (
        'UNRESOLVED','PROVIDER_UNAVAILABLE','PUBLICATION_STATUS_REVIEW','METADATA_RETRIEVED')),
    title text NOT NULL,
    publication_date text NOT NULL,
    doi text NOT NULL,
    publication_types jsonb NOT NULL,
    metadata_hash text NOT NULL,
    clinical_support text NOT NULL DEFAULT 'NOT_ASSESSED'
        CHECK (clinical_support='NOT_ASSESSED'),
    PRIMARY KEY (run_id, pmid)
);
CREATE INDEX IF NOT EXISTS scf_auto_evidence_pmid_status_idx
    ON scf_autonomous_evidence_dev.pubmed_articles (pmid, status);

CREATE TABLE IF NOT EXISTS scf_autonomous_evidence_dev.pathway_reviews (
    run_id text NOT NULL REFERENCES scf_autonomous_evidence_dev.runs(run_id),
    source_id text NOT NULL,
    target_id text NOT NULL,
    publication_state text NOT NULL CHECK (publication_state IN ('DRAFT','PUBLISHED')),
    nexus_classification text NOT NULL CHECK (nexus_classification IN
        ('ASSOCIATION_ONLY','DIRECT_CAUSATION','AGGRAVATION')),
    cited_pmids jsonb NOT NULL,
    review_rules jsonb NOT NULL,
    discovery_pmids jsonb NOT NULL,
    discovery_status text NOT NULL CHECK (discovery_status IN
        ('CANDIDATES_FOUND','NO_TEXT_MATCH','SEARCH_UNAVAILABLE')),
    review_state text NOT NULL DEFAULT 'HUMAN_REVIEW_REQUIRED'
        CHECK (review_state='HUMAN_REVIEW_REQUIRED'),
    content_hash text NOT NULL CHECK (content_hash ~ '^[a-f0-9]{64}$'),
    PRIMARY KEY (run_id, source_id, target_id)
);
CREATE INDEX IF NOT EXISTS scf_auto_evidence_pathway_idx
    ON scf_autonomous_evidence_dev.pathway_reviews(source_id,target_id,publication_state);
