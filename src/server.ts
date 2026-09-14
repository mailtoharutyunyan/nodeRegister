import { createApp } from './app.js';
import { env } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './db/connect.js';
import { logger } from './lib/logger.js';

async function main(): Promise<void> {
  await connectDatabase(env.MONGO_URI);

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info(`Listening on port ${env.PORT} in ${env.NODE_ENV} mode`);
  });

  /**
   * Graceful shutdown — stop accepting connections, drain in-flight requests,
   * then close the DB. None of this existed in 2019; the process just died.
   */
  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`${signal} received, shutting down`);

    const forceExit = setTimeout(() => {
      logger.error('Shutdown timed out, forcing exit');
      process.exit(1);
    }, 10_000);
    forceExit.unref();

    server.close(async (error) => {
      if (error) logger.error({ err: error }, 'Error closing server');
      await disconnectDatabase();
      logger.info('Shutdown complete');
      process.exit(error ? 1 : 0);
    });
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    logger.fatal({ err: reason }, 'Unhandled promise rejection');
    void shutdown('unhandledRejection');
  });

  process.on('uncaughtException', (error) => {
    logger.fatal({ err: error }, 'Uncaught exception');
    process.exit(1);
  });
}

main().catch((error: unknown) => {
  logger.fatal({ err: error }, 'Failed to start');
  process.exit(1);
});
