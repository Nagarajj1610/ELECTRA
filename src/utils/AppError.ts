/**
 * Custom application error class to handle API errors globally.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly errorCode: string;

  /**
   * Create a new AppError
   * @param message - The error message
   * @param statusCode - HTTP status code (default 500)
   * @param errorCode - Application specific error code
   */
  constructor(message: string, statusCode: number = 500, errorCode: string = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    Error.captureStackTrace(this, this.constructor);
  }
}
