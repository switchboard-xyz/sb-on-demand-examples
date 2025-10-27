import * as readline from "readline";

/**
 * Prompt user to paste a token manually (hidden input)
 */
export async function promptForToken(): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });

  return new Promise((resolve) => {
    let muted = false;

    // Override _writeToOutput to hide characters
    const oldWriteToOutput = (rl as any)._writeToOutput;
    (rl as any)._writeToOutput = function _writeToOutput(stringToWrite: string) {
      if (muted) {
        // Don't show the characters being typed/pasted
        return;
      }
      oldWriteToOutput.apply(rl, [stringToWrite]);
    };

    rl.question("📋 Paste your Bearer Token here (hidden): ", (token) => {
      // Restore normal output
      muted = false;
      (rl as any)._writeToOutput = oldWriteToOutput;
      rl.close();

      const trimmed = token.trim();
      if (trimmed) {
        const length = trimmed.length;
        console.log(`\n✓ Token received (${length} characters)\n`);
      } else {
        console.log("\n⚠️  No token provided\n");
      }
      resolve(trimmed);
    });

    // Start muting after the prompt is displayed
    muted = true;
  });
}

/**
 * Get Bearer Token from user
 */
export async function getAccessToken(): Promise<string> {
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║        Twitter Bearer Token Authentication Required       ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");
  console.log("📖 How to get your Bearer Token:\n");
  console.log("1. Go to: https://developer.twitter.com/en/portal/projects-and-apps");
  console.log("2. Select your app (or create one if you don't have one)");
  console.log("3. Click on: Keys and tokens");
  console.log("4. Under 'Authentication Tokens' find 'Bearer Token'");
  console.log("5. Click 'Generate' (or 'Regenerate' if it already exists)");
  console.log("6. Copy the Bearer Token\n");

  return await promptForToken();
}
