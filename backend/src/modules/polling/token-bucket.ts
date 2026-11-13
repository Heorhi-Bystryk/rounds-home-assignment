export type TokenBucket = {
  pause(seconds: number): void;
  take(): Promise<void>;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createTokenBucket(permitsPerSecond: number): TokenBucket {
  let tokens = permitsPerSecond;
  let updatedAt = Date.now();
  let pausedUntil = 0;

  function refill() {
    const current = Date.now();
    const elapsedSeconds = (current - updatedAt) / 1000;
    tokens = Math.min(permitsPerSecond, tokens + elapsedSeconds * permitsPerSecond);
    updatedAt = current;
  }

  return {
    pause(seconds: number) {
      pausedUntil = Math.max(pausedUntil, Date.now() + seconds * 1000);
    },
    async take() {
      const pauseMs = pausedUntil - Date.now();
      if (pauseMs > 0) {
        await sleep(pauseMs);
      }
      refill();
      if (tokens < 1) {
        await sleep(((1 - tokens) / permitsPerSecond) * 1000);
        refill();
      }
      tokens -= 1;
    },
  };
}
