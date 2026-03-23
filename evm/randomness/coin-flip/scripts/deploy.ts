#!/usr/bin/env bun

import { MONAD_NETWORKS, runForgeDeploy } from "../../../network";

runForgeDeploy({
  script: "deploy/CoinFlip.s.sol:CoinFlipScript",
  label: "CoinFlip",
  allowedNetworks: MONAD_NETWORKS,
}).catch((error) => {
  console.error("\n❌ Error:", error.message || error);
  process.exit(1);
});
