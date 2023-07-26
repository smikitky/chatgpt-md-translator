import { parse } from 'dotenv';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import readTextFile from './readTextFile.js';

const homeDir = os.homedir();

export interface Config {
  apiKey: string;
  prompt: string;
  model: string;
  baseDir: string;
  apiCallInterval: number;
  fragmentSize: number;
  temperature: number;
  httpsProxy?: string;
}

const findFile = async (paths: string[]) => {
  for (const path of paths) {
    try {
      await fs.access(path);
      return path;
    } catch (e) {
      continue;
    }
  }
  return null;
};

export const findConfigFile = () =>
  findFile([
    path.join(process.cwd(), '.markdown-gpt-translator'),
    path.join(process.cwd(), '.env'),
    path.join(homeDir, '.config', 'markdown-gpt-translator', 'config'),
    path.join(homeDir, '.markdown-gpt-translator')
  ]);

export const findPromptFile = () =>
  findFile([
    path.join(process.cwd(), 'prompt.md'),
    path.join(process.cwd(), '.prompt.md'),
    path.join(homeDir, '.config', 'markdown-gpt-translator', 'prompt.md'),
    path.join(homeDir, '.markdown-gpt-translator-prompt.md')
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

export const loadConfig = async (args: any): Promise<Config> => {
  const configPath = await findConfigFile();
  if (!configPath) throw new Error('Config file not found.');
  const conf = parse(await readTextFile(configPath));
  if (!conf.OPENAI_API_KEY)
    throw new Error('OPENAI_API_KEY is not set in config file.');

  const promptPath = await findPromptFile();
  if (!promptPath) throw new Error('Prompt file not found.');

  return {
    apiKey: conf.OPENAI_API_KEY,
    prompt: await readTextFile(promptPath),
    model: resolveModelShorthand(args.model ?? conf.MODEL_NAME ?? 3),
    baseDir: conf.BASE_DIR ?? process.cwd(),
    apiCallInterval:
      Number(args.interval) || Number(conf.API_CALL_INTERVAL) || 0,
    fragmentSize:
      Number(args.fragment_size) || Number(conf.FRAGMENT_TOKEN_SIZE) || 2048,
    temperature: Number(args.temperature) || Number(conf.TEMPERATURE) || 0.1,
    httpsProxy: conf.HTTPS_PROXY ?? process.env.HTTPS_PROXY
  };
};
