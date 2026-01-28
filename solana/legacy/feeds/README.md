# Legacy Feed Scripts

This directory contains deprecated feed scripts that are maintained for compatibility but are no longer recommended for new projects.

## Deprecation Notice

Support will permanently continue, but for new projects use `../../feeds/basic/scripts/managedUpdate.ts` instead, which provides:
- 90% lower costs through quote aggregation
- Better performance with reduced network calls
- Simplified implementation with fewer moving parts
- Active maintenance and ongoing improvements

## Scripts in This Directory

### runFeed.ts - Individual Feed Updates

**Status**: Legacy - Use `../../feeds/basic/scripts/managedUpdate.ts` instead

**Purpose**: Update specific pull feed accounts with detailed oracle response visibility.

**Usage**:
```bash
ts-node runFeed.ts --feed GgGVgSLWAyL9Xf4fGaAQQCkmWetBjX7PCNz8kTK97DKB
```
