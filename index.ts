import { getNginxContainers, getStubStatusFromContainers } from "./nginx";
import { serveMetrics } from "./metrics";
import { IMAGE_NAME, METRICS_PORT } from "./config";
import { getDockerMetrics } from "./docker";
import { getHostMetrics } from "./host";

async function main() {
  const scrapeAndServe = async () => {
    const containers = await getNginxContainers(IMAGE_NAME);
    const nginxData = await getStubStatusFromContainers(containers);
    const dockerData = await getDockerMetrics();
    const hostData = await getHostMetrics();

    return [nginxData, dockerData, hostData].filter(Boolean).join("\n");
  };

  serveMetrics(scrapeAndServe);
}

main();
