export type Status =
  | { status: 'waiting' }
  | { status: 'pending'; lastToken: string }
  | { status: 'done'; translation: string }
  | { status: 'error'; message: string };

export const statusToText = (status: Status): string => {
  switch (status.status) {
    case 'waiting':
      return '⏳';
    case 'pending':
      if (status.lastToken.length === 0) return '⚡';
      return `⚡ ${status.lastToken.replace(/\n/g, ' ')}`;
    case 'done':
      return '✅';
    case 'error':
      return '❌ ' + status.message;
  }
};
