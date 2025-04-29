const DOCKER_SOCKET = "/var/run/docker.sock";

async function dockerRequest(path: string): Promise<any> {
  const res = await fetch(`http://localhost${path}`, { unix: DOCKER_SOCKET });

  if (!res.ok) {
    throw new Error(`Docker API error: ${res.status}`);
  }

  return res.json();
}

export async function listContainersByImage(image: string) {
  const containers = await dockerRequest("/containers/json?all=false");

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
