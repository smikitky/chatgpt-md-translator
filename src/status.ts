import stringWidth from 'string-width';

export type WaitingStatus = { status: 'waiting' };
export type PendingStatus = { status: 'pending'; lastToken: string };
export type SplitStatus = { status: 'split'; members: Status[] };
export type DoneStatus = { status: 'done'; translation: string };
export type ErrorStatus = { status: 'error'; message: string };
export type AbortedStatus = { status: 'aborted' };
export type SettledStatus = DoneStatus | ErrorStatus | AbortedStatus;

export type Status =
  | WaitingStatus
  | PendingStatus
  | SplitStatus
  | DoneStatus
  | ErrorStatus
  | AbortedStatus;

export const truncateStr = (str: string, maxWidth: number): string => {
  if (maxWidth === Infinity) return str;
  while (stringWidth(str) > maxWidth) str = str.slice(0, -1);
  return str;
};

export const statusToText = (status: Status): string => {
  switch (status.status) {
    case 'waiting':
      return '⏳';
    case 'pending': {
      const tok = status.lastToken.trim().replace(/\n/g, ' ');
      return `⚡${tok}`;
    }
    case 'split': {
      return '[' + status.members.map(statusToText).join(', ') + ']';
    }
    case 'done':
      return '✅';
    case 'error':
      return '❌';
    case 'aborted':
      return '⛔';
  }
};

export const extractErrorsFromStatus = (status: Status): string[] => {
  switch (status.status) {
    case 'split':
      return status.members.flatMap(extractErrorsFromStatus);
    case 'error':
      return [status.message];
    default:
      return [];
  }
};
