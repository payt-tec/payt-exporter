import { METRICS_PORT, TOKEN } from "./config";

export function serveMetrics(scraper: () => Promise<string>) {
    const server = Bun.serve({
        port: METRICS_PORT,
        async fetch(req) {
            const url = new URL(req.url);

            if (url.pathname === "/metrics") {
                const authHeader = req.headers.get("Authorization");
                const bearerToken = authHeader?.split(" ")[1];

                if (!bearerToken || bearerToken !== TOKEN) {
                    return new Response("Unauthorized", { status: 401 });
                }

                const metrics = await scraper();
                
                return new Response(metrics, {
                    headers: { "Content-Type": "text/plain" },
                });
            }

            return new Response("Oops", { status: 404 });
        },
    });

    console.log(`🚀 Prometheus metrics available at http://localhost:${METRICS_PORT}/metrics`);
}
