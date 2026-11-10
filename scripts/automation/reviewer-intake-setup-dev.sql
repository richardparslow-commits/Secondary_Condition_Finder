-- Qualified HUMAN reviewer submission boundary. DEV database ONLY.
-- Bootstrap manually with a pinned DEV administrator, never from GitHub Actions.
-- No reviewer login or membership is created here. All receipts remain unapproved.
DO $guard$
BEGIN
  IF current_database() <> 'tsdb' OR current_user <> 'tsdbadmin' THEN
    RAISE EXCEPTION 'DEV-only authorized database administrator required';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='scf_dev_qualified_reviewers') THEN
    CREATE ROLE scf_dev_qualified_reviewers NOLOGIN;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='scf_dev_qualified_reviewers'
             AND (rolcanlogin OR rolsuper OR rolcreatedb OR rolcreaterole)) THEN
    RAISE EXCEPTION 'Reviewer execution group must stay NOLOGIN and nonprivileged';
  END IF;
END $guard$;

CREATE TABLE IF NOT EXISTS scf_candidate_review_dev.qualified_reviewers (
  login_name text PRIMARY KEY CHECK (login_name ~ '^scf_review_[a-z0-9_]{4,40}$'),
  reviewer_identifier text NOT NULL CHECK (length(btrim(reviewer_identifier)) BETWEEN 3 AND 150),
  reviewer_qualification text NOT NULL CHECK (length(btrim(reviewer_qualification)) BETWEEN 12 AND 500),
  qualification_verified_by text NOT NULL CHECK (length(btrim(qualification_verified_by)) BETWEEN 3 AND 150),
  verified_at timestamptz NOT NULL,
  credential_expires_at timestamptz NOT NULL CHECK (credential_expires_at > verified_at),
  attestation_reference text NOT NULL CHECK (length(btrim(attestation_reference)) BETWEEN 10 AND 250),
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','ACTIVE','SUSPENDED','REVOKED')),
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status <> 'ACTIVE' OR revoked_at IS NULL)
);

