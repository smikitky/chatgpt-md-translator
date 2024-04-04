#!/usr/bin/env node

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import dashdash from 'dashdash';
import pc from 'picocolors';
import configureApiCaller from './api.js';
import { loadConfig } from './loadConfig.js';
import { type DoneStatus, type Status, statusToText } from './status.js';
import { translateMultiple } from './translate.js';
import formatTime from './utils/formatTime.js';
import {
  checkFileWritable,
  readTextFile,
  resolveOutFilePath
} from './utils/fs-utils.js';
import {
  replaceCodeBlocks,
  restoreCodeBlocks,
  splitStringAtBlankLines
} from './utils/md-utils.js';

const options = [
  { names: ['model', 'm'], type: 'string', help: 'Model to use.' },
  { names: ['fragment-size', 'f'], type: 'number', help: 'Fragment size.' },
  { names: ['temperature', 't'], type: 'number', help: 'Temperature.' },
  { names: ['interval', 'i'], type: 'number', help: 'API call interval.' },
  { names: ['quiet', 'q'], type: 'bool', help: 'Suppress status messages.' },
  { names: ['out', 'o'], type: 'string', help: 'Output file.' },
  {
    names: ['out-suffix'],
    type: 'string',
    help: 'Output file suffix.',
    hidden: true
  },
  { names: ['help', 'h'], type: 'bool', help: 'Print this help.' }
];

const main = async () => {
  const parser = dashdash.createParser({ options });
  const args = parser.parse();

  if (args.help || args._args.length !== 1) {
    if (args._args.length !== 1)
      console.log(pc.red('Specify one (and only one) markdown file.'));
    console.log(pc.yellow('Usage: chatgpt-md-translator [options] <file>'));
    console.log(parser.help());
    console.log('Docs: https://github.com/smikitky/chatgpt-md-translator\n');
    return;
  }

  const { config, warnings } = await loadConfig(args);
  for (const warning of warnings)
    console.error(pc.bgYellow('Warn'), pc.yellow(warning));

  const file = args._args[0];
  const filePath = path.resolve(config.baseDir ?? process.cwd(), file);
  const markdown = await readTextFile(filePath);

  const outFile = config.out
    ? path.resolve(config.baseDir ?? process.cwd(), config.out)
    : resolveOutFilePath(filePath, config.baseDir, config.outputFilePattern);
  await checkFileWritable(outFile);

  const { output: replacedMd, codeBlocks } = replaceCodeBlocks(
    markdown,
    config.codeBlockPreservationLines
  );
  const fragments = splitStringAtBlankLines(
    replacedMd,
    config.fragmentSize
  ) ?? [replacedMd];

  let status: Status = { status: 'pending', lastToken: '' };

  console.log(pc.cyan(`Translating: ${filePath}`));
  if (filePath !== outFile) console.log(pc.cyan(`To: ${outFile}`));

  console.log(
    pc.bold('Model:'),
    config.model,
    pc.bold('Temperature:'),
    String(config.temperature),
    '\n'
  );
  const printStatus = () => {
    if (args.quiet) return;
    process.stdout.write('\x1b[1A\x1b[2K'); // clear previous line
    console.log(statusToText(status));
  };
  printStatus();

  const callApi = configureApiCaller({
    apiEndpoint: config.apiEndpoint,
    apiKey: config.apiKey,
    rateLimit: config.apiCallInterval,
    httpsProxy: config.httpsProxy
  });

  const startTime = Date.now();
  const result = await translateMultiple(
    callApi,
    fragments,
    config,
    newStatus => {
      status = newStatus;
      printStatus();
    }
  );
  if (result.status === 'error') throw new Error(result.message);

  const translatedText = (result as DoneStatus).translation;
  const finalResult = `${restoreCodeBlocks(translatedText, codeBlocks)}\n`;
  const elapsedTime = Date.now() - startTime;

  await fs.writeFile(outFile, finalResult, 'utf-8');
  console.log(pc.green(`Translation completed in ${formatTime(elapsedTime)}.`));
  console.log(`File saved as ${outFile}.`);
};

main().catch(err => {
  console.error(pc.bgRed('Error'), pc.red(err.message));
  console.error(pc.gray(err.stack.split('\n').slice(1).join('\n')));
  process.exit(1);
});
