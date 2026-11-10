-- Human-only, fail-closed DEV study review intake. Requires existing pinned DEV schema.
-- Do not execute on Production. This script creates NO LOGIN role and grants nobody review rights.
SET LOCAL search_path = pg_catalog;
SET LOCAL lock_timeout = '4000ms';
SET LOCAL statement_timeout = '22000ms';

CREATE TABLE IF NOT EXISTS scf_candidate_review_dev.reviewer_authorizations (
  account_login name PRIMARY KEY
    CHECK (account_login::text ~ '^scf_review_[a-z0-9_]{3,40}$'),
  reviewer_identifier text NOT NULL CHECK (length(trim(reviewer_identifier)) BETWEEN 3 AND 120),
  professional_qualification text NOT NULL
    CHECK (length(trim(professional_qualification)) BETWEEN 12 AND 400),
  credential_issuer text NOT NULL CHECK (length(trim(credential_issuer)) BETWEEN 5 AND 240),
  credential_reference text NOT NULL
    CHECK (length(trim(credential_reference)) BETWEEN 4 AND 140),
  qualification_verified_by text NOT NULL
    CHECK (length(trim(qualification_verified_by)) BETWEEN 3 AND 120),
  verified_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  scope text NOT NULL DEFAULT 'DEV_PUBMED_STUDY_REVIEW_ONLY'
    CHECK(scope='DEV_PUBMED_STUDY_REVIEW_ONLY'),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK(expires_at > verified_at),
  CHECK(qualification_verified_by <> reviewer_identifier),
  CHECK(qualification_verified_by <> account_login::text)
);

CREATE TABLE IF NOT EXISTS scf_candidate_review_dev.reviewer_authorization_events (
  event_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  account_login name NOT NULL,
  event_action text NOT NULL CHECK (event_action IN ('ENROLLED','REVOKED')),
  event_actor name NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  authorization_snapshot jsonb NOT NULL
);

-- A reviewer authorization cannot be silently rewritten; only one-way revocation.
CREATE OR REPLACE FUNCTION scf_candidate_review_dev.guard_reviewer_authorization()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $body$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Qualified reviewer enrollment is audit-retained';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF OLD.revoked_at IS NOT NULL OR NEW.revoked_at IS NULL OR
      NEW.revoked_at < OLD.verified_at OR
      (to_jsonb(NEW) - 'revoked_at') <> (to_jsonb(OLD) - 'revoked_at') THEN
      RAISE EXCEPTION 'Qualified reviewer authorization changes must be revocation-only';
    END IF;
  END IF;
  RETURN NEW;
END
$body$;

DROP TRIGGER IF EXISTS guard_reviewer_authorization ON scf_candidate_review_dev.reviewer_authorizations;
CREATE TRIGGER guard_reviewer_authorization
BEFORE UPDATE OR DELETE ON scf_candidate_review_dev.reviewer_authorizations
FOR EACH ROW EXECUTE FUNCTION scf_candidate_review_dev.guard_reviewer_authorization();

CREATE OR REPLACE FUNCTION scf_candidate_review_dev.audit_reviewer_authorization()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $body$
BEGIN
  INSERT INTO scf_candidate_review_dev.reviewer_authorization_events
    (account_login,event_action,event_actor,authorization_snapshot)
  VALUES (NEW.account_login,
    CASE WHEN TG_OP='INSERT' THEN 'ENROLLED' ELSE 'REVOKED' END,
    SESSION_USER, to_jsonb(NEW));
  RETURN NEW;
END
$body$;

DROP TRIGGER IF EXISTS audit_reviewer_authorization ON scf_candidate_review_dev.reviewer_authorizations;
CREATE TRIGGER audit_reviewer_authorization
AFTER INSERT OR UPDATE ON scf_candidate_review_dev.reviewer_authorizations
FOR EACH ROW EXECUTE FUNCTION scf_candidate_review_dev.audit_reviewer_authorization();

ALTER TABLE scf_candidate_review_dev.qualified_human_reviews
  ADD COLUMN IF NOT EXISTS correction_notice_disposition text
  NOT NULL DEFAULT 'REQUIRES_FOLLOW_UP'
  CHECK (correction_notice_disposition IN
    ('REVIEWED','REQUIRES_FOLLOW_UP','NOT_APPLICABLE'));

ALTER TABLE scf_candidate_review_dev.qualified_human_reviews
  ADD COLUMN IF NOT EXISTS submission_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS scf_qualified_review_submission_once
ON scf_candidate_review_dev.qualified_human_reviews(reviewer_identifier,submission_id);

CREATE OR REPLACE FUNCTION scf_candidate_review_dev.submit_qualified_review(request jsonb)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog
AS $body$
DECLARE
  v_login text := SESSION_USER::text;
  v_auth scf_candidate_review_dev.reviewer_authorizations%ROWTYPE;
  v_pmid text;
  v_disposition text;
  v_reviewed_at timestamptz;
  v_correction_required boolean;
  v_correction text;
  v_receipt bigint;
  v_len integer;
