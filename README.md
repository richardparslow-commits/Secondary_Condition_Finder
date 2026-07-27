# Secondary_Condition_Finder
Secondary Condition Finder for VA Claims

## Initial implementation

This repository now includes a small Python-based lookup tool for exploring possible secondary conditions tied to a known primary condition.

## MVP definition

- **User**: Veterans, advocates, or claim-preparation support staff researching possible secondary VA conditions.
- **Input**: A single primary condition name (for example, `"PTSD"`).
- **Output**: Ranked secondary-condition suggestions that include:
  - condition name
  - short annotation explaining why it may be relevant
  - source references used for follow-up verification

## Data model and source-of-truth

- Source-of-truth content is stored in `secondary_condition_finder.py` as structured suggestion records keyed by normalized primary condition.
- Each suggestion record includes:
  - `condition` (string)
  - `rank` (integer; lower number = higher priority)
  - `annotation` (string)
  - `source_references` (list of strings)
- CLI output now renders suggestions in ranked order with annotations and references.

### Usage

List supported primary conditions:

```bash
python secondary_condition_finder.py --list
```

Find secondary conditions for a specific primary condition:

```bash
python secondary_condition_finder.py "PTSD"
```

### Notes

- This is a starter implementation for quick lookup and experimentation.
- The output is not medical or legal advice and should be verified against official VA guidance and a qualified professional.
