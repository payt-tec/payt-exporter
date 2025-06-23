import { getNginxContainers, getStubStatusFromContainers } from "./nginx";
import { serveMetrics } from "./metrics";
import { IMAGE_NAME, LABEL_NAME, MODE } from "./config";
import { getDockerMetrics } from "./docker";
import { getHostMetrics } from "./host";
import { beatToMaster } from "./heartbeat";
import { serveMaster } from "./master";

async function serveStatistics() {
  const scrapeAndServe = async () => {
    const [nginxData, dockerData, hostData] = await Promise.all([
      getStubStatusFromContainers(await getNginxContainers(IMAGE_NAME, LABEL_NAME)),
      getDockerMetrics(),
      getHostMetrics()
    ]);

    return [nginxData, dockerData, hostData].filter(Boolean).join("\n");
  };

  serveMetrics(scrapeAndServe);
}

if (MODE === "master") {
  serveMaster()
} else {
  serveStatistics();
  beatToMaster();
}
