/**
 * Formats the given time in milliseconds into a human-readable string.
 *
 * @param msec - The time in milliseconds.
 * @returns A formatted string representing the time.
 */
const formatTime = (msec: number) => {
  const secs = Math.floor(msec / 1000);
  return secs < 60
    ? `${secs} second${secs === 1 ? '' : 's'}`
    : `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
};

export default formatTime;
