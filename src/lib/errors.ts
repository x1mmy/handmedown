export type HttpStatus = 400 | 401 | 403 | 404 | 409 | 422;

export class AppError extends Error {
  readonly status: HttpStatus;

  constructor(status: HttpStatus, message: string) {
    super(message);
    this.name = "AppError";
    this.status = status;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
