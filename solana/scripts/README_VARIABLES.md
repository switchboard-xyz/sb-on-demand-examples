# Switchboard Variable Override Scripts

**⚠️ MOVED: Job testing scripts have been relocated to `/scripts/job-testing/` for better organization.**

See [Job Testing Documentation](job-testing/README.md) for comprehensive information about:
- Custom job definition testing with `runJob.ts`
- Variable substitution patterns and examples
- Testing workflows and troubleshooting guides

## 🚀 Quick Start - New Location

**All job testing functionality has moved to [`/scripts/job-testing/`](job-testing/):**

```bash
# Basic job testing with environment variables  
VALUE=100 bun run scripts/job-testing/runJob.ts

# Test with API integration
POLYGON_API_KEY=your_key bun run scripts/job-testing/runJob.ts

# Multiple environment variables
POLYGON_API_KEY=your_key VALUE=12345 bun run scripts/job-testing/runJob.ts
```

## 🔧 Why This Move?

Job testing scripts have been consolidated into `/scripts/job-testing/` to:

1. **Improve Organization**: Group all testing-related functionality together
2. **Better Documentation**: Comprehensive testing guide with examples and troubleshooting
3. **Cleaner Structure**: Separate development/testing tools from production scripts  
4. **Enhanced Workflows**: Dedicated testing workflows and best practices

## 📖 Full Documentation

For complete information about job testing, variable overrides, and troubleshooting, see:

**➡️ [Job Testing Documentation](job-testing/README.md)**

This includes:
- Variable substitution syntax and examples
- Custom job definition patterns
- Testing workflows and best practices  
- Troubleshooting common issues
- API integration examples