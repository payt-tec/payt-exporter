import { PORT, TOKEN, nodeList, addNode, LOCAL_PORT } from "./config"

export async function serveMaster() {
    const server = Bun.serve({
        port: PORT,
        routes: {
            "/heartbeat": async (req, server) => {
                const authHeader = req.headers.get("Authorization");
                const bearerToken = authHeader?.split(" ")[1];

                if (!bearerToken || bearerToken !== TOKEN) {
                    return new Response("Unauthorized", { status: 401 });
                }

                const port = (await req.json())?.port;
                const address = server.requestIP(req)?.address.includes(":") ? `[${server.requestIP(req)?.address}]` : server.requestIP(req)?.address;

                addNode(`${address}:${port}`);
                return new Response("OK", { status: 200 });
            }
            ,
        }
    });

    const localServer = Bun.serve({
        port: LOCAL_PORT,
        routes: {
            "/metrics": async (req) => {
                const metrics = await Promise.all(
                    nodeList.map(async (node) => {
                        try {
                            const res = await fetch(`http://${node}/metrics`, {
                                headers: {
                                    "Authorization": `Bearer ${TOKEN}`
                                }
                            });

                            if (res.ok) {
                                return await res.text();
                            }
                        } catch (e) {
                            console.error(`Node down ${node}`);
                        }
                        return "";
                    })
                );

                return new Response(metrics.join("\n"), { status: 200 });
            }
        }
    })
}
