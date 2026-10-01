const queues = new Map<string, Promise<void>>();

export async function withSequentialRateLimit<T>(key: string, task: () => Promise<T>, delayMs = 100): Promise<T> {
  const previous = queues.get(key) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => { release = resolve; });
  queues.set(key, current);
  await previous;
  try {
    return await task();
  } finally {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    release();
    if (queues.get(key) === current) queues.delete(key);
  }
}

export async function runSequentially<T, R>(items: T[], task: (item: T) => Promise<R>, delayMs = 100): Promise<R[]> {
  const results: R[] = [];
  for (const item of items) {
    results.push(await task(item));
    if (item !== items[items.length - 1]) await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return results;
}
