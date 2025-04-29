import { getNginxContainers, getStubStatusFromContainers } from "./nginx";
import { serveMetrics } from "./metrics";
import { IMAGE_NAME, METRICS_PORT } from "./config";

async function main() {
  const scrapeAndServe = async () => {
    const containers = await getNginxContainers(IMAGE_NAME);
    const data = await getStubStatusFromContainers(containers);
    return data;
  };

  serveMetrics(scrapeAndServe, METRICS_PORT);
}

main();
