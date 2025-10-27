import { CrossbarClient, OracleJob } from "@switchboard-xyz/common";
import { getAccessToken } from "./oauth.ts";

/**
 * Creates an Oracle Job definition to fetch Twitter/X follower count
 * @param username - Twitter/X username (without @)
 * @returns OracleJob configured to fetch follower count using OAuth 2.0
 */
function getTwitterFollowerCountJob(username: string): OracleJob {
  const job = OracleJob.fromObject({
    tasks: [
      {
        httpTask: {
          url: `https://api.twitter.com/2/users/by/username/${username}?user.fields=public_metrics`,
          method: "GET",
          headers: [
            {
              key: "Authorization",
              value: "Bearer ${TWITTER_ACCESS_TOKEN}",
            },
          ],
        },
      },
      {
        jsonParseTask: {
          path: "$.data.public_metrics.followers_count",
        },
      },
    ],
  });
  return job;
}


/**
 * Main function to fetch Twitter follower count using Switchboard oracle
 */
(async function main() {
  // Get username from command line args or use default
  const username = process.argv[2] || "elonmusk";

  // Run OAuth flow or prompt for token
  const accessToken = await getAccessToken();

  // Mask token for logging (show first 5 chars only)
  const maskedToken = accessToken.slice(0, 5) + "***";

  // Initialize Crossbar client (chain-agnostic)
  const crossbarClient = CrossbarClient.default();

  // Build oracle job with username
  const job = getTwitterFollowerCountJob(username);

  // Create an OracleFeed with the job
  const feed = {
    name: `Twitter Follower Count - @${username}`,
    jobs: [job],
  };

  console.log("⏳ Requesting data from Switchboard oracles...\n");

  const result = await crossbarClient.simulateFeed(
    feed,
    false, // includeReceipts
    { TWITTER_ACCESS_TOKEN: accessToken }
  );

  console.log("✅ Successfully fetched follower count!\n");

  // Parse and display results
  const followerCount = result.results?.[0];

  if (followerCount === undefined || followerCount === null) {
    throw new Error("Failed to fetch follower count from oracle. Response: " + JSON.stringify(result));
  }

  // Convert to number (oracle returns as number but TypeScript sees it as unknown)
  const followerCountNum = Number(followerCount);

  console.log("═══════════════════════════════════════");
  console.log(`   Username: @${username}`);
  console.log(`   Followers: ${Math.floor(followerCountNum).toLocaleString()}`);
  console.log("═══════════════════════════════════════\n");

  // Display additional oracle metadata
  console.log("📊 Oracle Response Metadata:");
  console.log(`   Raw Value: ${followerCount}`);
  console.log(`   Token Used: ${maskedToken}`);
  console.log(`   Timestamp: ${new Date().toISOString()}\n`);

})().catch((error) => {
  console.error("\n❌ Error fetching follower count:");

  // Mask any tokens in error messages
  let errorMessage = error.message || String(error);
  // Replace any long alphanumeric strings that look like tokens
  errorMessage = errorMessage.replace(/[A-Za-z0-9]{20,}/g, (match) => {
    return match.slice(0, 5) + "***";
  });

  console.error(errorMessage);

  if (error.message?.includes("404")) {
    console.error("\n💡 Tip: Make sure the username is correct and the account exists.\n");
  } else if (error.message?.includes("401") || error.message?.includes("403")) {
    console.error("\n💡 Tip: Your Twitter API token may be invalid or expired.");
    console.error("   Generate a new token at: https://developer.twitter.com/en/portal/dashboard\n");
  } else if (error.message?.includes("429")) {
    console.error("\n💡 Tip: You've hit Twitter's rate limit. Wait a few minutes and try again.\n");
  }

  process.exit(1);
});
