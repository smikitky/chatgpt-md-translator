import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { parse } from 'dotenv';
import { isNodeException } from './utils/error-utils.js';
import { readTextFile } from './utils/fs-utils.js';

const homeDir = os.homedir();

const overwritePolicies = ['skip', 'abort', 'overwrite'] as const;
export type OverwritePolicy = (typeof overwritePolicies)[number];

export interface Config {
  apiEndpoint: string;
  apiKey: string;
  prompt: string;
  model: string;
  baseDir: string | null;
  apiCallInterval: number;
  quiet: boolean;
  fragmentSize: number;
  temperature: number;
  codeBlockPreservationLines: number;
  out: string | null;
  outputFilePattern: string | null;
  overwritePolicy: OverwritePolicy;
  httpsProxy?: string;
}

const findFile = async (paths: string[]) => {
  for (const path of paths) {
    try {
      await fs.access(path);
      return path;
    } catch (e) {
      if (isNodeException(e) && e.code === 'ENOENT') continue;
      throw e; // Permission denied or other error
    }
  }
  return null;
};

export const findConfigFile = () =>
  findFile([
    path.join(process.cwd(), '.chatgpt-md-translator'),
    path.join(process.cwd(), '.env'),
    path.join(homeDir, '.config', 'chatgpt-md-translator', 'config'),
    path.join(homeDir, '.chatgpt-md-translator')
  ]);

export const findPromptFile = () =>
  findFile([
    path.join(process.cwd(), 'prompt.md'),
    path.join(process.cwd(), '.prompt.md'),
    path.join(homeDir, '.config', 'chatgpt-md-translator', 'prompt.md'),
    path.join(homeDir, '.chatgpt-md-translator-prompt.md')
  ]);

const resolveModelShorthand = (model: string): string => {
  const shorthands: { [key: string]: string } = {
    '4': 'gpt-4',
    '4large': 'gpt-4-32k',
    '3': 'gpt-3.5-turbo',
    '3large': 'gpt-3.5-turbo-16k'
  };
  return shorthands[model] ?? model;
};

export const loadConfig = async (args: {
  [key: string]: unknown;
}): Promise<{ config: Config; warnings: string[] }> => {
  const warnings: string[] = [];
  const configPath = await findConfigFile();
  if (!configPath) throw new Error('Config file not found.');
  const conf = parse(await readTextFile(configPath));
  if (!conf.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not set in config file.');
  }

  const promptPath = await findPromptFile();
  if (!promptPath) throw new Error('Prompt file not found.');

  const toNum = (input: unknown) => {
    if (input === undefined || input === null) return undefined;
    const num = Number(input);
    return Number.isNaN(num) ? undefined : num;
  };

  const outSuffix: string | null =
    conf.OUT_SUFFIX?.length > 0
      ? conf.OUT_SUFFIX
      : (args.out_suffix as string)?.length > 0
        ? (args.out_suffix as string)
        : null;
  if (outSuffix) {
    warnings.push('OUT_SUFFIX is deprecated. Use OUTPUT_FILE_PATTERN instead.');
  }

  const checkOverwritePolicy = (input: unknown): OverwritePolicy | null => {
    if (typeof input === 'string') {
      if (overwritePolicies.includes(input as OverwritePolicy))
        return input as OverwritePolicy;
      throw new Error(`Invalid overwrite policy: ${input}`);
    }
    return null;
  };

  const config = {
    apiEndpoint:
      conf.API_ENDPOINT ?? 'https://api.openai.com/v1/chat/completions',
    apiKey: conf.OPENAI_API_KEY,
    prompt: await readTextFile(promptPath),
    model: resolveModelShorthand(
      (args.model as string) ?? conf.MODEL_NAME ?? '3'
    ),
    baseDir: conf.BASE_DIR ?? null,
    apiCallInterval: toNum(args.interval) ?? toNum(conf.API_CALL_INTERVAL) ?? 0,
    quiet:
      (args.quiet as boolean | undefined) ?? process.stdout.isTTY === false,
    fragmentSize:
      toNum(args.fragment_size) ?? toNum(conf.FRAGMENT_TOKEN_SIZE) ?? 2048,
    temperature: toNum(args.temperature) ?? toNum(conf.TEMPERATURE) ?? 0.1,
    codeBlockPreservationLines: toNum(conf.CODE_BLOCK_PRESERVATION_LINES) ?? 5,
    out: (args.out as string)?.length > 0 ? (args.out as string) : null,
    outputFilePattern:
      (conf.OUTPUT_FILE_PATTERN?.length > 0
        ? conf.OUTPUT_FILE_PATTERN
        : null) ?? (outSuffix ? `{main}${outSuffix}` : null),
    overwritePolicy:
      checkOverwritePolicy(args.overwrite_policy) ??
      checkOverwritePolicy(conf.OVERWRITE_POLICY) ??
      'overwrite',
    httpsProxy: conf.HTTPS_PROXY ?? process.env.HTTPS_PROXY
  };

  if (config.outputFilePattern && !/{(\w+?)}/.test(config.outputFilePattern)) {
    warnings.push('OUTPUT_FILE_PATTERN does not contain any placeholder.');
  }

  return { config, warnings };
};
