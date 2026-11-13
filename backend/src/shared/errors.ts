export abstract class CompetitorPulseError extends Error {
  abstract readonly status: number;
  abstract readonly code: string;
}

export class BadRequestError extends CompetitorPulseError {
  readonly status = 400;
  constructor(readonly code = "invalid_request") {
    super(code);
    this.name = "BadRequestError";
  }
}

export class NotFoundError extends CompetitorPulseError {
  readonly status = 404;
  readonly code = "not_found";
  constructor() {
    super("not_found");
    this.name = "NotFoundError";
  }
}

export class ConflictError extends CompetitorPulseError {
  readonly status = 409;
  constructor(readonly code = "duplicate") {
    super(code);
    this.name = "ConflictError";
  }
}
