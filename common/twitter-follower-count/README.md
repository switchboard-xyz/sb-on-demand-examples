# Twitter/X Follower Count Oracle Example

This example demonstrates how to use Switchboard oracles to fetch real-time follower counts from Twitter/X accounts using **Bearer Token authentication**. This is a **chain-agnostic** example that works across Solana, EVM, Sui, and any blockchain supported by Switchboard.

## 🎯 Overview

This example shows how to:
- Authenticate with Twitter using a **Bearer Token** (no .env files needed!)
- Create a custom Oracle Job definition for the Twitter API
- Use variable overrides to securely pass authentication tokens
- Fetch data from authenticated APIs using Switchboard oracles
- Parse JSON responses and extract specific metrics
- Use the chain-agnostic `CrossbarClient` for simulation and testing

**Key Feature:** Simple Bearer Token authentication - just paste your token and go!

## 📋 Prerequisites

1. **Node.js** (v16 or higher)
2. **Twitter Developer Account** with an app created

## 🚀 Quick Start

### 1. Get Your Twitter Bearer Token

1. Go to [Twitter Developer Portal](https://developer.twitter.com/en/portal/projects-and-apps)
2. Create a new app (or use an existing one)
   - Just give it a name, that's it!
3. Click on your app → **Keys and tokens**
4. Find **"Bearer Token"** section
5. Click **"Generate"** (or "Regenerate")
6. Copy the token - you'll paste it when running the script

**That's it!** No OAuth setup, no callback URLs, no configuration needed.

### 2. Install Dependencies

```bash
npm install
```

### 3. Run the Example

```bash
npm start
```

The script will:
1. Show you how to get your Bearer Token
2. Ask you to paste your token (hidden input)
3. Fetch the follower count using Switchboard oracles

**That's it!** No .env files, no OAuth setup - just paste your token and go!

## 📖 Example Output

```
╔════════════════════════════════════════════════════════════╗
║    Twitter Follower Count Oracle - Switchboard Example    ║
╚════════════════════════════════════════════════════════════╝

🐦 Target: @elonmusk

╔════════════════════════════════════════════════════════════╗
║        Twitter Bearer Token Authentication Required       ║
╚════════════════════════════════════════════════════════════╝

📖 How to get your Bearer Token:

1. Go to: https://developer.twitter.com/en/portal/projects-and-apps
2. Select your app (or create one if you don't have one)
3. Click on: Keys and tokens
4. Under 'Authentication Tokens' find 'Bearer Token'
5. Click 'Generate' (or 'Regenerate' if it already exists)
6. Copy the Bearer Token

📋 Paste your Bearer Token here (hidden):

✓ Token received (92 characters)

🔗 Connected to Switchboard network
   Crossbar: https://crossbar.switchboard.xyz

⏳ Requesting data from Switchboard oracles...

✅ Successfully fetched follower count!

═══════════════════════════════════════
   Username: @elonmusk
   Followers: 234,567,890
═══════════════════════════════════════

📊 Oracle Response Metadata:
   Raw Value: 234567890
   Timestamp: 2025-01-26T10:30:45.123Z
```

## 🔍 How It Works

### 1. Bearer Token Authentication

**Why Bearer Token?**
- ✅ App-only authentication (simplest method)
- ✅ Never expires unless regenerated
- ✅ No OAuth configuration needed
- ✅ No callback URLs or browser flows
- ✅ Perfect for public data (follower counts, tweets, etc.)
- ✅ Works immediately - just paste and go

### 2. Oracle Job Definition

```typescript
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
```

### 3. Variable Overrides

The OAuth token is passed securely:

```typescript
const feed = {
  name: "Twitter Follower Count - @username",
  jobs: [job],
};

const result = await crossbarClient.simulateFeed(
  feed,
  false, // includeReceipts
  { TWITTER_ACCESS_TOKEN: accessToken }
);

const followerCount = Number(result.results[0]);
```

This ensures:
- ✅ Tokens are never stored in files
- ✅ Tokens are never exposed in job definitions
- ✅ Each run uses fresh authentication
- ✅ Works identically across all blockchains
- ✅ Oracle responses remain verifiable on-chain

### 4. Switchboard Oracle Consensus

1. Crossbar distributes the job to multiple oracle nodes
2. Each oracle fetches data from Twitter independently (with your token)
3. Responses are aggregated using median
4. Signed consensus result is returned

## 🔒 Security Features

### Hidden Token Input
- Token is not displayed when you paste it (like a password field)
- Shows character count instead of actual token
- Prevents shoulder surfing and terminal history exposure

### No File Storage
- Token is never saved to disk
- No .env files needed
- Token only exists in memory during execution
- Each run requires re-entering the token

## 🌐 Twitter API Details

### Endpoint Used
```
GET https://api.twitter.com/2/users/by/username/:username
  ?user.fields=public_metrics
```

### Response Format
```json
{
  "data": {
    "id": "123456789",
    "name": "Example User",
    "username": "example",
    "public_metrics": {
      "followers_count": 1000,
      "following_count": 500,
      "tweet_count": 2000,
      "listed_count": 10
    }
  }
}
```

### Authentication
- **Method:** Bearer Token (App-only auth)
- **Access Level:** Public data only
- **Rate Limits:** Twitter API v2 Free tier - 500,000 tweets/month

## 📊 Use Cases

### DeFi & NFT Projects
- **Social Verification:** Verify creator influence before minting
- **Gated Access:** Unlock features based on follower thresholds
- **Dynamic NFTs:** Update metadata based on social metrics

### Gaming & Social Apps
- **Reputation Systems:** On-chain reputation from social proof
- **Achievement NFTs:** Award badges for milestones
- **Leaderboards:** Rank players by social influence

### DAO Governance
- **Weighted Voting:** Votes proportional to followers
- **Proposal Gates:** Minimum followers to create proposals
- **Sybil Resistance:** Verify member authenticity

## 🔧 Customization

### Fetch Different User

```bash
npm start username_here
```

### Fetch Multiple Metrics

Modify the JSONPath to get all metrics:

```typescript
{
  jsonParseTask: {
    path: "$.data.public_metrics",
    // Returns: { followers_count, following_count, tweet_count, listed_count }
  },
}
```

### Use in Smart Contracts

This same job definition works on any blockchain:

#### Solana (Anchor)
```rust
#[derive(Accounts)]
pub struct VerifyInfluencer<'info> {
    pub oracle_quote: AccountInfo<'info>,
    // ... verify signatures
}
```

#### EVM (Solidity)
```solidity
function verifyInfluencer(bytes calldata oracleData) external {
    uint256 followerCount = parseSwitchboardData(oracleData);
    require(followerCount >= 10000, "Not enough followers");
}
```

#### Sui (Move)
```move
public entry fun verify_influencer(aggregator: &Aggregator) {
    let count = get_latest_value(aggregator);
    assert!(count >= 10000, EInsufficientFollowers);
}
```

## 🐛 Troubleshooting

### Error: "Unauthorized" or "401"
**Cause:** Bearer Token is invalid or incorrect

**Fix:**
1. Go to Twitter Developer Portal
2. Regenerate your Bearer Token
3. Make sure you copy the entire token (they're long!)
4. Check for spaces or line breaks when pasting

### Error: "403 Forbidden"
**Cause:** App doesn't have correct permissions or token is invalid

**Fix:**
1. Regenerate your Bearer Token
2. Make sure you're querying a public account
3. Verify your Twitter app is not suspended

### Error: "404 Not Found"
**Cause:** Username doesn't exist or is misspelled

**Fix:**
- Remove the @ symbol (use `elonmusk` not `@elonmusk`)
- Check the username spelling
- Verify the account exists

### Error: "429 Too Many Requests"
**Cause:** You've hit Twitter's rate limit

**Fix:**
- Twitter API v2 Free tier: 500,000 tweets/month
- Wait for rate limit reset (usually resets monthly)
- Upgrade your API tier for higher limits

### Token not being accepted
**Cause:** Token copied incorrectly

**Fix:**
- Make sure you're copying the **Bearer Token** (not API Key or Client ID)
- Copy the entire token in one go
- Don't include any extra spaces or characters

## 📚 Resources

- [Twitter API v2 Documentation](https://developer.twitter.com/en/docs/twitter-api)
- [Twitter Authentication Guide](https://developer.twitter.com/en/docs/authentication)
- [Twitter Developer Portal](https://developer.twitter.com/en/portal/dashboard)
- [Switchboard Documentation](https://docs.switchboard.xyz)
- [Oracle Job Definitions](https://docs.switchboard.xyz/api/jobs)
- [Variable Overrides Guide](https://docs.switchboard.xyz/guides/variable-overrides)

## 🤝 Contributing

Found a bug or want to add a feature? Pull requests are welcome!

## 📄 License

MIT

---

**Built with [Switchboard](https://switchboard.xyz)** - Decentralized Oracle Infrastructure for Web3
