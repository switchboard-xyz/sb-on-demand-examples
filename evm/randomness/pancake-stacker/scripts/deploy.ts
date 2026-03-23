#!/usr/bin/env bun

import { MONAD_NETWORKS, runForgeDeploy } from "../../../network";

runForgeDeploy({
  script: "deploy/PancakeStacker.s.sol:PancakeStackerScript",
  label: "PancakeStacker",
  allowedNetworks: MONAD_NETWORKS,
}).catch((error) => {
  console.error("\n❌ Error:", error.message || error);
  process.exit(1);
});
