let notice: string | null = null;

export function setAuthNotice(message: string): void {
  notice = message;
}

export function takeAuthNotice(): string | null {
  const current = notice;
  notice = null;
  return current;
}
