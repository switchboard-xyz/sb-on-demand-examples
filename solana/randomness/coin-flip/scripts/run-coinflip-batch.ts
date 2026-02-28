import fs from "fs";
import path from "path";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import util from "util";
import { createCoinFlipContext, runCoinFlip } from "./index.ts";

type RunRecord = {
  run: number;
  runId: string;
  status: "success" | "failure";
  reason?: string;
  startTime: string;
  endTime: string;
  durationMs: number;
  exitCode: number | null;
  commitSig?: string;
  revealSig?: string;
  logFile: string;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractFailureReason(output: string): string {
  const patterns: Array<{ reason: string; match: RegExp }> = [
    {
      reason: "Module not found",
      match: /ERR_MODULE_NOT_FOUND|Cannot find module/i,
    },
    {
      reason: "IDL not found",
      match: /IDL not found/i,
    },
    { reason: "No healthy oracle found", match: /No healthy oracle found/i },
    { reason: "Gateway error", match: /\[gateway:err\]|gateway/i },
    {
      reason: "Blockhash not found",
      match: /Blockhash not found/i,
    },
    {
      reason: "Confirm timeout",
      match: /Transaction was not confirmed/i,
    },
    {
      reason: "Exceeded compute units",
      match: /exceeded CUs meter|Program failed to complete/i,
    },
    {
      reason: "InstructionError Custom",
      match: /InstructionError: Custom/i,
    },
    {
      reason: "Randomness expired",
      match: /RandomnessExpired/i,
    },
    {
      reason: "Randomness already revealed",
      match: /RandomnessAlreadyRevealed/i,
    },
  ];

  for (const pattern of patterns) {
    if (pattern.match.test(output)) {
      return pattern.reason;
    }
  }

  return "Unknown";
}

function extractSignature(output: string, label: string): string | undefined {
  const regex = new RegExp(`${label}[^A-Za-z0-9]*([A-Za-z0-9]{20,})`, "i");
  const match = output.match(regex);
  return match?.[1];
}

async function runOne(
  run: number,
  guess: string,
  logDir: string,
  context: Awaited<ReturnType<typeof createCoinFlipContext>>
): Promise<RunRecord> {
  const runId = `run-${run}-${Date.now().toString(36)}`;
  const logFile = path.join(logDir, `${runId}.log`);
  const start = Date.now();
  const startTime = new Date(start).toISOString();

  const outputChunks: string[] = [];
  const stdoutWrite = process.stdout.write.bind(process.stdout);
  const stderrWrite = process.stderr.write.bind(process.stderr);
  const originalLog = console.log;
  const originalError = console.error;

  function capture(chunk: any) {
    outputChunks.push(
      typeof chunk === "string" ? chunk : Buffer.from(chunk).toString()
    );
  }

  process.stdout.write = ((chunk: any, ...args: any[]) => {
    capture(chunk);
    return stdoutWrite(chunk, ...args);
  }) as any;
  process.stderr.write = ((chunk: any, ...args: any[]) => {
    capture(chunk);
    return stderrWrite(chunk, ...args);
  }) as any;

  console.log = (...args: any[]) => {
    capture(`${util.format(...args)}\n`);
    originalLog(...args);
  };
  console.error = (...args: any[]) => {
    capture(`${util.format(...args)}\n`);
    originalError(...args);
  };

  let exitCode: number | null = 0;
  let commitSig: string | undefined;
  let revealSig: string | undefined;
  try {
    const result = await runCoinFlip(context, guess);
    commitSig = result?.commitSig;
    revealSig = result?.revealSig;
  } catch (err: any) {
    exitCode = 1;
    capture(`${err?.stack ?? String(err)}\n`);
  } finally {
    process.stdout.write = stdoutWrite as any;
    process.stderr.write = stderrWrite as any;
    console.log = originalLog;
    console.error = originalError;
  }

  const end = Date.now();
  const endTime = new Date(end).toISOString();
  const durationMs = end - start;
  const output = outputChunks.join("");

  fs.writeFileSync(logFile, output);

  const status: "success" | "failure" = exitCode === 0 ? "success" : "failure";
  const reason = status === "failure" ? extractFailureReason(output) : undefined;

  return {
    run,
    runId,
    status,
    reason,
    startTime,
    endTime,
    durationMs,
    exitCode,
    commitSig: commitSig ?? extractSignature(output, "commitTx"),
    revealSig: revealSig ?? extractSignature(output, "revealTx"),
    logFile,
  };
}

async function main() {
  const argv = yargs(hideBin(process.argv))
    .option("runs", {
      type: "number",
      default: 100,
      describe: "Number of runs",
    })
    .option("delay", {
      type: "number",
      default: 5000,
      describe: "Delay between runs in ms",
    })
    .option("guess", {
      type: "string",
      default: "heads",
      describe: "Guess for the coin flip (heads or tails)",
    })
    .option("output", {
      type: "string",
      describe: "Output JSONL path",
    })
    .strict()
    .parseSync();

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outputPath = argv.output
    ? path.resolve(process.cwd(), argv.output)
    : path.resolve(process.cwd(), "runs", `coinflip-mainnet-${timestamp}.jsonl`);
  const logDir = path.resolve(
    process.cwd(),
    "runs",
    `coinflip-mainnet-${timestamp}-logs`
  );

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.mkdirSync(logDir, { recursive: true });

  const context = await createCoinFlipContext();
  const summary: Record<string, number> = {};
  let successCount = 0;

  for (let i = 1; i <= argv.runs; i += 1) {
    console.log(`Starting run ${i} / ${argv.runs}`);
    const record = await runOne(i, argv.guess, logDir, context);
    fs.appendFileSync(outputPath, `${JSON.stringify(record)}\n`);

    if (record.status === "success") {
      successCount += 1;
    } else {
      const reason = record.reason ?? "Unknown";
      summary[reason] = (summary[reason] ?? 0) + 1;
    }

    if (i < argv.runs) {
      console.log(`Waiting ${argv.delay}ms before next run...`);
      await sleep(argv.delay);
    }
  }

  console.log("Batch complete");
  console.log(`Successes: ${successCount}`);
  console.log(`Failures: ${argv.runs - successCount}`);
  console.log("Failure breakdown:", summary);
  console.log(`Results JSONL: ${outputPath}`);
  console.log(`Logs: ${logDir}`);
}

main().catch((err) => {
  console.error("Batch run failed:", err);
  process.exit(1);
});
