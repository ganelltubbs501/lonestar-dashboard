import pino, { Logger } from 'pino';

const isServer = typeof window === 'undefined';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const log = (...args: any[]) => console.log(...args);

const clientLogger = {
  info: log,
  error: log,
  warn: log,
  debug: log,
  trace: log,
  fatal: log,
  child: () => clientLogger,
};

export const logger: Logger = isServer
  ? pino({
      level: process.env.LOG_LEVEL || 'info',
      transport:
        process.env.NODE_ENV === 'development'
          ? {
              target: 'pino-pretty',
              options: {
                colorize: true,
              },
            }
          : undefined,
    })
  : (clientLogger as unknown as Logger);

export default logger;
