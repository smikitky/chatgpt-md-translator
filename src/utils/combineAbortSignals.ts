const combineAbortSignals = (...signals: AbortSignal[]) => {
  const controller = new AbortController();

  const onAbort = () => {
    for (const signal of signals) signal.removeEventListener('abort', onAbort);
    controller.abort();
  };

  for (const signal of signals) {
    if (signal.aborted) {
      onAbort();
      break;
    }
    signal.addEventListener('abort', onAbort);
  }
  return controller.signal;
};

export default combineAbortSignals;
