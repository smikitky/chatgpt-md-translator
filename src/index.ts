import dashdash from 'dashdash';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import pc from 'picocolors';
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

const options = [
  { names: ['model', 'm'], type: 'string', help: 'Model to use.' },
  { names: ['fragment-size', 'f'], type: 'number', help: 'Fragment size.' },
  { names: ['temperature', 't'], type: 'number', help: 'Temperature.' },
  { names: ['interval', 'i'], type: 'number', help: 'API call interval.' },
  { names: ['help', 'h'], type: 'bool', help: 'Print this help.' }
];

const printHelp = (parser: dashdash.Parser) => {
  console.log(pc.yellow('Usage: markdown-gpt-translator [options] <file>'));
  console.log(parser.help());
  console.log('Docs: https://github.com/smikitky/markdown-gpt-translator\n');
};

const main = async () => {
  const parser = dashdash.createParser({ options });
  const args = parser.parse();

  if (args.help || args._args.length !== 1) {
    if (args._args.length !== 1)
      console.log(pc.red('Specify one (and only one) markdown file.'));
    printHelp(parser);
    return;
  }

  const config = await loadConfig(args);

  const file = args._args[0];
  const filePath = path.resolve(config.baseDir, file);
  const markdown = await readTextFile(filePath);

  const { output: replacedMd, codeBlocks } = replaceCodeBlocks(markdown);
  const fragments = splitStringAtBlankLines(replacedMd, config.fragmentSize)!;

  let status: Status = { status: 'pending', lastToken: '' };

  console.log(pc.cyan(`Translating ${filePath}...`));
  console.log(
    pc.bold('Model:'),
    config.model + ',',
    pc.bold('Temperature:'),
    String(config.temperature),
    '\n\n'
  );
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
  console.log(`\n${pc.green('Translation done!')} Saved to ${filePath}.`);
};

main().catch(err => {
  console.error(pc.bgRed('Error'), pc.red(err.message));
  console.error(pc.gray(err.stack.split('\n').slice(1).join('\n')));
  process.exit(1);
});
