import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { closeDb, db } from "./index.js";

const dir = join(import.meta.dirname, "../../migrations");
const sql = db();
await sql`create table if not exists _migrations (name text primary key, run_at timestamptz not null default now())`;
const done = new Set((await sql`select name from _migrations`).map((r) => r.name as string));
for (const file of (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort()) {
  if (done.has(file)) continue;
  await sql.begin(async (tx) => {
    await tx.unsafe(await readFile(join(dir, file), "utf8"));
    await tx`insert into _migrations (name) values (${file})`;
  });
  console.log(`applied ${file}`);
}
await closeDb();
