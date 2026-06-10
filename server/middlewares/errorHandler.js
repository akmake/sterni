// Global error handler
export const errorHandler = (err, req, res, next) => {
  console.error("💥 ERROR:", err);

  if (err.code === 'EBADCSRFTOKEN') {
    return res.status(403).json({ message: 'Invalid or missing CSRF token.' });
  }

  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  const isProd = process.env.NODE_ENV === 'production';
  // Never leak internal error details for 5xx in production — only operational
  // (4xx) errors carry a client-safe message.
  const safeMessage = (!isProd || err.statusCode < 500)
    ? (err.message || 'Something went very wrong!')
    : 'Internal Server Error';

  res.status(err.statusCode).json({
    status: err.status,
    message: safeMessage,
    ...(!isProd && { stack: err.stack }),
  });
};

// Wrapper for async route handlers to catch errors and pass them to the global handler
export const catchAsync = fn => {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
};