import postgres from "postgres";
import { config } from "../config.js";

let sql: postgres.Sql | null = null;
export function db(): postgres.Sql {
  if (!config.databaseUrl) throw new Error("DATABASE_URL is not set");
  sql ??= postgres(config.databaseUrl, { max: 5, idle_timeout: 20, onnotice: () => {} });
  return sql;
}

export async function closeDb() {
  await sql?.end({ timeout: 5 });
  sql = null;
}
