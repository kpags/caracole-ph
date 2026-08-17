export class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

export function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next)
}

export function errorHandler(error, _req, res, _next) {
  if (error?.name === 'MulterError') return res.status(400).json({ message: error.code === 'LIMIT_FILE_SIZE' ? 'Hero banner media must be 500 MB or smaller' : error.message })
  if (error?.name === 'ZodError') return res.status(400).json({ message: 'Invalid request', errors: error.issues })
  if (error?.code === 'P2002') return res.status(409).json({ message: 'Email is already registered' })
  const status = error instanceof HttpError ? error.status : 500
  if (status === 500) console.error(error)
  return res.status(status).json({ message: error.message || 'Internal server error' })
}
