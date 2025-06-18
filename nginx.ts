import { listContainersByImage, getContainerIPAddress } from "./docker";
import { STUB_STATUS_URL, STUB_STATUS_PORT, HOSTNAME } from "./config";


export async function getNginxContainers(image: string) {
  return await listContainersByImage(image);
}

export async function getStubStatusFromContainers(containers: { id: string, name: string }[]) {
  const metrics: string[] = [];

  await Promise.all(containers.map(async (container) => {
    const ip = await getContainerIPAddress(container.id);
    const url = `http://${ip}:${STUB_STATUS_PORT}${STUB_STATUS_URL}`;

    try {
      const res = await fetch(url, { timeout: 2000 });
      const text = await res.text();

      const parsed = parseStubStatus(text);
      metrics.push(formatMetrics(container.name, parsed));
    } catch (err) {
      console.error(`Failed to fetch stub_status from ${container.name} at ${url}`);
    }
  }));

  return metrics.join("\n");
}

function parseStubStatus(text: string) {
  const lines = text.split("\n");
  const active = parseInt(lines[0].match(/\d+/)?.[0] || "0");
  const [accepted, handled, requests] = lines[2].trim().split(" ").map(Number);
  const [reading, writing, waiting] = lines[3].match(/\d+/g)?.map(Number) || [0, 0, 0];

  return { active, accepted, handled, requests, reading, writing, waiting };
}

function formatMetrics(name: string, metrics: any) {
const labels = `{container="${name}",hostname="${HOSTNAME}"}`;
  return [
    `nginx_active_connections${labels} ${metrics.active}`,
    // `nginx_accepted_connections${labels} ${metrics.accepted}`,
    // `nginx_handled_connections${labels} ${metrics.handled}`,
    // `nginx_requests${labels} ${metrics.requests}`,
    `nginx_reading${labels} ${metrics.reading}`,
    `nginx_writing${labels} ${metrics.writing}`,
    `nginx_waiting${labels} ${metrics.waiting}`
  ].join('\n');
}
