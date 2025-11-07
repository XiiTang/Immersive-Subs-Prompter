/**
 * Logger utility with timestamp support for desktop app
 */

function getTimestamp(): string {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  const padMs = (n: number) => n.toString().padStart(3, '0');
  
  return `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}.${padMs(now.getMilliseconds())}`;
}

function formatMessage(level: string, prefix: string, message: string): string {
  return `[${getTimestamp()}] [${level}] [${prefix}] ${message}`;
}

export const logger = {
  log(prefix: string, message: string, ...rest: unknown[]) {
    console.log(formatMessage('INFO', prefix, message), ...rest);
  },
  
  error(prefix: string, message: string, ...rest: unknown[]) {
    console.error(formatMessage('ERROR', prefix, message), ...rest);
  },
  
  warn(prefix: string, message: string, ...rest: unknown[]) {
    console.warn(formatMessage('WARN', prefix, message), ...rest);
  },
  
  info(prefix: string, message: string, ...rest: unknown[]) {
    console.info(formatMessage('INFO', prefix, message), ...rest);
  }
};
