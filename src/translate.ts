import type { ApiCaller } from './api.js';
import type { Config } from './loadConfig.js';
import {
  type DoneStatus,
  type SettledStatus,
  type Status,
  extractErrorsFromStatus
} from './status.js';
import combineAbortSignals from './utils/combineAbortSignals.js';
import { splitStringAtBlankLines } from './utils/md-utils.js';

export const translateOne = async (
  callApi: ApiCaller,
  text: string,
  config: Config,
  onStatus: (status: Status) => void,
  signal?: AbortSignal
): Promise<SettledStatus> => {
  onStatus({ status: 'waiting' });

  const isRecoverableError = (res: Status) =>
    res.status === 'error' &&
    res.message.match(/reduce the length|stream read error/i);

  const handleStatus = (status: Status) => {
    if (isRecoverableError(status)) return;
    onStatus(status);
  };

  const res = await callApi(text, config, handleStatus, signal);
  if (isRecoverableError(res)) {
    // Looks like the input was too long, so split the text in half and retry
    const splitResult = splitStringAtBlankLines(text, 0);
    if (splitResult === null) {
      // perhaps code blocks only
      return { status: 'done', translation: text };
    }
    return await translateMultiple(callApi, splitResult, config, onStatus);
  }
  return res;
};

export const translateMultiple = async (
  callApi: ApiCaller,
  fragments: string[],
  config: Config,
  onStatus: (status: Status) => void,
  signal?: AbortSignal
): Promise<SettledStatus> => {
  let members: Status[] = new Array(fragments.length).fill({
    status: 'waiting'
  });

  const abortController = new AbortController();
  const combinedSignal = signal
    ? combineAbortSignals(signal, abortController.signal)
    : abortController.signal;

  onStatus({ status: 'split', members });
  await Promise.all(
    fragments.map((fragment, index) => {
      const onSubStatus = (status: Status) => {
        members = members.map((s, i) => (i === index ? status : s));
        onStatus({ status: 'split', members });
        if (status.status === 'error') abortController.abort();
      };
      return translateOne(
        callApi,
        fragment,
        config,
        onSubStatus,
        combinedSignal
      );
    })
  );
  const okay = members.every(m => m.status === 'done');
  if (!okay) {
    const lastStatus: Status = {
      status: 'error',
      message: members.flatMap(extractErrorsFromStatus).join('\n')
    };
    onStatus(lastStatus);
    return lastStatus;
  }

  const translation = members
    .map(m => (m as DoneStatus).translation)
    .join('\n\n');
  const lastStatus: Status = { status: 'done', translation };
  onStatus(lastStatus);
  return lastStatus;
};
