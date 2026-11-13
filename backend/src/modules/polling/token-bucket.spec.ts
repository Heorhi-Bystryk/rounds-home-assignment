import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTokenBucket } from "./token-bucket";

async function isPending(promise: Promise<unknown>): Promise<boolean> {
  let settled = false;
  void promise.then(
    () => {
      settled = true;
    },
    () => {
      settled = true;
    },
  );
  await Promise.resolve();
  return !settled;
}

describe("createTokenBucket", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("delays a take that exceeds the rate", async () => {
    const bucket = createTokenBucket(1);
    await bucket.take();

    const second = bucket.take();
    expect(await isPending(second)).toBe(true);

    await vi.advanceTimersByTimeAsync(1000);
    expect(await isPending(second)).toBe(false);
  });

  it("waits out a Retry-After pause before taking", async () => {
    const bucket = createTokenBucket(5);
    bucket.pause(2);

    const take = bucket.take();
    expect(await isPending(take)).toBe(true);

    await vi.advanceTimersByTimeAsync(2000);
    expect(await isPending(take)).toBe(false);
  });
});