CREATE TABLE IF NOT EXISTS scf_candidate_review_dev.qualified_review_receipt_audit (
  review_id bigint PRIMARY KEY REFERENCES scf_candidate_review_dev.qualified_human_reviews(review_id),
  reviewer_login text NOT NULL REFERENCES scf_candidate_review_dev.qualified_reviewers(login_name),
  submission_sha256 text NOT NULL UNIQUE CHECK (submission_sha256 ~ '^[a-f0-9]{64}$'),
  source_candidate_sha256 text NOT NULL CHECK (source_candidate_sha256 ~ '^[a-f0-9]{64}$'),
  written_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION scf_candidate_review_dev.reject_receipt_audit_changes()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Human clinical review attestation records are append-only';
END $$;

DROP TRIGGER IF EXISTS qualified_receipt_audit_append_only
  ON scf_candidate_review_dev.qualified_review_receipt_audit;
CREATE TRIGGER qualified_receipt_audit_append_only
BEFORE UPDATE OR DELETE ON scf_candidate_review_dev.qualified_review_receipt_audit
FOR EACH ROW EXECUTE FUNCTION scf_candidate_review_dev.reject_receipt_audit_changes();

-- SECURITY DEFINER runs under the DEV DBA owner. Every submitted reviewer
-- identity and qualification comes from the DBA-curated registry, not JSON,
-- HTTP headers, environment variables, or CLI-supplied self-attestation.
-- session_user is the authenticated login even when current_user is definer.
CREATE OR REPLACE FUNCTION scf_candidate_review_dev.submit_qualified_review(
  p_run_id text, p_source_id text, p_target_id text, p_candidate_pmid text,
  p_reviewed_at timestamptz, p_clinical_disposition text,
  p_study_design_population text, p_causal_direction_limits text,
  p_confounders_and_mediation text, p_supporting_evidence jsonb,
  p_unresolved_contradictions jsonb, p_full_text_access_basis text,
  p_reviewer_rationale text, p_submission_sha256 text
) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog
AS $qualified$
DECLARE
  v_reviewer scf_candidate_review_dev.qualified_reviewers%ROWTYPE;
  v_source_sha text;
  v_id bigint;
  v_actor text := session_user;
BEGIN
  IF v_actor !~ '^scf_review_[a-z0-9_]{4,40}
  SELECT * INTO v_reviewer FROM scf_candidate_review_dev.qualified_reviewers
    WHERE login_name=v_actor AND status='ACTIVE'
      AND revoked_at IS NULL AND verified_at <= now()
      AND credential_expires_at > now()
      AND length(btrim(attestation_reference)) >= 10
    FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reviewer identity or qualifications are not active and verified';
  END IF;
  IF p_run_id !~ '^[a-f0-9]{64}$'
     OR p_source_id !~ '^[a-z0-9-]{2,90}$'
     OR p_target_id !~ '^[a-z0-9-]{2,90}$'
     OR p_candidate_pmid !~ '^[1-9][0-9]{3,8}$'
     OR p_submission_sha256 !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'Invalid provenance identifiers';
  END IF;
  IF p_reviewed_at IS NULL OR p_reviewed_at > now() + interval '1 day'
     OR p_reviewed_at < v_reviewer.verified_at
     OR p_reviewed_at < timestamp with time zone '2020-01-01 00:00:00+00' THEN
    RAISE EXCEPTION 'Review must occur after independently verified reviewer qualification';
  END IF;
  IF p_clinical_disposition NOT IN
     ('NEEDS_MORE_EVIDENCE','INSUFFICIENT_EVIDENCE','POTENTIAL_SUPPORT',
      'POTENTIAL_CONTRADICTION','MIXED_OR_CONFLICTED') THEN
    RAISE EXCEPTION 'Only preliminary clinical review dispositions are accepted';
  END IF;
  IF length(btrim(p_study_design_population)) NOT BETWEEN 12 AND 5000
     OR length(btrim(p_causal_direction_limits)) NOT BETWEEN 12 AND 5000
     OR length(btrim(p_confounders_and_mediation)) NOT BETWEEN 12 AND 5000
     OR length(btrim(p_full_text_access_basis)) NOT BETWEEN 12 AND 1000
     OR length(btrim(p_reviewer_rationale)) NOT BETWEEN 30 AND 10000 THEN
    RAISE EXCEPTION 'Required study critique or full text basis incomplete';
  END IF;
  IF p_supporting_evidence IS NULL OR jsonb_typeof(p_supporting_evidence)<>'array'
     OR p_unresolved_contradictions IS NULL
     OR jsonb_typeof(p_unresolved_contradictions)<>'array' THEN
    RAISE EXCEPTION 'Study evidence and unresolved contradiction arrays required';
  END IF;
  IF jsonb_array_length(p_supporting_evidence)>12
     OR jsonb_array_length(p_unresolved_contradictions)>12 THEN
    RAISE EXCEPTION 'Evidence sources exceed bounded qualified review scope';
  END IF;
  IF (p_clinical_disposition IN ('POTENTIAL_SUPPORT','MIXED_OR_CONFLICTED')
      AND jsonb_array_length(p_supporting_evidence)=0)
     OR (p_clinical_disposition IN ('POTENTIAL_CONTRADICTION','MIXED_OR_CONFLICTED')
      AND jsonb_array_length(p_unresolved_contradictions)=0) THEN
    RAISE EXCEPTION 'Preliminary evidence disposition requires source details';
  END IF;
  -- Prevent a bypassing SQL client from inserting unstructured JSON or text
  -- without exact PubMed IDs and a substantive evidence rationale.
  IF EXISTS (
    SELECT 1 FROM (
      SELECT value FROM jsonb_array_elements(p_supporting_evidence)
      UNION ALL
      SELECT value FROM jsonb_array_elements(p_unresolved_contradictions)
    ) AS cited
    WHERE jsonb_typeof(value)<>'object'
       OR value->>'pmid' IS NULL
       OR jsonb_typeof(value->'pmid')<>'string'
       OR value->>'pmid' !~ '^[1-9][0-9]{3,8}
  SELECT content_sha256 INTO v_source_sha
    FROM scf_candidate_review_dev.case_candidates
   WHERE run_id=p_run_id AND source_id=p_source_id
     AND target_id=p_target_id AND candidate_pmid=p_candidate_pmid
     AND review_state='PENDING_QUALIFIED_REVIEW'
     AND claim_verification='NOT_ASSESSED'
     AND publication_authorization='NOT_GRANTED';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown or ineligible source-to-claim candidate link';
  END IF;

  INSERT INTO scf_candidate_review_dev.qualified_human_reviews (
    run_id,source_id,target_id,candidate_pmid,
    reviewer_identifier,reviewer_qualification,qualification_verified_by,
    reviewed_at,clinical_disposition,study_design_population,
    causal_direction_limits,confounders_and_mediation,supporting_evidence,
    unresolved_contradictions,full_text_access_basis,reviewer_rationale,
    production_publication_state)
  VALUES (
    p_run_id,p_source_id,p_target_id,p_candidate_pmid,
    v_reviewer.reviewer_identifier,v_reviewer.reviewer_qualification,
    v_reviewer.qualification_verified_by,p_reviewed_at,p_clinical_disposition,
    p_study_design_population,p_causal_direction_limits,
    p_confounders_and_mediation,p_supporting_evidence,
    p_unresolved_contradictions,p_full_text_access_basis,
    p_reviewer_rationale,'NOT_GRANTED')
  RETURNING review_id INTO v_id;

  INSERT INTO scf_candidate_review_dev.qualified_review_receipt_audit (
    review_id,reviewer_login,submission_sha256,source_candidate_sha256)
  VALUES (v_id,v_actor,p_submission_sha256,v_source_sha);
  RETURN v_id;
END $qualified$;

-- PostgreSQL grants EXECUTE on new functions to PUBLIC by default. Explicitly
-- remove it inside the same setup transaction, before any reviewer is enabled.
REVOKE ALL ON SCHEMA scf_candidate_review_dev FROM PUBLIC;
REVOKE ALL ON scf_candidate_review_dev.qualified_reviewers,
  scf_candidate_review_dev.qualified_review_receipt_audit FROM PUBLIC;
REVOKE ALL ON scf_candidate_review_dev.qualified_reviewers,
  scf_candidate_review_dev.qualified_review_receipt_audit FROM scf_evidence_ci_writer;
REVOKE ALL ON scf_candidate_review_dev.qualified_human_reviews
  FROM scf_dev_qualified_reviewers;
REVOKE ALL ON scf_candidate_review_dev.qualified_reviewers,
  scf_candidate_review_dev.qualified_review_receipt_audit
  FROM scf_dev_qualified_reviewers;
REVOKE ALL ON FUNCTION scf_candidate_review_dev.submit_qualified_review(
  text,text,text,text,timestamptz,text,text,text,text,jsonb,jsonb,text,text,text)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION scf_candidate_review_dev.submit_qualified_review(
  text,text,text,text,timestamptz,text,text,text,text,jsonb,jsonb,text,text,text)
  FROM scf_evidence_ci_writer;
GRANT USAGE ON SCHEMA scf_candidate_review_dev TO scf_dev_qualified_reviewers;
GRANT EXECUTE ON FUNCTION scf_candidate_review_dev.submit_qualified_review(
  text,text,text,text,timestamptz,text,text,text,text,jsonb,jsonb,text,text,text)
  TO scf_dev_qualified_reviewers;

       OR jsonb_typeof(value->'assessment')<>'string'
       OR COALESCE(length(btrim(value->>'assessment')),0) NOT BETWEEN 12 AND 2000
       OR (value - 'pmid' - 'assessment') <> '{}'::jsonb
  ) THEN
    RAISE EXCEPTION 'Each reviewed study must identify a PubMed source and rationale';
  END IF;
  IF (SELECT COUNT(DISTINCT value->>'pmid') FROM jsonb_array_elements(p_supporting_evidence))
       <> jsonb_array_length(p_supporting_evidence)
     OR (SELECT COUNT(DISTINCT value->>'pmid')
          FROM jsonb_array_elements(p_unresolved_contradictions))
       <> jsonb_array_length(p_unresolved_contradictions) THEN
    RAISE EXCEPTION 'Duplicate evidence PMIDs within a review category';
  END IF;
  SELECT content_sha256 INTO v_source_sha
    FROM scf_candidate_review_dev.case_candidates
   WHERE run_id=p_run_id AND source_id=p_source_id
     AND target_id=p_target_id AND candidate_pmid=p_candidate_pmid
     AND review_state='PENDING_QUALIFIED_REVIEW'
     AND claim_verification='NOT_ASSESSED'
     AND publication_authorization='NOT_GRANTED';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown or ineligible source-to-claim candidate link';
  END IF;

  INSERT INTO scf_candidate_review_dev.qualified_human_reviews (
    run_id,source_id,target_id,candidate_pmid,
    reviewer_identifier,reviewer_qualification,qualification_verified_by,
    reviewed_at,clinical_disposition,study_design_population,
    causal_direction_limits,confounders_and_mediation,supporting_evidence,
    unresolved_contradictions,full_text_access_basis,reviewer_rationale,
    production_publication_state)
  VALUES (
    p_run_id,p_source_id,p_target_id,p_candidate_pmid,
    v_reviewer.reviewer_identifier,v_reviewer.reviewer_qualification,
    v_reviewer.qualification_verified_by,p_reviewed_at,p_clinical_disposition,
    p_study_design_population,p_causal_direction_limits,
    p_confounders_and_mediation,p_supporting_evidence,
    p_unresolved_contradictions,p_full_text_access_basis,
    p_reviewer_rationale,'NOT_GRANTED')
  RETURNING review_id INTO v_id;

  INSERT INTO scf_candidate_review_dev.qualified_review_receipt_audit (
    review_id,reviewer_login,submission_sha256,source_candidate_sha256)
  VALUES (v_id,v_actor,p_submission_sha256,v_source_sha);
  RETURN v_id;
END $qualified$;

-- PostgreSQL grants EXECUTE on new functions to PUBLIC by default. Explicitly
-- remove it inside the same setup transaction, before any reviewer is enabled.
REVOKE ALL ON SCHEMA scf_candidate_review_dev FROM PUBLIC;
REVOKE ALL ON scf_candidate_review_dev.qualified_reviewers,
  scf_candidate_review_dev.qualified_review_receipt_audit FROM PUBLIC;
REVOKE ALL ON scf_candidate_review_dev.qualified_reviewers,
  scf_candidate_review_dev.qualified_review_receipt_audit FROM scf_evidence_ci_writer;
REVOKE ALL ON scf_candidate_review_dev.qualified_human_reviews
  FROM scf_dev_qualified_reviewers;
REVOKE ALL ON scf_candidate_review_dev.qualified_reviewers,
  scf_candidate_review_dev.qualified_review_receipt_audit
  FROM scf_dev_qualified_reviewers;
REVOKE ALL ON FUNCTION scf_candidate_review_dev.submit_qualified_review(
  text,text,text,text,timestamptz,text,text,text,text,jsonb,jsonb,text,text,text)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION scf_candidate_review_dev.submit_qualified_review(
  text,text,text,text,timestamptz,text,text,text,text,jsonb,jsonb,text,text,text)
  FROM scf_evidence_ci_writer;
GRANT USAGE ON SCHEMA scf_candidate_review_dev TO scf_dev_qualified_reviewers;
GRANT EXECUTE ON FUNCTION scf_candidate_review_dev.submit_qualified_review(
  text,text,text,text,timestamptz,text,text,text,text,jsonb,jsonb,text,text,text)
  TO scf_dev_qualified_reviewers;
 THEN
    RAISE EXCEPTION 'Dedicated reviewer login required';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles
    WHERE rolname=v_actor AND rolcanlogin AND NOT rolsuper
      AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolreplication
      AND NOT rolbypassrls
      AND pg_catalog.pg_has_role(rolname, 'scf_dev_qualified_reviewers', 'MEMBER')
  ) THEN
    RAISE EXCEPTION 'Reviewer login cannot be privileged and must be authorized in reviewer group';
  END IF;
  SELECT * INTO v_reviewer FROM scf_candidate_review_dev.qualified_reviewers
    WHERE login_name=v_actor AND status='ACTIVE'
      AND revoked_at IS NULL AND verified_at <= now()
      AND credential_expires_at > now()
      AND length(btrim(attestation_reference)) >= 10
    FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reviewer identity or qualifications are not active and verified';
  END IF;
  IF p_run_id !~ '^[a-f0-9]{64}$'
     OR p_source_id !~ '^[a-z0-9-]{2,90}$'
     OR p_target_id !~ '^[a-z0-9-]{2,90}$'
     OR p_candidate_pmid !~ '^[1-9][0-9]{3,8}$'
     OR p_submission_sha256 !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'Invalid provenance identifiers';
  END IF;
  IF p_reviewed_at IS NULL OR p_reviewed_at > now() + interval '1 day'
     OR p_reviewed_at < v_reviewer.verified_at
     OR p_reviewed_at < timestamp with time zone '2020-01-01 00:00:00+00' THEN
    RAISE EXCEPTION 'Review must occur after independently verified reviewer qualification';
  END IF;
  IF p_clinical_disposition NOT IN
     ('NEEDS_MORE_EVIDENCE','INSUFFICIENT_EVIDENCE','POTENTIAL_SUPPORT',
      'POTENTIAL_CONTRADICTION','MIXED_OR_CONFLICTED') THEN
    RAISE EXCEPTION 'Only preliminary clinical review dispositions are accepted';
  END IF;
  IF length(btrim(p_study_design_population)) NOT BETWEEN 12 AND 5000
     OR length(btrim(p_causal_direction_limits)) NOT BETWEEN 12 AND 5000
     OR length(btrim(p_confounders_and_mediation)) NOT BETWEEN 12 AND 5000
     OR length(btrim(p_full_text_access_basis)) NOT BETWEEN 12 AND 1000
     OR length(btrim(p_reviewer_rationale)) NOT BETWEEN 30 AND 10000 THEN
    RAISE EXCEPTION 'Required study critique or full text basis incomplete';
  END IF;
  IF p_supporting_evidence IS NULL OR jsonb_typeof(p_supporting_evidence)<>'array'
     OR p_unresolved_contradictions IS NULL
     OR jsonb_typeof(p_unresolved_contradictions)<>'array' THEN
    RAISE EXCEPTION 'Study evidence and unresolved contradiction arrays required';
  END IF;
  IF jsonb_array_length(p_supporting_evidence)>12
     OR jsonb_array_length(p_unresolved_contradictions)>12 THEN
    RAISE EXCEPTION 'Evidence sources exceed bounded qualified review scope';
  END IF;
  IF (p_clinical_disposition IN ('POTENTIAL_SUPPORT','MIXED_OR_CONFLICTED')
      AND jsonb_array_length(p_supporting_evidence)=0)
     OR (p_clinical_disposition IN ('POTENTIAL_CONTRADICTION','MIXED_OR_CONFLICTED')
      AND jsonb_array_length(p_unresolved_contradictions)=0) THEN
    RAISE EXCEPTION 'Preliminary evidence disposition requires source details';
  END IF;
  -- Prevent a bypassing SQL client from inserting unstructured JSON or text
  -- without exact PubMed IDs and a substantive evidence rationale.
  IF EXISTS (
    SELECT 1 FROM (
      SELECT value FROM jsonb_array_elements(p_supporting_evidence)
      UNION ALL
      SELECT value FROM jsonb_array_elements(p_unresolved_contradictions)
    ) AS cited
    WHERE jsonb_typeof(value)<>'object'
       OR value->>'pmid' IS NULL
       OR jsonb_typeof(value->'pmid')<>'string'
       OR value->>'pmid' !~ '^[1-9][0-9]{3,8}
  SELECT content_sha256 INTO v_source_sha
    FROM scf_candidate_review_dev.case_candidates
   WHERE run_id=p_run_id AND source_id=p_source_id
     AND target_id=p_target_id AND candidate_pmid=p_candidate_pmid
     AND review_state='PENDING_QUALIFIED_REVIEW'
     AND claim_verification='NOT_ASSESSED'
     AND publication_authorization='NOT_GRANTED';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown or ineligible source-to-claim candidate link';
  END IF;

  INSERT INTO scf_candidate_review_dev.qualified_human_reviews (
    run_id,source_id,target_id,candidate_pmid,
    reviewer_identifier,reviewer_qualification,qualification_verified_by,
    reviewed_at,clinical_disposition,study_design_population,
    causal_direction_limits,confounders_and_mediation,supporting_evidence,
    unresolved_contradictions,full_text_access_basis,reviewer_rationale,
    production_publication_state)
  VALUES (
    p_run_id,p_source_id,p_target_id,p_candidate_pmid,
    v_reviewer.reviewer_identifier,v_reviewer.reviewer_qualification,
    v_reviewer.qualification_verified_by,p_reviewed_at,p_clinical_disposition,
    p_study_design_population,p_causal_direction_limits,
    p_confounders_and_mediation,p_supporting_evidence,
    p_unresolved_contradictions,p_full_text_access_basis,
    p_reviewer_rationale,'NOT_GRANTED')
  RETURNING review_id INTO v_id;

  INSERT INTO scf_candidate_review_dev.qualified_review_receipt_audit (
    review_id,reviewer_login,submission_sha256,source_candidate_sha256)
  VALUES (v_id,v_actor,p_submission_sha256,v_source_sha);
  RETURN v_id;
END $qualified$;

-- PostgreSQL grants EXECUTE on new functions to PUBLIC by default. Explicitly
-- remove it inside the same setup transaction, before any reviewer is enabled.
REVOKE ALL ON SCHEMA scf_candidate_review_dev FROM PUBLIC;
REVOKE ALL ON scf_candidate_review_dev.qualified_reviewers,
  scf_candidate_review_dev.qualified_review_receipt_audit FROM PUBLIC;
REVOKE ALL ON scf_candidate_review_dev.qualified_reviewers,
  scf_candidate_review_dev.qualified_review_receipt_audit FROM scf_evidence_ci_writer;
REVOKE ALL ON scf_candidate_review_dev.qualified_human_reviews
  FROM scf_dev_qualified_reviewers;
REVOKE ALL ON scf_candidate_review_dev.qualified_reviewers,
  scf_candidate_review_dev.qualified_review_receipt_audit
  FROM scf_dev_qualified_reviewers;
REVOKE ALL ON FUNCTION scf_candidate_review_dev.submit_qualified_review(
  text,text,text,text,timestamptz,text,text,text,text,jsonb,jsonb,text,text,text)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION scf_candidate_review_dev.submit_qualified_review(
  text,text,text,text,timestamptz,text,text,text,text,jsonb,jsonb,text,text,text)
  FROM scf_evidence_ci_writer;
GRANT USAGE ON SCHEMA scf_candidate_review_dev TO scf_dev_qualified_reviewers;
GRANT EXECUTE ON FUNCTION scf_candidate_review_dev.submit_qualified_review(
  text,text,text,text,timestamptz,text,text,text,text,jsonb,jsonb,text,text,text)
  TO scf_dev_qualified_reviewers;

       OR jsonb_typeof(value->'assessment')<>'string'
       OR COALESCE(length(btrim(value->>'assessment')),0) NOT BETWEEN 12 AND 2000
       OR (value - 'pmid' - 'assessment') <> '{}'::jsonb
  ) THEN
    RAISE EXCEPTION 'Each reviewed study must identify a PubMed source and rationale';
  END IF;
  IF (SELECT COUNT(DISTINCT value->>'pmid') FROM jsonb_array_elements(p_supporting_evidence))
       <> jsonb_array_length(p_supporting_evidence)
     OR (SELECT COUNT(DISTINCT value->>'pmid')
          FROM jsonb_array_elements(p_unresolved_contradictions))
       <> jsonb_array_length(p_unresolved_contradictions) THEN
    RAISE EXCEPTION 'Duplicate evidence PMIDs within a review category';
  END IF;
  SELECT content_sha256 INTO v_source_sha
    FROM scf_candidate_review_dev.case_candidates
   WHERE run_id=p_run_id AND source_id=p_source_id
     AND target_id=p_target_id AND candidate_pmid=p_candidate_pmid
     AND review_state='PENDING_QUALIFIED_REVIEW'
     AND claim_verification='NOT_ASSESSED'
     AND publication_authorization='NOT_GRANTED';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown or ineligible source-to-claim candidate link';
  END IF;

  INSERT INTO scf_candidate_review_dev.qualified_human_reviews (
    run_id,source_id,target_id,candidate_pmid,
    reviewer_identifier,reviewer_qualification,qualification_verified_by,
    reviewed_at,clinical_disposition,study_design_population,
    causal_direction_limits,confounders_and_mediation,supporting_evidence,
    unresolved_contradictions,full_text_access_basis,reviewer_rationale,
    production_publication_state)
  VALUES (
    p_run_id,p_source_id,p_target_id,p_candidate_pmid,
    v_reviewer.reviewer_identifier,v_reviewer.reviewer_qualification,
    v_reviewer.qualification_verified_by,p_reviewed_at,p_clinical_disposition,
    p_study_design_population,p_causal_direction_limits,
    p_confounders_and_mediation,p_supporting_evidence,
    p_unresolved_contradictions,p_full_text_access_basis,
    p_reviewer_rationale,'NOT_GRANTED')
  RETURNING review_id INTO v_id;

  INSERT INTO scf_candidate_review_dev.qualified_review_receipt_audit (
    review_id,reviewer_login,submission_sha256,source_candidate_sha256)
  VALUES (v_id,v_actor,p_submission_sha256,v_source_sha);
  RETURN v_id;
