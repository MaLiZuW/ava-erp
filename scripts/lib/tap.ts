/** Minimal TAP (pgTAP output) runner shared by the remote runner and the local sandbox. */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/** Runs SQL and returns the first column of every returned row as text (all statements, in order). */
export type SqlExec = (sql: string) => Promise<string[]>;

export interface TapReport {
  file: string;
  passed: number;
  failed: string[];
  diagnostics: string[];
  error?: string;
}

export function parseTap(file: string, lines: string[]): TapReport {
  const report: TapReport = { file, passed: 0, failed: [], diagnostics: [] };
  for (const chunk of lines) {
    for (const line of String(chunk).split("\n")) {
      if (/^ok \d+/.test(line)) report.passed++;
      else if (/^not ok \d+/.test(line)) report.failed.push(line);
      else if (line.startsWith("#")) report.diagnostics.push(line);
    }
  }
  return report;
}

export async function runTapFile(exec: SqlExec, file: string, sql: string): Promise<TapReport> {
  await exec("begin");
  try {
    await exec("create extension if not exists pgtap with schema extensions");
    // pgTAP functions live in schema "extensions"
    await exec("set local search_path = public, extensions");
    const lines = await exec(sql);
    const report = parseTap(file, lines);
    if (report.passed + report.failed.length === 0)
      report.error = "no TAP output (missing no_plan()/finish()?)";
    return report;
  } catch (e) {
    return {
      file,
      passed: 0,
      failed: [],
      diagnostics: [],
      error: e instanceof Error ? e.message : String(e),
    };
  } finally {
    await exec("rollback");
  }
}

export function listTestFiles(dir: string): { file: string; sql: string }[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".test.sql"))
    .sort()
    .map((f) => ({ file: f, sql: readFileSync(join(dir, f), "utf8") }));
}

/** Prints a report and returns true when everything passed. */
export function printReports(reports: TapReport[]): boolean {
  let ok = true;
  for (const r of reports) {
    const bad = r.failed.length > 0 || r.error;
    if (bad) ok = false;
    console.log(
      `${bad ? "FAIL" : "ok  "} ${r.file}  (${r.passed} passed, ${r.failed.length} failed)`,
    );
    for (const f of r.failed) console.log(`     ${f}`);
    if (bad) for (const d of r.diagnostics) console.log(`     ${d}`);
    if (r.error) console.log(`     ERROR: ${r.error}`);
  }
  const total = reports.reduce((s, r) => s + r.passed, 0);
  console.log(
    `\n${ok ? "ALL PASSED" : "FAILED"} – ${total} assertions passed in ${reports.length} files`,
  );
  return ok;
}