BEGIN
  -- The database login, not a caller-supplied reviewer name, is the sole identity.
  IF v_login !~ '^scf_review_[a-z0-9_]{3,40}$' OR
    NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles
       WHERE rolname=v_login AND rolcanlogin AND NOT rolsuper AND NOT rolcreaterole) THEN
    RAISE EXCEPTION 'Individual qualified-reviewer database login required'
      USING ERRCODE='28000';
  END IF;

  SELECT * INTO v_auth FROM scf_candidate_review_dev.reviewer_authorizations
    WHERE account_login::text=v_login AND revoked_at IS NULL
      AND verified_at <= now() AND expires_at > now()
      AND scope='DEV_PUBMED_STUDY_REVIEW_ONLY';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Independent credential verification or authorization missing/expired'
      USING ERRCODE='28000';
  END IF;

  IF request IS NULL OR jsonb_typeof(request) <> 'object' OR
    (SELECT count(*) FROM jsonb_object_keys(request)) <> 15 OR
    EXISTS (SELECT 1 FROM jsonb_object_keys(request) AS names(field)
      WHERE field NOT IN ('submissionId','runId','sourceId','targetId',
        'candidatePmid','reviewedAt','clinicalDisposition','studyDesignPopulation',
        'causalDirectionLimits','confoundersAndMediation','supportingEvidence',
        'unresolvedContradictions','fullTextAccessBasis','reviewerRationale',
        'correctionNoticeDisposition')) THEN
    RAISE EXCEPTION 'Unexpected or incomplete DEV study review payload';
  END IF;


  IF (request->>'submissionId') !~
      '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' OR
     (request->>'runId') !~ '^[a-f0-9]{64}$' OR
     (request->>'sourceId') !~ '^[a-z0-9-]{2,90}$' OR
     (request->>'targetId') !~ '^[a-z0-9-]{2,90}$' OR
     (request->>'candidatePmid') !~ '^[1-9][0-9]{3,8}$' THEN
     RAISE EXCEPTION 'Invalid review provenance identifiers';
  END IF;

  v_disposition:=request->>'clinicalDisposition';
  IF v_disposition NOT IN ('NEEDS_MORE_EVIDENCE','INSUFFICIENT_EVIDENCE',
       'POTENTIAL_SUPPORT','POTENTIAL_CONTRADICTION','MIXED_OR_CONFLICTED') THEN
    RAISE EXCEPTION 'Clinical disposition must remain preliminary';
  END IF;

  -- Qualification-free text and professional data are never supplied by caller.
  IF (request->>'reviewedAt') !~
     '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,6})?(Z|[+-][0-9]{2}:[0-9]{2})$' THEN
     RAISE EXCEPTION 'Qualified study review requires timestamp with timezone';
  END IF;
  v_reviewed_at:=(request->>'reviewedAt')::timestamptz;
  IF v_reviewed_at > now() OR v_reviewed_at < now()-interval '1 year' THEN
    RAISE EXCEPTION 'Review timestamp must be real and within one year';
  END IF;

  FOREACH v_pmid IN ARRAY ARRAY[
     'studyDesignPopulation','causalDirectionLimits','confoundersAndMediation',
     'fullTextAccessBasis','reviewerRationale'
  ] LOOP
    v_len:=length(btrim(request->>v_pmid));
    IF jsonb_typeof(request->v_pmid) <> 'string' OR
      (v_pmid='reviewerRationale' AND (v_len<30 OR v_len>5000)) OR
      (v_pmid<>'reviewerRationale' AND (v_len<12 OR v_len>3000)) THEN
      RAISE EXCEPTION 'Required clinical-context field is missing or unbounded';
    END IF;
  END LOOP;

  IF jsonb_typeof(request->'supportingEvidence') <> 'array' OR
     jsonb_array_length(request->'supportingEvidence') < 1 OR
     jsonb_array_length(request->'supportingEvidence') > 20 OR
     jsonb_typeof(request->'unresolvedContradictions') <> 'array' OR
     jsonb_array_length(request->'unresolvedContradictions') > 20 THEN
      RAISE EXCEPTION 'Review evidence references must be bounded PMID arrays';
  END IF;

  IF EXISTS (SELECT 1 FROM jsonb_array_elements(request->'supportingEvidence') AS e(item)
    WHERE jsonb_typeof(item)<>'object' OR
      (SELECT count(*) FROM jsonb_object_keys(item)) <> 2 OR
      (SELECT count(*) FROM jsonb_object_keys(item) AS names(k)
          WHERE k IN ('pmid','assessment')) <> 2 OR
      (item->>'pmid') !~ '^[1-9][0-9]{3,8}$' OR
      (item->>'assessment') NOT IN ('POTENTIAL_SUPPORT','POTENTIAL_CONTRADICTION',
        'CONTEXT_ONLY','INSUFFICIENT_FOR_CLAIM')) THEN
    RAISE EXCEPTION 'Unrecognized supporting study citation descriptor';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(request->'unresolvedContradictions') AS e(item)
    WHERE jsonb_typeof(item)<>'object' OR
      (SELECT count(*) FROM jsonb_object_keys(item)) <> 2 OR
      (SELECT count(*) FROM jsonb_object_keys(item) AS names(k)
        WHERE k IN ('pmid','issue')) <> 2 OR
      (item->>'pmid') !~ '^[1-9][0-9]{3,8}$' OR
      (item->>'issue') NOT IN ('CAUSAL_DIRECTION','POPULATION_MISMATCH',
        'CONFOUNDING','MEDICATION_OR_PROCEDURE','PUBLICATION_CORRECTION',
        'OTHER_UNRESOLVED')) THEN
    RAISE EXCEPTION 'Unrecognized contradiction citation descriptor';
  END IF;
  IF v_disposition IN ('POTENTIAL_CONTRADICTION','MIXED_OR_CONFLICTED')
      AND jsonb_array_length(request->'unresolvedContradictions')=0 THEN
    RAISE EXCEPTION 'Contradiction disposition requires cited unresolved evidence';
  END IF;

  SELECT p.payload->>'publicationStatusReviewRequired'='true'
    INTO v_correction_required
    FROM scf_candidate_review_dev.case_candidates l
    JOIN scf_candidate_review_dev.publications p
      ON p.run_id=l.run_id AND p.pmid=l.candidate_pmid
    WHERE l.run_id=request->>'runId'
      AND l.source_id=request->>'sourceId'
      AND l.target_id=request->>'targetId'
      AND l.candidate_pmid=request->>'candidatePmid'
      AND l.review_state='PENDING_QUALIFIED_REVIEW'
      AND l.claim_verification='NOT_ASSESSED'
      AND l.publication_authorization='NOT_GRANTED';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Exact immutable research evidence link does not exist';
  END IF;

  v_correction:=request->>'correctionNoticeDisposition';
  IF v_correction NOT IN ('REVIEWED','REQUIRES_FOLLOW_UP','NOT_APPLICABLE') OR
     (v_correction_required AND v_correction='NOT_APPLICABLE') THEN
    RAISE EXCEPTION 'Official correction notices require explicit reviewer attention';
  END IF;

  INSERT INTO scf_candidate_review_dev.qualified_human_reviews
    (run_id,source_id,target_id,candidate_pmid,
     reviewer_identifier,reviewer_qualification,qualification_verified_by,
     reviewed_at,clinical_disposition,study_design_population,
     causal_direction_limits,confounders_and_mediation,supporting_evidence,
     unresolved_contradictions,full_text_access_basis,reviewer_rationale,
     correction_notice_disposition,submission_id,production_publication_state)
  VALUES
    (request->>'runId',request->>'sourceId',request->>'targetId',
     request->>'candidatePmid',v_auth.reviewer_identifier,
     v_auth.professional_qualification,v_auth.qualification_verified_by,
     v_reviewed_at,v_disposition,request->>'studyDesignPopulation',
     request->>'causalDirectionLimits',request->>'confoundersAndMediation',
     request->'supportingEvidence',request->'unresolvedContradictions',
     request->>'fullTextAccessBasis',request->>'reviewerRationale',
     v_correction,(request->>'submissionId')::uuid,'NOT_GRANTED')
  RETURNING review_id INTO v_receipt;
  RETURN v_receipt;
