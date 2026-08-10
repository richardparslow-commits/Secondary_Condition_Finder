# Secondary Condition Finder - Repository Guidelines

## Project Purpose
Web application helping military veterans identify and file secondary service-connected disability claims under 38 C.F.R. § 3.310.

## Tech Stack
- Frontend/Backend: Python 3.11 / Streamlit
- Data Protocols: JSON Schema extractions, non-additive VA combined rating calculations

## Developer Guardrails
1. Never commit directly to `main`. Always create a feature branch (`feat/` or `fix/`) and submit a Pull Request.
2. Validate all VA rating math against standard combined rating tables (rounding to nearest 10%).
3. Keep frontend code modular in `app.py` or `views/`.
