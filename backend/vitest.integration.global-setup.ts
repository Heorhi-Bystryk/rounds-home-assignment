import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const TEST_DATABASE_URL =
  "postgresql://pulse:pulse@localhost:5433/pulse_test?schema=public";

export default function setup(): void {
  const name = new URL(TEST_DATABASE_URL).pathname.replace(/^\//, "");
  if (!name.endsWith("_test")) {
    throw new Error(
      `Refusing to run integration setup against database "${name}".`,
    );
  }

  process.env.DATABASE_URL = TEST_DATABASE_URL;

  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    cwd: path.dirname(fileURLToPath(import.meta.url)),
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: "inherit",
  });
}
