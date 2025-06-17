const DOCKER_SOCKET = "/var/run/docker.sock";
import { HOSTNAME } from "./config";

async function dockerRequest(path: string): Promise<any> {
  const res = await fetch(`http://localhost${path}`, { unix: DOCKER_SOCKET });

  if (!res.ok) {
    throw new Error(`Docker API error: ${res.status}`);
  }

  return res.json();
}

export async function listContainersByImage(image: string|null) {
  const containers = await dockerRequest("/containers/json?all=false");

  if (!image) {
    return containers.map((c: any) => ({
      id: c.Id,
      name: c.Names[0].replace(/^\//, ""),
    }));
  }

  return containers
    .filter((c: any) => c.Image.includes(image))
    .map((c: any) => ({
      id: c.Id,
      name: c.Names[0].replace(/^\//, ""),
    }));
}

export async function getContainerIPAddress(containerId: string): Promise<string> {
  const info = await dockerRequest(`/containers/${containerId}/json`);
  const networks = info.NetworkSettings.Networks;
  const firstNet = Object.values(networks)[0] as any;
  return firstNet?.IPAddress || "";
}

async function getContainerStats(containerId: string): Promise<any> {
  return await dockerRequest(`/containers/${containerId}/stats?stream=false`);
}

function formatMetrics(name: string, stats: any): string {
  const labels = `{container="${name}",hostname="${HOSTNAME}"}`;
  const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
  const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
  const cpuPercent = systemDelta > 0 && cpuDelta > 0
    ? (cpuDelta / systemDelta) * stats.cpu_stats.online_cpus * 100.0
    : 0;

  return [
    // `docker_cpu_usage${labels} ${stats.cpu_stats.cpu_usage.total_usage}`,
    `docker_cpu_percentage${labels} ${cpuPercent}`,
    // `docker_memory_usage${labels} ${stats.memory_stats.usage}`,
    // `docker_memory_limit${labels} ${stats.memory_stats.limit}`,
    `docker_memory_percentage${labels} ${stats.memory_stats.usage / stats.memory_stats.limit * 100.0}`,
    `docker_network_rx_bytes${labels} ${stats.networks?.eth0?.rx_bytes || 0}`,
    `docker_network_tx_bytes${labels} ${stats.networks?.eth0?.tx_bytes || 0}`,
    `docker_network_rx_packets${labels} ${stats.networks?.eth0?.rx_packets || 0}`,
    `docker_network_tx_packets${labels} ${stats.networks?.eth0?.tx_packets || 0}`,
    `docker_network_rx_errors${labels} ${stats.networks?.eth0?.rx_errors || 0}`,
    `docker_network_tx_errors${labels} ${stats.networks?.eth0?.tx_errors || 0}`
  ].join('\n');
}

async function listSwarmNodes(): Promise<any[]> {
  try {
    return await dockerRequest("/nodes");
  } catch (err) {
    console.error("Failed to fetch swarm nodes:", err);
    return [];
  }
}

async function listSwarmServices(): Promise<any[]> {
  try {
    return await dockerRequest("/services");
  } catch (err) {
    console.error("Failed to fetch swarm services:", err);
    return [];
  }
}

function formatSwarmNodeMetrics(nodes: any[]): string {
  return nodes.map((node) => {
    const labels = `{node_id="${node.ID}",hostname="${node.Description?.Hostname || ""}"}`;
    return [
      `docker_swarm_node_status${labels} ${node.Status?.State === "ready" ? 1 : 0}`,
      `docker_swarm_node_availability${labels} ${node.Spec?.Availability === "active" ? 1 : 0}`,
      `docker_swarm_node_manager${labels} ${node.ManagerStatus ? 1 : 0}`
    ].join('\n');
  }).join('\n');
}

function formatSwarmServiceMetrics(services: any[]): string {
  return services.map((service) => {
    const labels = `{service_id="${service.ID}",service_name="${service.Spec?.Name || ""}"}`;
    return [
      `docker_swarm_service_replicas${labels} ${service.ServiceStatus?.RunningTasks || 0}`,
      `docker_swarm_service_desired_replicas${labels} ${service.Spec?.Mode?.Replicated?.Replicas || 0}`
    ].join('\n');
  }).join('\n');
}

export async function getDockerMetrics(): Promise<string> {
  const containers = await listContainersByImage(null);

  const statsList = await Promise.all(
    containers.map(async (container) => {
      try {
        const stats = await getContainerStats(container.id);
        return formatMetrics(container.name, stats);
      } catch (err) {
        console.error(`Failed to fetch stats for container ${container.name}:`, err);
        return null;
      }
    })
  );

  // Swarm metrics
  const [nodes, services] = await Promise.all([
    listSwarmNodes(),
    listSwarmServices()
  ]);

  const swarmNodeMetrics = formatSwarmNodeMetrics(nodes);
  const swarmServiceMetrics = formatSwarmServiceMetrics(services);

  return [
    statsList,
    swarmNodeMetrics,
    swarmServiceMetrics
  ].filter(Boolean).join("\n");
}