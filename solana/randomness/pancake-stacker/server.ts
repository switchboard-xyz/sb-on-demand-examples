import { serve, file } from "bun";
import { join } from "path";

const PORT = process.env.PORT || 3000;

serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    let path = url.pathname;

    // Default to index.html
    if (path === "/") {
      path = "/index.html";
    }

    const filePath = join(import.meta.dir, "ui", path);
    const f = file(filePath);

    if (await f.exists()) {
      return new Response(f);
    }

    return new Response("Not Found", { status: 404 });
  },
});

console.log(`Pancake Stacker UI (Solana) running at http://localhost:${PORT}`);
