/**
 * Takes an async function and returns a new function
 * that can only be started once per interval.
 */
const limitCallRate = <P extends any[], R>(
  func: (...args: P) => Promise<R>,
  interval: number
): ((...args: P) => Promise<R>) => {
  const queue: {
    args: P;
    resolve: (result: R) => void;
    reject: (reason: unknown) => void;
  }[] = [];
  let processing = false;

  if (interval <= 0) return func;

  const processQueue = () => {
    if (queue.length === 0) {
      processing = false;
      return;
    }
    processing = true;
    const item = queue.shift()!;
    func(...item.args).then(item.resolve, item.reject);
    setTimeout(processQueue, interval * 1000);
  };

  return (...args: P) => {
    return new Promise<R>((resolve, reject) => {
      queue.push({ args, resolve, reject });
      if (!processing) processQueue();
    });
  };
};

export default limitCallRate;
