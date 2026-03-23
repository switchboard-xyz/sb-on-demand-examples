#!/usr/bin/env bun

import { MONAD_NETWORKS, runForgeDeploy } from "../../network";

runForgeDeploy({
  script:
    "deploy/DeploySwitchboardPriceConsumer.s.sol:DeploySwitchboardPriceConsumer",
  label: "SwitchboardPriceConsumer",
  allowedNetworks: MONAD_NETWORKS,
}).catch((error) => {
  console.error("\n❌ Error:", error.message || error);
  process.exit(1);
});
