import minimist from 'minimist';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import configureApiCaller, { ApiCaller } from './api.js';
import { Config, loadConfig } from './loadConfig.js';
import {
  replaceCodeBlocks,
  restoreCodeBlocks,
  splitStringAtBlankLines
} from './md-utils.js';
import readTextFile from './readTextFile.js';
import { Status, statusToText } from './status.js';

const translateMultiple = async (
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

const translateOne = async (
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

const main = async () => {
  const args = minimist(process.argv.slice(2));

  const config = await loadConfig(args);

  if (args._.length !== 1)
    throw new Error('Specify one (and only one) markdown file.');
  const file = args._[0];
  const filePath = path.resolve(config.baseDir, file);
  const markdown = await readTextFile(filePath);

  const { output: replacedMd, codeBlocks } = replaceCodeBlocks(markdown);
  const fragments = splitStringAtBlankLines(replacedMd, config.fragmentSize)!;

  let status: Status = { status: 'pending', lastToken: '' };

  console.log(`Translating ${file}...\n`);
  console.log(`Model: ${config.model}, Temperature: ${config.temperature}\n\n`);
  const printStatus = () => {
    process.stdout.write('\x1b[1A\x1b[2K'); // clear previous line
    console.log(statusToText(status));
  };
  printStatus();

  const callApi = configureApiCaller({
    apiKey: config.apiKey,
    rateLimit: config.apiCallInterval,
    httpsProxy: config.httpsProxy
  });

  const translatedText = await translateMultiple(
    callApi,
    fragments,
    config,
    newStatus => {
      status = newStatus;
      printStatus();
    }
  );

  const finalResult = restoreCodeBlocks(translatedText, codeBlocks) + '\n';

  await fs.writeFile(filePath, finalResult, 'utf-8');
  console.log(`\nTranslation done! Saved to ${filePath}.`);
};

main().catch(console.error);