END $qualified$;

-- PostgreSQL grants EXECUTE on new functions to PUBLIC by default. Explicitly
-- remove it inside the same setup transaction, before any reviewer is enabled.
REVOKE ALL ON SCHEMA scf_candidate_review_dev FROM PUBLIC;
REVOKE ALL ON scf_candidate_review_dev.qualified_reviewers,
  scf_candidate_review_dev.qualified_review_receipt_audit FROM PUBLIC;
REVOKE ALL ON scf_candidate_review_dev.qualified_reviewers,
  scf_candidate_review_dev.qualified_review_receipt_audit FROM scf_evidence_ci_writer;
REVOKE ALL ON scf_candidate_review_dev.qualified_human_reviews
  FROM scf_dev_qualified_reviewers;
REVOKE ALL ON scf_candidate_review_dev.qualified_reviewers,
  scf_candidate_review_dev.qualified_review_receipt_audit
  FROM scf_dev_qualified_reviewers;
REVOKE ALL ON FUNCTION scf_candidate_review_dev.submit_qualified_review(
  text,text,text,text,timestamptz,text,text,text,text,jsonb,jsonb,text,text,text)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION scf_candidate_review_dev.submit_qualified_review(
  text,text,text,text,timestamptz,text,text,text,text,jsonb,jsonb,text,text,text)
  FROM scf_evidence_ci_writer;
GRANT USAGE ON SCHEMA scf_candidate_review_dev TO scf_dev_qualified_reviewers;
GRANT EXECUTE ON FUNCTION scf_candidate_review_dev.submit_qualified_review(
  text,text,text,text,timestamptz,text,text,text,text,jsonb,jsonb,text,text,text)
  TO scf_dev_qualified_reviewers;
