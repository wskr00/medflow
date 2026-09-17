import { describe, expect, it, vi } from "vitest";
import { preventDoctorCareLoss } from "./doctor-care.guard";

describe("preventDoctorCareLoss", () => {
  it("delegates exit protection to the clinical draft state", () => {
    const canLeave = vi.fn(() => false);
    expect(
      preventDoctorCareLoss(
        { canLeave } as never,
        {} as never,
        {} as never,
        {} as never,
      ),
    ).toBe(false);
    expect(canLeave).toHaveBeenCalledOnce();
  });
});
