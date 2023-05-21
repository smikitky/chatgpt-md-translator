import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import * as dotenv from 'dotenv';
import minimist from 'minimist';
import configureApiCaller, { ApiCaller, ApiOptions } from './api.js';
import {
  replaceCodeBlocks,
  restoreCodeBlocks,
  splitStringAtBlankLines
} from './md-utils.js';
import { Status, statusToText } from './status.js';

// Run this like:
// npx ts-node-esm index.ts <file_name>

const __dirname = path.dirname(new URL(import.meta.url).pathname);

dotenv.config();
export const apiKey = process.env.OPENAI_API_KEY;
const baseDir = process.env.GPT_TRANSLATOR_BASE_DIR ?? process.cwd();
const promptFile = path.resolve(
  __dirname,
  process.env.PROMPT_FILE ?? 'prompt.md'
);

const checkConfiguration = async () => {
  const errors = [];
  if (!apiKey) {
    errors.push('The OPENAI_API_KEY environment variable is not set.');
  }
  try {
    await fs.access(promptFile);
  } catch (e) {
    errors.push(`The prompt file "${promptFile}" does not exist.`);
  }
  if (errors.length) {
    console.error('Errors:');
    console.error(errors.join('\n'));
    process.exit(1);
  }
};

const translateMultiple = async (
  callApi: ApiCaller,
  fragments: string[],
  instruction: string,
  apiOptions: ApiOptions,
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
      translateOne(
        callApi,
        fragment,
        instruction,
        apiOptions,
        handleNewStatus(index)
      )
    )
  );
  const finalResult = results.join('\n\n');
  onStatus({ status: 'done', translation: finalResult });
  return finalResult;
};

const translateOne = async (
  callApi: ApiCaller,
  text: string,
  instruction: string,
  apiOptions: ApiOptions,
  onStatus: (status: Status) => void
): Promise<string> => {
  onStatus({ status: 'waiting' });
  const res = await callApi(text, instruction, apiOptions, onStatus);

  if (
    res.status === 'error' &&
    res.message.match(/reduce the length|stream read error/i)
  ) {
    // Looks like the input was too long, so split the text in half and retry
    const splitResult = splitStringAtBlankLines(text, 0);
    if (splitResult === null) return text; // perhaps code blocks only
    return await translateMultiple(
      callApi,
      splitResult,
      instruction,
      apiOptions,
      onStatus
    );
  }

  if (res.status === 'error') throw new Error(res.message);
  return (res as { translation: string }).translation;
};

const resolveModelShorthand = (model: string): string => {
  const shorthands: { [key: string]: string } = {
    '4': 'gpt-4',
    '4large': 'gpt-4-32k',
    '3': 'gpt-3.5-turbo'
  };
  return shorthands[model] ?? model;
};

const readTextFile = async (filePath: string): Promise<string> => {
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch (e: any) {
    if (e.code === 'ENOENT') {
      console.error(`File not found: ${filePath}`);
      process.exit(1);
    } else {
      throw e;
    }
  }
};

const main = async () => {
  await checkConfiguration();

  const args = minimist(process.argv.slice(2));
  const model = resolveModelShorthand(args.m ?? process.env.MODEL_NAME ?? '3');
  const temperature = Number(args.t) || Number(process.env.TEMPERATURE) || 0.1;
  const fragmentSize =
    Number(args.f) || Number(process.env.FRAGMENT_TOKEN_SIZE) || 2048;
  const apiCallInterval =
    Number(args.i) || Number(process.env.API_CALL_INTERVAL) || 0;
  const httpsProxy = process.env.HTTPS_PROXY;

  if (args._.length !== 1)
    throw new Error('Specify one (and only one) markdown file.');
  const file = args._[0] as string;

  const filePath = path.resolve(baseDir, file);

  const markdown = await readTextFile(filePath);
  const instruction = await readTextFile(promptFile);

  const { output: replacedMd, codeBlocks } = replaceCodeBlocks(markdown);
  const fragments = splitStringAtBlankLines(replacedMd, fragmentSize)!;

  let status: Status = { status: 'pending', lastToken: '' };

  console.log(`Translating ${file}...\n`);
  console.log(`Model: ${model}, Temperature: ${temperature}\n\n`);
  const printStatus = () => {
    process.stdout.write('\x1b[1A\x1b[2K'); // clear previous line
    console.log(statusToText(status));
  };
  printStatus();

  const callApi = configureApiCaller({
    apiKey: apiKey!,
    rateLimit: apiCallInterval,
    httpsProxy
  });

  const translatedText = await translateMultiple(
    callApi,
    fragments,
    instruction,
    { model, temperature },
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
