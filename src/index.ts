#!/usr/bin/env node

import dashdash from 'dashdash';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import pc from 'picocolors';
import configureApiCaller from './api.js';
import { loadConfig } from './loadConfig.js';
import {
  replaceCodeBlocks,
  restoreCodeBlocks,
  splitStringAtBlankLines
} from './md-utils.js';
import readTextFile from './readTextFile.js';
import { Status, statusToText } from './status.js';
import { translateMultiple } from './translate.js';

const options = [
  { names: ['model', 'm'], type: 'string', help: 'Model to use.' },
  { names: ['fragment-size', 'f'], type: 'number', help: 'Fragment size.' },
  { names: ['temperature', 't'], type: 'number', help: 'Temperature.' },
  { names: ['interval', 'i'], type: 'number', help: 'API call interval.' },
  { names: ['out', 'o'], type: 'string', help: 'Output file.' },
  { names: ['out-suffix'], type: 'string', help: 'Output file suffix.' },
  { names: ['help', 'h'], type: 'bool', help: 'Print this help.' }
];

const main = async () => {
  const parser = dashdash.createParser({ options });
  const args = parser.parse();

  if (args.help || args._args.length !== 1) {
    if (args._args.length !== 1)
      console.log(pc.red('Specify one (and only one) markdown file.'));
    console.log(pc.yellow('Usage: markdown-gpt-translator [options] <file>'));
    console.log(parser.help());
    console.log('Docs: https://github.com/smikitky/chatgpt-md-translator\n');
    return;
  }

  const config = await loadConfig(args);

  const file = args._args[0];
  const filePath = path.resolve(config.baseDir, file);
  const markdown = await readTextFile(filePath);

  const { output: replacedMd, codeBlocks } = replaceCodeBlocks(
    markdown,
    config.codeBlockPreservationLines
  );
  const fragments = splitStringAtBlankLines(replacedMd, config.fragmentSize)!;

  let status: Status = { status: 'pending', lastToken: '' };

  console.log(pc.cyan(`Translating: ${filePath}`));
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

  let outFile = filePath;
  if (config.out) {
    outFile = path.resolve(path.dirname(filePath), config.out);
  } else if (config.outSuffix) {
    outFile = outFile.replace(/\.[a-zA-Z0-9]+$/, '') + config.outSuffix;
  }
  await fs.writeFile(outFile, finalResult, 'utf-8');
  console.log(`\n${pc.green('Translation done!')} Saved as ${outFile}.`);
};

main().catch(err => {
  console.error(pc.bgRed('Error'), pc.red(err.message));
  console.error(pc.gray(err.stack.split('\n').slice(1).join('\n')));
  process.exit(1);
});
