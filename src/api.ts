import type { Readable } from 'node:stream';
import { HttpsProxyAgent } from 'https-proxy-agent';
import fetch, { AbortError, type Response } from 'node-fetch';
import type { Config } from './loadConfig.js';
import type { ErrorStatus, SettledStatus, Status } from './status.js';
import combineAbortSignals from './utils/combineAbortSignals.js';
import { isMessageError } from './utils/error-utils.js';
import limitCallRate from './utils/limitCallRate.js';
import readlineFromStream from './utils/readlineFromStream.js';

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
  signal?: AbortSignal,
  maxRetry?: number
) => Promise<SettledStatus>;

export type ConfigureApiOptions = {
  apiEndpoint: string;
  apiKey: string;
  rateLimit?: number;
  httpsProxy?: string;
};

const configureApiCaller = (options: ConfigureApiOptions) => {
  const { apiEndpoint, apiKey, rateLimit = 0, httpsProxy } = options;

  const callApi: ApiCaller = async (
    text,
    config,
    onStatus,
    signal,
    maxRetry = 2
  ): Promise<SettledStatus> => {
    const { prompt, model, temperature } = config;
    const agent = httpsProxy ? new HttpsProxyAgent(httpsProxy) : undefined;
    const abortController = new AbortController();
    const combinedSignal = signal
      ? combineAbortSignals(abortController.signal, signal)
      : abortController.signal;

    let abortedByCaller = false;

    onStatus({ status: 'pending', lastToken: '' });
    const messages = [
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
    ];
    let response: Response;
    try {
      response = await fetch(apiEndpoint, {
        agent,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        signal: combinedSignal,
        body: JSON.stringify({
          model,
          temperature,
          messages,
          stream: true
        })
      });
    } catch (err: unknown) {
      if (err instanceof AbortError) {
        abortedByCaller = true;
        onStatus({ status: 'aborted' });
        return { status: 'aborted' };
      }
      const status: ErrorStatus = {
        status: 'error',
        message: isMessageError(err) ? err.message : 'network error'
      };
      onStatus(status);
      return status;
    }

    const retry = () => {
      onStatus({ status: 'pending', lastToken: `(Retrying ${maxRetry})` });
      return callApi(text, config, onStatus, signal, maxRetry - 1);
    };

    if (!response) throw new Error();

    if (response.status >= 400) {
      const res = (await response.json()) as ErrorResponse;
      if (
        res.error.message.match(/You can retry/) &&
        maxRetry > 0 &&
        !abortedByCaller
      ) {
        // Sometimes the API returns an error saying 'You can retry'. So we retry.
        return retry();
      }
      onStatus({ status: 'error', message: res.error.message });
      return { status: 'error', message: res.error.message };
    }
    const stream = response.body as Readable;
    let resultText = '';
    let lastReceiveTime = new Date().getTime();

    const intervalId = setInterval(() => {
      // If the data transmission is stopped for 30 seconds, we retry.
      if (lastReceiveTime + 30000 < new Date().getTime()) {
        abortController.abort('Server stopped responding');
      }
    }, 1000);

    try {
      for await (const line of readlineFromStream(stream)) {
        lastReceiveTime = new Date().getTime();
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
    } catch (err: unknown) {
      if (err instanceof AbortError && maxRetry > 0 && !abortedByCaller) {
        return retry();
      }
      const status: ErrorStatus = {
        status: 'error',
        message: err instanceof AbortError ? 'aborted' : 'stream read error'
      };
      onStatus(status);
      return status;
    } finally {
      intervalId && clearInterval(intervalId);
    }
    onStatus({ status: 'done', translation: resultText });
    return { status: 'done', translation: resultText };
  };
  return limitCallRate(callApi, rateLimit);
};

export default configureApiCaller;
