import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";

const PROJECT_ROOT = path.resolve(__dirname, "..");
const PROGRAM_SOURCE_PATH = path.join(
  PROJECT_ROOT,
  "programs",
  "basic-oracle-example",
  "src",
  "lib.rs"
);
const IDL_OUTPUT_PATH = path.join(
  PROJECT_ROOT,
  "target",
  "idl",
  "basic_oracle_example.json"
);

function programAddressFromSource(source: string): string {
  const match = source.match(/declare_id!\("([^"]+)"\)/);
  if (!match) {
    throw new Error(`Failed to find declare_id! in ${PROGRAM_SOURCE_PATH}`);
  }

  return match[1];
}

function instructionDiscriminator(name: string): number[] {
  return [
    ...crypto.createHash("sha256").update(`global:${name}`).digest().subarray(0, 8),
  ];
}

const source = fs.readFileSync(PROGRAM_SOURCE_PATH, "utf8");
const address = programAddressFromSource(source);

const idl = {
  address,
  metadata: {
    name: "basic_oracle_example",
    version: "0.1.0",
    spec: "0.1.0",
    description: "Basic Switchboard On-Demand Oracle Integration Example",
  },
  instructions: [
    {
      name: "readOracleData",
      discriminator: instructionDiscriminator("read_oracle_data"),
      accounts: [
        {
          name: "quoteAccount",
          writable: false,
          signer: false,
        },
        {
          name: "sysvars",
          accounts: [
            {
              name: "clock",
              address: "SysvarC1ock11111111111111111111111111111111",
            },
          ],
        },
      ],
      args: [],
    },
  ],
  accounts: [],
  events: [],
  errors: [
    {
      code: 6000,
      name: "missingFeed",
      msg: "quote_account did not contain any feeds",
    },
  ],
  types: [],
};

fs.mkdirSync(path.dirname(IDL_OUTPUT_PATH), { recursive: true });
fs.writeFileSync(IDL_OUTPUT_PATH, `${JSON.stringify(idl, null, 2)}\n`);

console.log(`Wrote ${IDL_OUTPUT_PATH}`);
console.log(`Program address: ${address}`);
