import type { Request, Response, NextFunction } from 'express';

export function createLoggingMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    const originalSend = res.send.bind(res);

    res.send = function (data: any) {
      const duration = Date.now() - start;
      const statusCode = res.statusCode;
      const status = statusCode >= 400 ? '❌' : statusCode >= 300 ? '↪️ ' : '✓ ';

      console.log(`${status} [${statusCode}] ${req.method.padEnd(6)} ${req.path} (${duration}ms)`);

      return originalSend(data);
    };

    next();
  };
}
