export type LogFields = Record<string, unknown>;

function write(level: string, message: string, fields: LogFields = {}): void {
  const payload = {
    ts: new Date().toISOString(),
    level,
    message,
    ...fields,
  };
  console.log(JSON.stringify(payload));
}

export const logger = {
  info(message: string, fields?: LogFields) { write("info", message, fields); },
  warn(message: string, fields?: LogFields) { write("warn", message, fields); },
  error(message: string, fields?: LogFields) { write("error", message, fields); },
};
