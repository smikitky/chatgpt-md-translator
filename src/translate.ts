import { ApiCaller } from './api.js';
import { Config } from './loadConfig.js';
import { splitStringAtBlankLines } from './md-utils.js';
import { Status, statusToText } from './status.js';

export const translateOne = async (
  callApi: ApiCaller,
  text: string,
  config: Config,
  onStatus: (status: Status) => void
): Promise<string> => {
  onStatus({ status: 'waiting' });
  const res = await callApi(text, config, onStatus);

  if (
    res.status === 'error' &&
    res.message.match(/reduce the length|stream read error/i)
  ) {
    // Looks like the input was too long, so split the text in half and retry
    const splitResult = splitStringAtBlankLines(text, 0);
    console.log(
      'Split: ',
      splitResult?.map(s => s.length + ':' + s.slice(0, 20)).join(', ')
    );
    console.log('\n\n');
    if (splitResult === null) return text; // perhaps code blocks only
    return await translateMultiple(callApi, splitResult, config, onStatus);
  }

  if (res.status === 'error') throw new Error(res.message);
  return (res as { translation: string }).translation;
};

export const translateMultiple = async (
  callApi: ApiCaller,
  fragments: string[],
  config: Config,
  onStatus: (status: Status) => void
) => {
  const statuses: Status[] = new Array(fragments.length).fill(0).map(() => ({
    status: 'waiting'
  }));
  onStatus({ status: 'pending', lastToken: '' });
  const handleNewStatus = (index: number) => {
    return (status: Status) => {
      statuses[index] = status;
      onStatus({
        status: 'pending',
        lastToken: `[${statuses.map(statusToText).join(', ')}]`
      });
    };
  };
  const results = await Promise.all(
    fragments.map((fragment, index) =>
      translateOne(callApi, fragment, config, handleNewStatus(index))
    )
  );
  const finalResult = results.join('\n\n');
  onStatus({ status: 'done', translation: finalResult });
  return finalResult;
};
