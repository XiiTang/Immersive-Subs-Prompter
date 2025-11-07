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

function formatArgs(args: unknown[]): string[] {
  return args.map(arg => {
    if (arg instanceof Error) {
      return `${arg.name}: ${arg.message}${arg.stack ? '\n' + arg.stack : ''}`;
    }
    if (typeof arg === 'object') {
      try {
        return JSON.stringify(arg);
      } catch {
        return String(arg);
      }
    }
    return String(arg);
  });
}

export const logger = {
  log(prefix: string, message: string, ...rest: unknown[]) {
    const formatted = formatArgs(rest);
    console.log(formatMessage('INFO', prefix, message), ...formatted);
  },
  
  error(prefix: string, message: string, ...rest: unknown[]) {
    const formatted = formatArgs(rest);
    console.error(formatMessage('ERROR', prefix, message), ...formatted);
  },
  
  warn(prefix: string, message: string, ...rest: unknown[]) {
    const formatted = formatArgs(rest);
    console.warn(formatMessage('WARN', prefix, message), ...formatted);
  },
  
  info(prefix: string, message: string, ...rest: unknown[]) {
    const formatted = formatArgs(rest);
    console.info(formatMessage('INFO', prefix, message), ...formatted);
  }
};
