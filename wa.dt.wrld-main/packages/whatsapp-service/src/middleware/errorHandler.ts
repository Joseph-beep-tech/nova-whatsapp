/**
 * Error Handler Middleware
 *
 * Handles errors and 404 responses.
 */

import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';

/**
 * Global error handler
 * Catches unhandled errors and returns a consistent JSON response
 */
export const errorHandler: ErrorRequestHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
  });
};

/**
 * 404 Not Found handler
 * Returns a helpful message for missing endpoints
 */
export const notFoundHandler = (_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found. All endpoints are under /service/* prefix.',
  });
};
