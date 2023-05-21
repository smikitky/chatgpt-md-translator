import fetch from 'node-fetch';
import * as rl from 'node:readline';
import { Status } from './status.js';

export type ApiOptions = {
  model: string;
  temperature: number;
};

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
  instruction: string,
  apiOptions: ApiOptions,
  onStatus: (status: Status) => void,
  maxRetry?: number
) => Promise<Status>;

const configureApiCaller = (apiKey: string) => {
  const callApi: ApiCaller = async (
    text,
    instruction,
    apiOptions,
    onStatus,
    maxRetry = 5
  ): Promise<Status> => {
    const { model, temperature } = apiOptions;
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        temperature,
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
        return await callApi(
          text,
          instruction,
          apiOptions,
          onStatus,
          maxRetry - 1
        );
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
          if (content.length)
            onStatus({ status: 'pending', lastToken: content });
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
  return callApi;
};

export default configureApiCaller;
