import { describe, expect, it } from "vitest";
import { CREDENTIAL_LAYOUTS, CREDENTIAL_TYPES } from "../src";

describe("credential layouts", () => {
  it.each(CREDENTIAL_TYPES)("%s has contiguous, unique indices 0..14", (type) => {
    const indices = CREDENTIAL_LAYOUTS[type].fields.map((f) => f.index);
    expect(indices).toEqual(Array.from({ length: 15 }, (_, i) => i));
    const names = CREDENTIAL_LAYOUTS[type].fields.map((f) => f.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("keeps PII fields out of the meta range", () => {
    for (const type of CREDENTIAL_TYPES) {
      for (const f of CREDENTIAL_LAYOUTS[type].fields) {
        if (f.index <= 8) expect(f.pii).toBe(false);
      }
    }
  });

  it("GovernmentId exposes dob_commitment at index 13 (age predicate)", () => {
    const f = CREDENTIAL_LAYOUTS.GovernmentId.fields.find((x) => x.name === "dob_commitment");
    expect(f?.index).toBe(13);
  });
});
