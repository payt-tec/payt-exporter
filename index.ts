import { getNginxContainers, getStubStatusFromContainers } from "./nginx";
import { serveMetrics } from "./metrics";

async function main() {
  const imageName = "ghcr.io/payt-tec/laravel-fpm:"; // change as needed

  
//   console.log(`Found ${containers.length} containers using image ${imageName}`);

  const scrapeAndServe = async () => {
    const containers = await getNginxContainers(imageName);
    const data = await getStubStatusFromContainers(containers);
    return data;
  };

  serveMetrics(scrapeAndServe, 3000);
}

main();
