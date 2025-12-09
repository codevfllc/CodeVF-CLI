/**
 * Custom error types for CodeVF
 */

export class CodeVFError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class AuthenticationError extends CodeVFError {
  constructor(message: string = 'Authentication failed') {
    super(message);
  }
}

export class InsufficientCreditsError extends CodeVFError {
  constructor(
    public available: number,
    public required: number,
    public pricingUrl: string
  ) {
    super(
      `Insufficient credits. Available: ${available}, Required: ${required}\nAdd credits: ${pricingUrl}`
    );
  }
}

export class SessionError extends CodeVFError {
  constructor(message: string = 'Session error occurred') {
    super(message);
  }
}

export class NetworkError extends CodeVFError {
  constructor(message: string = 'Network request failed') {
    super(message);
  }
}

export class TimeoutError extends CodeVFError {
  constructor(message: string = 'Operation timed out') {
    super(message);
  }
}

export class ConfigError extends CodeVFError {
  constructor(message: string = 'Configuration error') {
    super(message);
  }
}
