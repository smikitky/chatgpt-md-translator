import typeUtils from 'node:util/types';

export const isNodeException = (
  error: unknown
): error is NodeJS.ErrnoException => {
  return typeUtils.isNativeError(error) && 'code' in error && 'errno' in error;
};

export const isMessageError = (
  error: unknown
): error is { message: string } => {
  return error !== null && typeof error === 'object' && 'message' in error;
};
