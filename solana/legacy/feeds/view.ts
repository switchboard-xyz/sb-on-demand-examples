// ANSI escape codes
const HIDE_CURSOR = "\x1b[?25l";
const SHOW_CURSOR = "\x1b[?25h";
const ENTER_ALT_SCREEN = "\x1b[?1049h";
const EXIT_ALT_SCREEN = "\x1b[?1049l";
const MOVE_HOME = "\x1b[H";
const CLEAR_LINE = "\x1b[2K";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const RED = "\x1b[31m";
const DIM = "\x1b[2m";
const MAGENTA = "\x1b[35m";

export interface DisplayState {
  feedKey: string;
  feedValue: string | null;
  slot: number | null;
  error: string | null;
  logs: string[];
  stats: {
    min: number;
    max: number;
    median: number;
    mean: number;
    count: number;
  } | null;
  lastUpdate: Date;
  status: "fetching" | "simulating" | "success" | "error";
}

export function render(state: DisplayState): void {
  const { feedKey, feedValue, slot, error, logs, stats, lastUpdate, status } = state;

  const lines: string[] = [];

  // Header
  lines.push(`${BOLD}${CYAN}══════════════════════════════════════════════════════════════${RESET}`);
  lines.push(`${BOLD}${CYAN}          SWITCHBOARD FEED MONITOR${RESET}`);
  lines.push(`${BOLD}${CYAN}══════════════════════════════════════════════════════════════${RESET}`);
  lines.push("");


  // Feed Info
  lines.push(`${DIM}Feed:${RESET}   ${feedKey}`);
  lines.push(`${DIM}Time:${RESET}   ${lastUpdate.toLocaleTimeString()}`);
  const statusColor = status === "success" ? GREEN : status === "error" ? RED : YELLOW;
  lines.push(`${DIM}Status:${RESET} ${statusColor}${status.toUpperCase()}${RESET}`);
  lines.push("");

  // Main Value or Error
  if (error) {
    lines.push(`${RED}${BOLD}ERROR:${RESET} ${error}`);
    lines.push("");
  } else if (feedValue) {
    lines.push(`${BOLD}Value:${RESET}  ${GREEN}${BOLD}${feedValue}${RESET}`);
    if (slot) {
      lines.push(`${DIM}Slot:${RESET}   ${slot}`);
    } else {
      lines.push("");
    }
  } else {
    lines.push(`${DIM}Value:  Loading...${RESET}`);
    lines.push("");
  }
  lines.push("");

  // Stats
  lines.push(`${CYAN}${BOLD}─── Latency Stats ───${RESET}`);
  if (stats) {
    lines.push(`${DIM}Min:${RESET}    ${stats.min} ms`);
    lines.push(`${DIM}Max:${RESET}    ${stats.max} ms`);
    lines.push(`${DIM}Median:${RESET} ${stats.median} ms`);
    lines.push(`${DIM}Mean:${RESET}   ${stats.mean.toFixed(2)} ms`);
    lines.push(`${DIM}Count:${RESET}  ${stats.count}`);
  } else {
    lines.push(`${DIM}Waiting for data...${RESET}`);
    lines.push("");
    lines.push("");
    lines.push("");
    lines.push("");
  }
  lines.push("");

  // Transaction Logs
  lines.push(`${CYAN}${BOLD}─── Transaction Logs ───${RESET}`);
  const maxLogs = 5;
  const displayLogs = logs.slice(-maxLogs);
  for (let i = 0; i < maxLogs; i++) {
    if (displayLogs[i]) {
      // Truncate long logs
      const log = displayLogs[i].length > 70 ? displayLogs[i].substring(0, 67) + "..." : displayLogs[i];
      lines.push(`${DIM}${log}${RESET}`);
    } else {
      lines.push("");
    }
  }

  lines.push("");
  lines.push(`${DIM}Press Ctrl+C to exit${RESET}`);

  // Move to home and render
  process.stdout.write(MOVE_HOME + lines.map(l => CLEAR_LINE + l).join("\n"));
}

export function initScreen(): void {
  process.stdout.write(ENTER_ALT_SCREEN + HIDE_CURSOR);
}

export function cleanup(): void {
  process.stdout.write(SHOW_CURSOR + EXIT_ALT_SCREEN);
}

export function setupCleanupHandlers(): void {
  process.on("SIGINT", () => {
    cleanup();
    process.exit(0);
  });

  process.on("exit", cleanup);
}
