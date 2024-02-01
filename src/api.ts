import { HttpsProxyAgent } from 'https-proxy-agent';
import fetch from 'node-fetch';
import * as rl from 'node:readline';
import { Config } from './loadConfig.js';
import { Status } from './status.js';

export type ErrorResponse = {
  error: {
    message: string;
    type: string;
    code: string;
    param: string;
  };
};

export type ApiStreamResponse = {
  id: string;
  model: string;
  choices: {
    index: number;
    delta: { content: string; role: string };
    finish_reason: string;
  }[];
};

export type ApiCaller = (
  text: string,
  config: Config,
  onStatus: (status: Status) => void,
  maxRetry?: number
) => Promise<Status>;

/**
 * Takes an async function and returns a new function
 * that can only be started once per interval.
 */
const limitCallRate = <T extends (...args: any[]) => Promise<any>>(
  func: T,
  interval: number
): T => {
  const queue: {
    args: Parameters<T>;
    resolve: (result: Awaited<ReturnType<T>>) => void;
    reject: (reason: any) => void;
  }[] = [];
  let processing = false;

  if (interval <= 0) return func;

  const processQueue = () => {
    if (queue.length === 0) {
      processing = false;
      return;
    }
    processing = true;
    const item = queue.shift()!;
    func(...item.args).then(item.resolve, item.reject);
    setTimeout(processQueue, interval * 1000);
  };

  return ((...args: Parameters<T>) => {
    return new Promise<Awaited<ReturnType<T>>>((resolve, reject) => {
      queue.push({ args, resolve, reject });
      if (!processing) processQueue();
    });
  }) as T;
};

export type ConfigureApiOptions = {
  apiAddress?: string;
  apiKey: string;
  rateLimit?: number;
  httpsProxy?: string;
};

const configureApiCaller = (options: ConfigureApiOptions) => {
  const { apiAddress = 'https://api.openai.com/v1', apiKey, rateLimit = 0, httpsProxy } = options;

  const callApi: ApiCaller = async (
    text,
    config,
    onStatus,
    maxRetry = 5
  ): Promise<Status> => {
    const { prompt, model, temperature } = config;
    const agent = httpsProxy ? new HttpsProxyAgent(httpsProxy) : undefined;
    const ac = new AbortController();

    onStatus({ status: 'pending', lastToken: '' });
    const response = await fetch(`${apiAddress}/chat/completions`, {
      agent,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      signal: ac.signal,
      body: JSON.stringify({
        model,
        temperature,
        messages: [
          {
            role: 'system',
            content: 'You are a translator for Markdown documents.'
          },
          { role: 'user', content: prompt },
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

    const retry = () => {
      onStatus({ status: 'pending', lastToken: `(Retrying ${maxRetry})` });
      return callApi(text, config, onStatus, maxRetry - 1);
    };

    let intervalId: NodeJS.Timeout | undefined;

    if (response.status >= 400) {
      const res = (await response.json()) as ErrorResponse;
      if (res.error.message.match(/You can retry/) && maxRetry > 0) {
        // Sometimes the API returns an error saying 'You can retry'. So we retry.
        return retry();
      }
      onStatus({ status: 'error', message: res.error.message });
      return { status: 'error', message: res.error.message };
    } else {
      const stream = response.body!;
      let resultText = '';
      let lastReceiveTime = new Date().getTime();
      const reader = rl.createInterface(stream);

      intervalId = setInterval(() => {
        // If the data transmission is stopped for 30 seconds, we retry.
        if (lastReceiveTime + 30000 < new Date().getTime()) {
          ac.abort('Server stopped responding');
        }
      }, 1000);

      try {
        for await (const line of reader) {
          lastReceiveTime = new Date().getTime();
          if (line.trim().length === 0) continue;
          if (line.includes('[DONE]')) break;
          const res = JSON.parse(line.split(': ', 2)[1]) as ApiStreamResponse;
          if (res.choices[0]?.finish_reason === 'length') {
            onStatus({ status: 'error', message: 'reduce the length.' });
            return { status: 'error', message: 'reduce the length.' };
          }
          const content = res.choices[0].delta.content ?? '';
          if (content.length)
            onStatus({ status: 'pending', lastToken: content });
          resultText += content;
        }
      } catch (err: any) {
        if (err?.name === 'AbortError' && maxRetry > 0) return retry();
        onStatus({ status: 'error', message: 'stream read error' });
        return { status: 'error', message: 'stream read error' };
      } finally {
        intervalId && clearInterval(intervalId);
      }
      onStatus({ status: 'done', translation: resultText });
      return { status: 'done', translation: resultText };
    }
  };
  return limitCallRate(callApi, rateLimit);
};

export default configureApiCaller;
