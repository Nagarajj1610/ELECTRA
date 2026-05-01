/**
 * Custom application error class.
 */
export class AppError extends Error {
  constructor(public message: string, public statusCode: number, public errorCode: string) {
    super(message);
    this.name = 'AppError';
  }
}
