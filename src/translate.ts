import { ApiCaller } from './api.js';
import { Config } from './loadConfig.js';
import { splitStringAtBlankLines } from './md-utils.js';
import {
  Status,
  SettledStatus,
  extractErrorsFromStatus,
  DoneStatus
} from './status.js';

export const translateOne = async (
  callApi: ApiCaller,
  text: string,
  config: Config,
  onStatus: (status: Status) => void
): Promise<SettledStatus> => {
  onStatus({ status: 'waiting' });
  const res = await callApi(text, config, onStatus);

  if (
    res.status === 'error' &&
    res.message.match(/reduce the length|stream read error/i)
  ) {
    // Looks like the input was too long, so split the text in half and retry
    const splitResult = splitStringAtBlankLines(text, 0);
    if (splitResult === null) return { status: 'done', translation: text }; // perhaps code blocks only
    return await translateMultiple(callApi, splitResult, config, onStatus);
  }

  return res;
};

export const translateMultiple = async (
  callApi: ApiCaller,
  fragments: string[],
  config: Config,
  onStatus: (status: Status) => void
): Promise<SettledStatus> => {
  let members: Status[] = new Array(fragments.length).fill(0).map(() => ({
    status: 'waiting'
  }));
  onStatus({ status: 'split', members });
  await Promise.all(
    fragments.map((fragment, index) => {
      const onSubStatus = (status: Status) => {
        members = members.map((s, i) => (i === index ? status : s));
        onStatus({ status: 'split', members });
      };
      return translateOne(callApi, fragment, config, onSubStatus);
    })
  );
  const okay = members.every(m => m.status === 'done');
  if (okay) {
    const translation = members
      .map(m => (m as DoneStatus).translation)
      .join('\n\n');
    const lastStatus: Status = { status: 'done', translation };
    onStatus(lastStatus);
    return lastStatus;
  } else {
    const lastStatus: Status = {
      status: 'error',
      message: members.flatMap(extractErrorsFromStatus).join('\n')
    };
    onStatus(lastStatus);
    return lastStatus;
  }
};
