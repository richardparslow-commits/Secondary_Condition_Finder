# Medium remediation: presumptive calendar-date validation

This remediation closes the audited Medium finding that presumptive service-history dates were previously validated only for `YYYY-MM-DD` shape rather than real calendar validity.

## Change

- `serviceHistorySchema` now uses Zod's ISO date validator for both optional service-date bounds.
- Date-order validation runs only after both supplied dates are individually valid, so an impossible calendar date is not misreported as a reversed range.
- Regression coverage includes malformed dates, impossible month/day combinations, Gregorian leap-year boundaries, impossible-end-date classification, and valid reversed ranges.
- The existing `invalid-date` UI message now tells the user to enter real calendar dates in `YYYY-MM-DD` format.

## Scope boundary

This change does not modify presumptive catalog data, qualifying service periods, exposure/location rules, recognized conditions, citation data, or the matching algorithm beyond rejecting invalid service-date input before matching.
