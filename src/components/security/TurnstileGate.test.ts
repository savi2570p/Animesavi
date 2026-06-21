import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  STORAGE_KEY,
  ANALYTICS_KEY,
  DURATION_MS,
  isVerifiedNow,
  markVerified,
  clearVerification,
  isBotLike,
  recordAnalytics,
  readAnalytics,
  getAnalyticsSummary,
} from "./TurnstileGate";

describe("TurnstileGate verification window", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("first visit (no key) is NOT verified — modal must show", () => {
    expect(isVerifiedNow()).toBe(false);
  });

  it("after markVerified, user is verified for 24h", () => {
    const now = 1_000_000_000_000;
    markVerified(now);
    expect(isVerifiedNow(now)).toBe(true);
    expect(isVerifiedNow(now + DURATION_MS - 1)).toBe(true);
  });

  it("after 24 hours expiry, user is NOT verified — modal must show again", () => {
    const now = 1_000_000_000_000;
    markVerified(now);
    expect(isVerifiedNow(now + DURATION_MS)).toBe(false);
    expect(isVerifiedNow(now + DURATION_MS + 1)).toBe(false);
  });

  it("never re-prompts during the valid window", () => {
    const now = Date.now();
    markVerified(now);
    for (let h = 0; h < 24; h++) {
      expect(isVerifiedNow(now + h * 60 * 60 * 1000)).toBe(true);
    }
  });

  it("clearing browser data forces re-verification", () => {
    markVerified();
    expect(isVerifiedNow()).toBe(true);
    clearVerification();
    expect(isVerifiedNow()).toBe(false);
  });

  it("malformed storage value is treated as not verified", () => {
    localStorage.setItem(STORAGE_KEY, "not-a-number");
    expect(isVerifiedNow()).toBe(false);
  });
});

describe("isBotLike heuristics", () => {
  it("flags common bot UAs", () => {
    expect(isBotLike("Mozilla/5.0 (compatible; Googlebot/2.1)")).toBe(true);
    expect(isBotLike("HeadlessChrome/120")).toBe(true);
    expect(isBotLike("puppeteer-core")).toBe(true);
  });

  it("passes legitimate browsers", () => {
    expect(isBotLike("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/605")).toBe(false);
    expect(isBotLike("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120")).toBe(false);
  });
});

describe("Turnstile analytics", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("records and reads events", () => {
    recordAnalytics({ ts: 1, type: "shown", loadMs: 12 });
    recordAnalytics({ ts: 2, type: "verified", durationMs: 1500 });
    const events = readAnalytics();
    expect(events).toHaveLength(2);
    expect(events[0].type).toBe("shown");
  });

  it("computes success rate and averages", () => {
    recordAnalytics({ ts: 1, type: "shown", loadMs: 10 });
    recordAnalytics({ ts: 2, type: "verified", durationMs: 1000 });
    recordAnalytics({ ts: 3, type: "shown", loadMs: 20 });
    recordAnalytics({ ts: 4, type: "verified", durationMs: 2000 });
    const s = getAnalyticsSummary();
    expect(s.shown).toBe(2);
    expect(s.verified).toBe(2);
    expect(s.successRate).toBe(1);
    expect(s.avgLoadMs).toBe(15);
    expect(s.avgCompleteMs).toBe(1500);
  });

  it("caps log to 100 events to avoid perf impact", () => {
    for (let i = 0; i < 150; i++) recordAnalytics({ ts: i, type: "shown" });
    expect(readAnalytics()).toHaveLength(100);
  });

  it("dispatches turnstile:event for live dashboards", () => {
    const spy = vi.fn();
    window.addEventListener("turnstile:event", spy as EventListener);
    recordAnalytics({ ts: 1, type: "verified", durationMs: 800 });
    expect(spy).toHaveBeenCalledTimes(1);
    window.removeEventListener("turnstile:event", spy as EventListener);
  });

  it("ANALYTICS_KEY does not collide with verification key", () => {
    expect(ANALYTICS_KEY).not.toBe(STORAGE_KEY);
  });
});
