import * as crypto from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as rl from 'node:readline';

import * as dotenv from 'dotenv';
import minimist from 'minimist';
import fetch from 'node-fetch';

// Run this like:
// npx ts-node-esm index.ts <file_name>

const __dirname = path.dirname(new URL(import.meta.url).pathname);

dotenv.config();
const apiKey = process.env.OPENAI_API_KEY;
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

/**
 * Split a string into multiple strings at blank lines.
 * @param input The string to split.
 * @param fragmentLength The soft maximum length of each fragment.
 * If the string is longer than this, it will be split at the nearest blank line.
 * If this is 0, the input will be split in half.
 */
const splitStringAtBlankLine = (
  input: string,
  fragmentLength: number = 2048
): string[] | null => {
  const lines = input.split('\n');
  let inCodeBlock = false;
  let currentFragment: string[] = [];
  let fragments: string[] = [];
  let nearstToHalfDiff: number = Infinity;
  let nearstToHalfIndex: number = -1;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('```')) inCodeBlock = !inCodeBlock;

    if (!inCodeBlock && lines[i].trim() === '') {
      const currentLength = currentFragment.join('\n').length;

      if (fragmentLength > 0) {
        if (currentLength + lines[i].length > fragmentLength) {
          fragments.push(currentFragment.join('\n'));
          currentFragment = [];
        }
      } else {
        const halfLength = Math.floor(lines.length / 2);
        if (Math.abs(halfLength - i) < nearstToHalfDiff) {
          nearstToHalfDiff = Math.abs(halfLength - i);
          nearstToHalfIndex = i;
        }
      }
    }
    currentFragment.push(lines[i]);
  }

  if (fragmentLength === 0) {
    if (nearstToHalfIndex === -1) return null; // no split point found
    fragments.push(lines.slice(0, nearstToHalfIndex).join('\n'));
    fragments.push(lines.slice(nearstToHalfIndex).join('\n'));
    return fragments;
  } else {
    fragments.push(currentFragment.join('\n'));
    return fragments;
  }
};

type ErrorResponse = {
  error: {
    message: string;
    type: string;
    code: string;
    param: string;
  };
};

type ApiStreamResponse = {
  id: string;
  model: string;
  choices: {
    index: number;
    delta: { content: string; role: string };
    finish_reason: string;
  }[];
};

type Status =
  | { status: 'pending'; lastToken: string }
  | { status: 'done'; translation: string }
  | { status: 'error'; message: string };

const statusToText = (status: Status): string => {
  switch (status.status) {
    case 'pending':
      if (status.lastToken.length === 0) return '⏳';
      return `⚡ ${status.lastToken.replace(/\n/g, ' ')}`;
    case 'done':
      return '✅';
    case 'error':
      return '❌ ' + status.message;
  }
};

const callApi = async (
  text: string,
  instruction: string,
  model: string,
  onStatus: (status: Status) => void,
  maxRetry = 5
): Promise<Status> => {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content: 'You are a translator for Markdown documents.'
        },
        { role: 'user', content: instruction },
        {
          role: 'assistant',
          content:
            'Okay, input the Markdown.\n' +
            'I will only return the translated text.'
        },
        { role: 'user', content: text }
      ],
      stream: true
    })
  });

  if (response.status >= 400) {
    const res = (await response.json()) as ErrorResponse;
    if (res.error.message.match(/You can retry/) && maxRetry > 0) {
      // Sometimes the API returns an error saying 'You can retry'. So we retry.
      onStatus({ status: 'pending', lastToken: `(Retrying ${maxRetry})` });
      return await callApi(text, instruction, model, onStatus, maxRetry - 1);
    }
    onStatus({ status: 'error', message: res.error.message });
    return { status: 'error', message: res.error.message };
  } else {
    const stream = response.body!;
    let resultText = '';
    const reader = rl.createInterface(stream);
    try {
      for await (const line of reader) {
        if (line.trim().length === 0) continue;
        if (line.includes('[DONE]')) break;
        const res = JSON.parse(line.split(': ', 2)[1]) as ApiStreamResponse;
        if (res.choices[0]?.finish_reason === 'length') {
          onStatus({ status: 'error', message: 'reduce the length.' });
          return { status: 'error', message: 'reduce the length.' };
        }
        const content = res.choices[0].delta.content ?? '';
        if (content.length) onStatus({ status: 'pending', lastToken: content });
        resultText += content;
      }
    } catch (err: any) {
      onStatus({ status: 'error', message: 'stream read error' });
      return { status: 'error', message: 'stream read error' };
    }
    onStatus({ status: 'done', translation: resultText });
    return { status: 'done', translation: resultText };
  }
};

