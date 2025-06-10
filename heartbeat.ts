import { MASTER_NODE, TOKEN, BEAT_INTERVAL, PORT } from "./config";

async function heartbeat() {
  try {
    console.log("Sending heartbeat to master node:", MASTER_NODE);
    const response = await fetch(`${MASTER_NODE}/heartbeat`, {
        method: "POST",
        body: JSON.stringify({ port: PORT }),
        headers: {
            "Authorization": `Bearer ${TOKEN}`,
        }
    });

    if (!response.ok) {
      console.error("Heartbeat check failed:", response.statusText);
    }
  } catch (error) {
    console.error("Heartbeat check error:", error, MASTER_NODE);
  }
}

export async function beatToMaster() {
  if (!MASTER_NODE || !TOKEN) {
    throw new Error("MASTER_NODE and TOKEN must be set in config");
  }

  while (true) {
    await heartbeat();
    await new Promise(resolve => setTimeout(resolve, BEAT_INTERVAL));
  }
}