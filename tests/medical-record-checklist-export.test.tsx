// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MedicalRecordChecklist } from "@/components/secondary/MedicalRecordChecklist";
import type { ChecklistGroup } from "@/lib/secondary-workflow/medical-record-checklist";

const groups: ChecklistGroup[] = [
  {
    conditionId: "diabetic-retinopathy",
    conditionName: "Diabetic Retinopathy",
    bodySystem: "Visual System",
    etiologicalConsensus: "PROBABLE",
    contributingPrimaryNames: ["Diabetes Mellitus Type 2"],
    items: [
      { gap: "First located gap", category: "diagnosis", why: "First why text." },
      { gap: "Second gap", category: "imaging", why: "Second why text." },
    ],
  },
];

let capturedBlob: Blob | undefined;
const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;

function readBlobText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

beforeEach(() => {
  capturedBlob = undefined;
  URL.createObjectURL = vi.fn((blob: Blob | MediaSource) => {
    capturedBlob = blob as Blob;
    return "blob:medical-checklist";
  });
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  URL.createObjectURL = originalCreateObjectURL;
  URL.revokeObjectURL = originalRevokeObjectURL;
});

describe("Medical Record Checklist export", () => {
  it("keeps located items checked in the downloaded checklist", async () => {
    render(<MedicalRecordChecklist groups={groups} />);

    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    fireEvent.click(screen.getByRole("button", { name: "Download checklist" }));

    expect(capturedBlob).toBeInstanceOf(Blob);
    const text = await readBlobText(capturedBlob!);
    expect(text).toContain("[x] First located gap");
    expect(text).toContain("[ ] Second gap");
  });
});
