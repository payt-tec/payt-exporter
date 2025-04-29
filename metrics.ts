export function serveMetrics(scraper: () => Promise<string>, port: number) {
    const server = Bun.serve({
      port,
      async fetch(req) {
        const url = new URL(req.url);
  
        if (url.pathname === "/metrics") {
          const metrics = await scraper();
          return new Response(metrics, {
            headers: { "Content-Type": "text/plain" },
          });
        }
  
        return new Response("Not found", { status: 404 });
      },
    });
  
    console.log(`🚀 Prometheus metrics available at http://localhost:${port}/metrics`);
  }
  