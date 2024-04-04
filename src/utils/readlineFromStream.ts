import { Readable } from 'node:stream';

export default async function* readlineFromStream(stream: Readable) {
  let remaining = '';
  for await (const chunk of stream) {
    remaining += chunk;
    let eolIndex;
    while ((eolIndex = remaining.indexOf('\n')) >= 0) {
      const line = remaining.slice(0, eolIndex);
      remaining = remaining.slice(eolIndex + 1);
      yield line;
    }
  }
  if (remaining.length > 0) yield remaining;
}
