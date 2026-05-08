import { describe, expect, it } from "vitest";
import { staffLoginSchema } from "@/lib/validators/auth-staff";

const VALID_CUID = "ckkpw7t2x000001jw3qpnh1g8";

describe("staffLoginSchema", () => {
  it("accetta PIN di 4 cifre", () => {
    const result = staffLoginSchema.safeParse({
      venueSlug: "casa-dei-gelsi",
      operatorId: VALID_CUID,
      pin: "1234",
    });
    expect(result.success).toBe(true);
  });

  it("accetta PIN di 6 cifre", () => {
    const result = staffLoginSchema.safeParse({
      venueSlug: "casa-dei-gelsi",
      operatorId: VALID_CUID,
      pin: "123456",
    });
    expect(result.success).toBe(true);
  });

  it("rifiuta PIN di 3 cifre", () => {
    const result = staffLoginSchema.safeParse({
      venueSlug: "casa-dei-gelsi",
      operatorId: VALID_CUID,
      pin: "123",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.find((i) => i.path[0] === "pin")?.message).toBe(
        "PIN deve essere 4-6 cifre"
      );
    }
  });

  it("rifiuta PIN di 7 cifre", () => {
    const result = staffLoginSchema.safeParse({
      venueSlug: "casa-dei-gelsi",
      operatorId: VALID_CUID,
      pin: "1234567",
    });
    expect(result.success).toBe(false);
  });

  it("rifiuta PIN non numerico", () => {
    const result = staffLoginSchema.safeParse({
      venueSlug: "casa-dei-gelsi",
      operatorId: VALID_CUID,
      pin: "abcd",
    });
    expect(result.success).toBe(false);
  });

  it("rifiuta operatorId non cuid", () => {
    const result = staffLoginSchema.safeParse({
      venueSlug: "casa-dei-gelsi",
      operatorId: "not-a-cuid",
      pin: "1234",
    });
    expect(result.success).toBe(false);
  });

  it("rifiuta venueSlug vuoto", () => {
    const result = staffLoginSchema.safeParse({
      venueSlug: "",
      operatorId: VALID_CUID,
      pin: "1234",
    });
    expect(result.success).toBe(false);
  });
});
