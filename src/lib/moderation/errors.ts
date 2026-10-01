export class ModerationError extends Error {
  constructor(public code: string, message = code, public status = 400) {
    super(message);
    this.name = "ModerationError";
  }
}
