/**
 * pgTAP + concurrency tests against the Supabase DEV project (cloud, test data only).
 * Every pgTAP file runs inside a transaction that is ROLLED BACK – nothing stays in the database.
 * The only persistent side effect: number_series rows for the fictional years 2997/2998 (concurrency test).
 */
import { Client } from "pg";
import { join } from "node:path";
import { describeTarget, requireDbUrl } from "./lib/env";
import { listTestFiles, printReports, runTapFile, type SqlExec } from "./lib/tap";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function concurrencyTest(url: string): Promise<boolean> {
  console.log("\nconcurrency: next_document_number()");
  const YEAR_LOCK = 2998;
  const YEAR_BURST = 2997;
  const fail = (msg: string) => {
    console.log(`FAIL ${msg}`);
    return false;
  };
  const num = (s: string) => Number(s.slice(s.lastIndexOf("-") + 1));
  const call = "select public.next_document_number('NZ', $1) as n";

  // 1) a second transaction must WAIT for the first one (row lock), then get the next number
  const a = new Client({ connectionString: url });
  const b = new Client({ connectionString: url });
  await a.connect();
  await b.connect();
  try {
    await a.query("begin");
    const na: string = (await a.query(call, [YEAR_LOCK])).rows[0].n;
    await b.query("begin");
    let bDone = false;
    const pb = b.query(call, [YEAR_LOCK]).then((r) => {
      bDone = true;
      return r.rows[0].n as string;
    });
    await sleep(1000);
    if (bDone) return fail("second transaction did not wait for the row lock");
    await a.query("commit");
    const nb = await pb;
    await b.query("rollback");
    if (num(nb) !== num(na) + 1) return fail(`expected ${num(na) + 1}, got ${nb} after ${na}`);
    console.log(`ok   second transaction waited and got ${nb} after ${na}`);
  } finally {
    await a.end();
    await b.end();
  }

  // 2) burst of parallel sessions: all numbers distinct and gap-free
  const clients = Array.from({ length: 10 }, () => new Client({ connectionString: url }));
  await Promise.all(clients.map((c) => c.connect()));
  try {
    const got = await Promise.all(
      clients.map(async (c) => (await c.query(call, [YEAR_BURST])).rows[0].n as string),
    );
    const nums = got.map(num).sort((x, y) => x - y);
    const distinct = new Set(nums).size === nums.length;
    const gapFree = nums[nums.length - 1] - nums[0] === nums.length - 1;
    if (!distinct || !gapFree) return fail(`burst produced ${got.join(", ")}`);
    console.log(
      `ok   10 parallel sessions produced distinct, gap-free numbers (${nums[0]}..${nums[nums.length - 1]})`,
    );
  } finally {
    await Promise.all(clients.map((c) => c.end()));
  }
  return true;
}

async function main() {
  const url = requireDbUrl();
  console.log(`target: ${describeTarget(url)}\n`);

  const client = new Client({ connectionString: url });
  await client.connect();
  const exec: SqlExec = async (sql) => {
    const res = await client.query(sql);
    const results = Array.isArray(res) ? res : [res];
    return results.flatMap((r) =>
      r.rows.map((row: Record<string, unknown>) => String(Object.values(row)[0] ?? "")),
    );
  };

  const reports = [];
  try {
    for (const { file, sql } of listTestFiles(join("supabase", "tests"))) {
      reports.push(await runTapFile(exec, file, sql));
    }
  } finally {
    await client.end();
  }
  const tapOk = printReports(reports);
  const concOk = await concurrencyTest(url);
  process.exit(tapOk && concOk ? 0 : 1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
