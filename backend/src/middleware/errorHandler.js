export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  if (err?.code === 11000) {
    return res.status(409).json({
      message: 'A record with these details already exists.',
      code: 'DUPLICATE',
    });
  }
  if (err?.name === 'CastError') {
    return res.status(400).json({ message: 'That record could not be found.', code: 'BAD_REQUEST' });
  }
  if (err?.name === 'ValidationError') {
    const details = Object.values(err.errors || {}).map((issue) => ({ message: issue.message }));
    return res.status(400).json({ message: details[0]?.message || 'Please check the entered values.', code: 'VALIDATION', details });
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'The request could not be read.', code: 'VALIDATION' });
  }

  const status = err.status || 500;
  if (status >= 500) console.error(err.stack || err.message || 'Unhandled error');
  return res.status(status).json({
    message: status >= 500 ? 'Something went wrong. Please try again.' : err.message,
    code: err.code || 'ERROR',
    details: err.details || undefined,
  });
}
