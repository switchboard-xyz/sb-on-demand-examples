import * as sb from "@switchboard-xyz/on-demand";
import { PublicKey } from "@solana/web3.js";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import fs from "fs";
import path from "path";

type OracleGatewayRecord = {
  oracle: string;
  gateway: string;
  gatewayHost: string;
  queues: string[];
};

type GatewayGroup = {
  gateway: string;
  gatewayHost: string;
  oracles: string[];
  queues: string[];
};

function stripNulls(value: string): string {
  return value.replace(/\0+$/, "");
}

function normalizeGatewayHostname(value: string | null | undefined): string {
  if (!value) {
    return "";
  }
  const trimmed = stripNulls(value).trim();
  if (!trimmed) {
    return "";
  }

  try {
    const url = new URL(trimmed);
    return url.hostname.toLowerCase();
  } catch {
    // Fall through and try to coerce into a URL
  }

  try {
    const url = new URL(`http://${trimmed}`);
    return url.hostname.toLowerCase();
  } catch {
    // Final fallback below
  }

  const noScheme = trimmed.replace(/^https?:\/\//i, "");
  const host = noScheme.split("/")[0];
  return host.toLowerCase();
}

function decodeGatewayUri(value: unknown): string {
  if (!value) {
    return "";
  }
  if (Buffer.isBuffer(value)) {
    return value.toString();
  }
  if (value instanceof Uint8Array) {
    return Buffer.from(value).toString();
  }
  if (Array.isArray(value)) {
    return Buffer.from(value).toString();
  }
  return String(value);
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function main() {
  const argv = yargs(hideBin(process.argv))
    .option("output", {
      type: "string",
      describe: "Output JSON path",
    })
    .strict()
    .parseSync();

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const defaultOutput = path.resolve(
    process.cwd(),
    "runs",
    `gateway-list-${timestamp}.json`
  );
  const outputPath = argv.output
    ? path.resolve(process.cwd(), argv.output)
    : defaultOutput;

  const runsDir = path.dirname(outputPath);
  fs.mkdirSync(runsDir, { recursive: true });

  const config = await sb.AnchorUtils.loadEnv();
  const program = config.program;

  console.log("Scanning queues on program", program.programId.toString());
  console.log("RPC endpoint", config.connection.rpcEndpoint);

  const queueAccounts = await program.account.queueAccountData.all();
  const oracleToQueues = new Map<string, Set<string>>();
  let totalOraclesListed = 0;

  for (const queueAccount of queueAccounts) {
    const queuePubkey = queueAccount.publicKey.toString();
    const data: any = queueAccount.account;
    const oracleKeys: PublicKey[] = data.oracleKeys ?? [];
    const oracleKeysLen =
      typeof data.oracleKeysLen === "number"
        ? data.oracleKeysLen
        : data.oracleKeysLen?.toNumber?.() ?? oracleKeys.length;
    const oracles = oracleKeys.slice(0, oracleKeysLen);

    totalOraclesListed += oracles.length;

    for (const oracleKey of oracles) {
      const oraclePubkey = oracleKey.toString();
      const queues = oracleToQueues.get(oraclePubkey) ?? new Set<string>();
      queues.add(queuePubkey);
      oracleToQueues.set(oraclePubkey, queues);
    }
  }

  const oracleKeys = Array.from(oracleToQueues.keys()).map(
    (key) => new PublicKey(key)
  );
  const oracleGatewayRecords: OracleGatewayRecord[] = [];
  const missingGatewayOracles: string[] = [];

  const chunks = chunkArray(oracleKeys, 100);
  for (let i = 0; i < chunks.length; i += 1) {
    const chunk = chunks[i];
    const oracleDataList = await sb.Oracle.loadMany(program, chunk);
    oracleDataList.forEach((oracleData, idx) => {
      if (!oracleData) {
        return;
      }
      const oracleKey = chunk[idx].toString();
      const gateway = stripNulls(decodeGatewayUri(oracleData.gatewayUri)).trim();
      const gatewayHost = normalizeGatewayHostname(gateway);
      const queues = Array.from(
        oracleToQueues.get(oracleKey) ?? new Set<string>()
      );

      if (!gateway) {
        missingGatewayOracles.push(oracleKey);
        return;
      }

      oracleGatewayRecords.push({
        oracle: oracleKey,
        gateway,
        gatewayHost,
        queues,
      });
    });

    if ((i + 1) % 5 === 0 || i === chunks.length - 1) {
      console.log(
        `Processed ${Math.min((i + 1) * 100, oracleKeys.length)} / ${
          oracleKeys.length
        } oracles`
      );
    }
  }

  const gatewayGroups = new Map<string, GatewayGroup>();
  for (const record of oracleGatewayRecords) {
    const key = record.gatewayHost || record.gateway;
    const existing = gatewayGroups.get(key);
    if (existing) {
      existing.oracles.push(record.oracle);
      record.queues.forEach((queue) => existing.queues.push(queue));
    } else {
      gatewayGroups.set(key, {
        gateway: record.gateway,
        gatewayHost: record.gatewayHost,
        oracles: [record.oracle],
        queues: [...record.queues],
      });
    }
  }

  const gateways: GatewayGroup[] = Array.from(gatewayGroups.values()).map(
    (group) => ({
      ...group,
      oracles: Array.from(new Set(group.oracles)),
      queues: Array.from(new Set(group.queues)),
    })
  );

  gateways.sort((a, b) =>
    a.gatewayHost.localeCompare(b.gatewayHost || a.gateway)
  );

  const report = {
    scannedAt: new Date().toISOString(),
    rpcEndpoint: config.connection.rpcEndpoint,
    programId: program.programId.toString(),
    totalQueues: queueAccounts.length,
    totalOraclesListed,
    uniqueOracles: oracleKeys.length,
    uniqueGateways: gateways.length,
    gateways,
    oracleGateways: oracleGatewayRecords,
    missingGatewayOracles,
  };

  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
  console.log(`Report written to ${outputPath}`);
  console.log(`Unique gateways: ${gateways.length}`);
  console.log(`Oracles missing gateway: ${missingGatewayOracles.length}`);

  console.log("Gateways:");
  for (const group of gateways) {
    console.log(
      `- ${group.gateway} (oracles: ${group.oracles.length}, queues: ${group.queues.length})`
    );
  }
}

main().catch((err) => {
  console.error("Gateway listing failed:", err);
  process.exit(1);
});
