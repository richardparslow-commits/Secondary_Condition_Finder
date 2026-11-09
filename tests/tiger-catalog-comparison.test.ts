import { describe, expect, it } from "vitest";
import { compareCatalogIdentities } from "../src/lib/tiger/catalog-comparison";

describe("Tiger read-only catalog comparison", () => {
  it("matches identical catalog identities", () => {
    expect(compareCatalogIdentities([{ id: "a", name: "Alpha" }], [{ id: "a", name: "Alpha" }]))
      .toMatchObject({ missingInDatabase: 0, extraInDatabase: 0, differingNames: 0, duplicateDatabaseIds: 0 });
  });
  it("reports missing, unexpected, renamed and duplicate records without their contents", () => {
    expect(compareCatalogIdentities(
      [{ id: "a", name: "Alpha" }, { id: "b", name: "Beta" }],
      [{ id: "a", name: "Changed" }, { id: "z", name: "Other" }, { id: "z", name: "Other" }],
    )).toMatchObject({ missingInDatabase: 1, extraInDatabase: 1, differingNames: 1, duplicateDatabaseIds: 1 });
  });
});
