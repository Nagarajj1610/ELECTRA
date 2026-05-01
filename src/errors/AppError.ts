/**
 * Custom application error class.
 * Avoids TypeScript parameter properties for compatibility with Node --experimental-strip-types.
 */
export class AppError extends Error {
  public statusCode: number;
  public errorCode: string;

  constructor(message: string, statusCode: number, errorCode: string) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
  }
}
