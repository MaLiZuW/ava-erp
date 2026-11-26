/** Applies supabase/seed.sql (idempotent, test data) to the DEV project. */
import { readFileSync } from "node:fs";
import { Client } from "pg";
import { describeTarget, requireDbUrl } from "./lib/env";

async function main() {
  const url = requireDbUrl();
  console.log(`target: ${describeTarget(url)}`);
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await client.query(readFileSync("supabase/seed.sql", "utf8"));
    console.log("seed applied");
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
