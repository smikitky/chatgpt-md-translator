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
  if (maxWidth === Number.POSITIVE_INFINITY) return str;
  let truncatedStr = str;
  while (stringWidth(truncatedStr) > maxWidth)
    truncatedStr = truncatedStr.slice(0, -1);
  return truncatedStr;
};

export const statusToText = (
  status: Status,
  maxWidth = Number.POSITIVE_INFINITY
): string => {
  switch (status.status) {
    case 'waiting':
      return '⏳';
    case 'pending': {
      const tok = status.lastToken.trim().replace(/\n/g, ' ');
      return `⚡${tok}`;
    }
    case 'split': {
      const m = status.members;
      let str = status.members.map(statusToText).join(', ');
      if (stringWidth(str) + 2 > maxWidth) {
        const doneCount = m.filter(m => m.status === 'done').length;
        const remaining = m
          .filter(m => m.status !== 'done')
          .map(statusToText)
          .join(', ');
        str = truncateStr(
          (doneCount > 0 ? `✅x${doneCount}, ` : '') + remaining,
          maxWidth - 2
        );
      }
      return `[${str}]`;
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