const translateMultiple = async (
  fragments: string[],
  instruction: string,
  model: string,
  onStatus: (status: Status) => void
) => {
  const statuses: Status[] = new Array(fragments.length).fill(0).map(() => ({
    status: 'pending',
    lastToken: ''
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
      translateOne(fragment, instruction, model, handleNewStatus(index))
    )
  );
  const finalResult = results.join('\n\n');
  onStatus({ status: 'done', translation: finalResult });
  return finalResult;
};

const translateOne = async (
  text: string,
  instruction: string,
  model: string,
  onStatus: (status: Status) => void
): Promise<string> => {
  onStatus({ status: 'pending', lastToken: '' });
  const res = await callApi(text, instruction, model, onStatus);

  if (
    res.status === 'error' &&
    res.message.match(/reduce the length|stream read error/i)
  ) {
    // Looks like the input was too long, so split the text in half and retry
    const splitResult = splitStringAtBlankLine(text, 0);
    if (splitResult === null) return text; // perhaps code blocks only
    return await translateMultiple(splitResult, instruction, model, onStatus);
  }

  if (res.status === 'error') throw new Error(res.message);
  return (res as { translation: string }).translation;
};

type CodeBlocks = { [id: string]: string };

interface ReplaceResult {
  output: string;
  codeBlocks: CodeBlocks;
}

const replaceCodeBlocks = (mdContent: string): ReplaceResult => {
  const codeBlockRegex = /(```.*\n[\s\S]*?\n```)/g;
  const codeBlocks: CodeBlocks = {};
  const output = mdContent.replace(codeBlockRegex, match => {
    const lines = match.split('\n');
    if (lines.length >= 5) {
      const id = crypto.randomBytes(3).toString('hex');
      codeBlocks[id] = match;
      return `${lines[0]}\n(omittedCodeBlock-${id})\n\`\`\``;
    } else return match;
  });
  return { output, codeBlocks };
};

const restoreCodeBlocks = (
  mdContent: string,
  codeBlocks: CodeBlocks
): string => {
  const placeholderRegex = /```(.*?)\n\(omittedCodeBlock-([a-z0-9]+)\)\n```/g;
  return mdContent.replace(
    placeholderRegex,
    (_, lang, id) => codeBlocks[id] ?? '(code block not found)'
  );
};

const resolveModelShorthand = (model: string): string => {
  const shorthands: { [key: string]: string } = {
    '4': 'gpt-4',
    '4large': 'gpt-4-32k',
    '3': 'gpt-3.5-turbo'
  };
  return shorthands[model] ?? model;
};

const main = async () => {
  await checkConfiguration();

  const args = minimist(process.argv.slice(2));
  const model = resolveModelShorthand(args.m ?? process.env.MODEL_NAME ?? '3');
  const fragmentSize =
    Number(args.f) || Number(process.env.FRAGMENT_TOKEN_SIZE) || 2048;

  if (args._.length !== 1)
    throw new Error('Specify one (and only one) markdown file.');
  const file = args._[0] as string;

  const filePath = path.resolve(baseDir, file);
  const markdown = await fs.readFile(filePath, 'utf-8');
  const instruction = await fs.readFile(promptFile, 'utf-8');

  const { output: replacedMd, codeBlocks } = replaceCodeBlocks(markdown);
  const fragments = splitStringAtBlankLine(replacedMd, fragmentSize)!;

  let status: Status = { status: 'pending', lastToken: '' };

  console.log(`Translating ${file} using ${model}...\n`);
  const printStatus = () => {
    process.stdout.write('\x1b[1A\x1b[2K'); // clear previous line
    console.log(statusToText(status));
  };
  printStatus();

  const translatedText = await translateMultiple(
    fragments,
    instruction,
    model,
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
