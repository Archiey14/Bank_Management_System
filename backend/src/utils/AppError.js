// An error that carries an HTTP status code. The error handler returns its
// message to the client for any status below 500.
class AppError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
  }
}

module.exports = AppError;
