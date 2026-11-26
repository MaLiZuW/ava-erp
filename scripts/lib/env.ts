import { existsSync } from "node:fs";

/** Loads .env.local (if present) and returns the DB URL; refuses to run without it. */
export function requireDbUrl(): string {
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
  const url = process.env.SUPABASE_DB_URL;
  if (!url) {
    console.error(
      "SUPABASE_DB_URL is not set. Put the DEV project's Postgres connection string (session pooler) " +
        "into .env.local – see DEPLOYMENT.md, section 'Supabase dev project'.",
    );
    process.exit(2);
  }
  return url;
}

/** Host only – never print credentials. */
export function describeTarget(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname}:${u.port || "5432"} as ${decodeURIComponent(u.username)}`;
  } catch {
    return "(unparsable connection string)";
  }
}
