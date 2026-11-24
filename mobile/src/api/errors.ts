export class ApiError extends Error {
  constructor(
    public code: string,
    public status = 0,
  ) {
    super(code);
    this.name = 'ApiError';
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}
