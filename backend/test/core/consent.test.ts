import { describe, expect, it } from "vitest";
import { consentTemplate } from "../../src/core/consent";
import { employerPolicy } from "../policy-factory";

describe("consentTemplate", () => {
  it("lists what is shared, what is proven and what is never shared, in plain words", () => {
    const text = consentTemplate("Acme Hospital", employerPolicy("Hiring a resident doctor", 21));
    expect(text).toContain("Acme Hospital");
    expect(text).toContain("Hiring a resident doctor");
    expect(text).toMatch(/you share degree and institution/);
    expect(text).toMatch(/you share license type and license status/);
    expect(text).toMatch(/at least 21 years old without revealing your date of birth/);
    expect(text).toMatch(/Never shared: holder name, date of birth and address/);
    // No raw field identifiers leak into the holder-facing text.
    expect(text).not.toMatch(/holder_name|license_status|_/);
  });

  it("is deterministic", () => {
    const policy = employerPolicy("Same", 18);
    expect(consentTemplate("V", policy)).toBe(consentTemplate("V", policy));
  });
});
