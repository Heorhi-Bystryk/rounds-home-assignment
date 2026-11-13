import pino from "pino";

export const logger = pino({ level: process.env.LOG_LEVEL ?? "info" });

export type AppLogger = {
  info: (obj: object, msg?: string) => void;
  error: (obj: object, msg?: string) => void;
};
