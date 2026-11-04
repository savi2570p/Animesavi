import { beforeEach, describe, expect, it } from "vitest";
import { getPinLockoutUntil, recordFailedPinAttempt, resetPinAttempts } from "./pinLock";

const HOUR = 60 * 60 * 1000;

describe("PIN lockout", () => {
  beforeEach(() => {
    localStorage.clear();
    resetPinAttempts();
  });

  it("does not lock after 2 wrong PINs", () => {
    recordFailedPinAttempt(1000);
    const r = recordFailedPinAttempt(1000);
    expect(r.lockedUntil).toBeNull();
    expect(getPinLockoutUntil(1000)).toBeNull();
  });

  it("locks for 1 hour on the 3rd wrong PIN", () => {
    recordFailedPinAttempt(1000);
    recordFailedPinAttempt(1000);
    const r = recordFailedPinAttempt(1000);
    expect(r.lockedUntil).toBe(1000 + HOUR);
    expect(getPinLockoutUntil(1000 + HOUR - 1)).toBe(1000 + HOUR);
  });

  it("allows PIN entry again once the hour has passed", () => {
    for (let i = 0; i < 3; i++) recordFailedPinAttempt(1000);
    expect(getPinLockoutUntil(1000 + HOUR)).toBeNull();
    expect(recordFailedPinAttempt(1000 + HOUR).lockedUntil).toBeNull();
  });
});