END
$body$;

-- PostgreSQL grants functions to PUBLIC by default: explicitly revoke.
REVOKE ALL ON FUNCTION scf_candidate_review_dev.submit_qualified_review(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION scf_candidate_review_dev.submit_qualified_review(jsonb)
  FROM scf_evidence_ci_writer;

REVOKE ALL ON TABLE scf_candidate_review_dev.reviewer_authorizations FROM PUBLIC;
REVOKE ALL ON TABLE scf_candidate_review_dev.reviewer_authorization_events FROM PUBLIC;
REVOKE ALL ON TABLE scf_candidate_review_dev.qualified_human_reviews FROM PUBLIC;
REVOKE ALL ON TABLE scf_candidate_review_dev.reviewer_authorizations
  FROM scf_evidence_ci_writer;
REVOKE ALL ON TABLE scf_candidate_review_dev.reviewer_authorization_events
  FROM scf_evidence_ci_writer;
REVOKE ALL ON TABLE scf_candidate_review_dev.qualified_human_reviews
  FROM scf_evidence_ci_writer;

-- NO reviewer accounts, LOGIN roles, credential enrollments, or EXECUTE grants here.
-- A DBA must independently verify credentials, create a distinct LOGIN account,
-- insert an attestation and only then GRANT USAGE/EXECUTE to that login.
