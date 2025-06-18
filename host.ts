import os from 'os';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

export interface HostStatistics {
    hostname: string;
    platform: string;
    arch: string;
    uptime: number;
    loadAverage: number[];
    totalMemory: number;
    freeMemory: number;
    usedMemory: number;
    cpus: {
        model: string;
        speed: number;
        times: os.CpuInfo['times'];
    }[];
    networkInterfaces: Record<string, os.NetworkInterfaceInfo[] | undefined>;
    disks: DiskStats[];
}

export interface DiskStats {
    filesystem: string;
    size: number;
    used: number;
    available: number;
    mount: string;
}

// Helper to read from /host/proc
function readHostProcFile(file: string): string {
    return fs.readFileSync(path.join('/host/proc', file), 'utf-8');
}

// Get memory info from /host/proc/meminfo
function getHostMemory(): { total: number; free: number } {
    const meminfo = readHostProcFile('meminfo');
    let total = 0, free = 0;
    for (const line of meminfo.split('\n')) {
        if (line.startsWith('MemTotal:')) {
            total = parseInt(line.replace(/\D+/g, '')) * 1024;
        }
        if (line.startsWith('MemAvailable:')) {
            free = parseInt(line.replace(/\D+/g, '')) * 1024;
        }
    }
    return { total, free };
}

// Get uptime from /host/proc/uptime
function getHostUptime(): number {
    const uptimeStr = readHostProcFile('uptime').split(' ')[0];
    return parseFloat(uptimeStr);
}

// Get load average from /host/proc/loadavg
function getHostLoadAvg(): number[] {
    const loadavg = readHostProcFile('loadavg').split(' ').slice(0, 3).map(Number);
    return loadavg;
}

// Get CPU info from /host/proc/stat and /host/proc/cpuinfo
function getHostCpus(): { model: string; speed: number; times: os.CpuInfo['times'] }[] {
    const cpuinfo = readHostProcFile('cpuinfo');
    const stat = readHostProcFile('stat');
    const cpus: { model: string; speed: number; times: os.CpuInfo['times'] }[] = [];
    const models: string[] = [];
    const speeds: number[] = [];
    for (const line of cpuinfo.split('\n')) {
        if (line.startsWith('model name')) {
            models.push(line.split(':')[1].trim());
        }
        if (line.startsWith('cpu MHz')) {
            speeds.push(Math.round(parseFloat(line.split(':')[1].trim())));
        }
    }
    const statLines = stat.split('\n').filter(l => l.startsWith('cpu') && l !== 'cpu');
    statLines.forEach((line, idx) => {
        const parts = line.trim().split(/\s+/);
        // cpuN user nice system idle iowait irq softirq steal guest guest_nice
        const [_, user, nice, system, idle, iowait, irq, softirq, steal] = parts;
        cpus.push({
            model: models[idx] || '',
            speed: speeds[idx] || 0,
            times: {
                user: parseInt(user, 10),
                nice: parseInt(nice, 10),
                sys: parseInt(system, 10),
                idle: parseInt(idle, 10),
                irq: parseInt(irq, 10),
                steal: parseInt(steal || '0', 10),
                // guest and guest_nice are not used here
            } as any,
        });
    });
    return cpus;
}

// Get network interfaces from /host/sys/class/net
function getHostNetworkInterfaces(): Record<string, os.NetworkInterfaceInfo[] | undefined> {
    const netDir = '/host/sys/class/net';
    const interfaces: Record<string, os.NetworkInterfaceInfo[] | undefined> = {};
    if (!fs.existsSync(netDir)) return interfaces;
    for (const iface of fs.readdirSync(netDir)) {
        const addrPath = path.join(netDir, iface, 'address');
        if (fs.existsSync(addrPath)) {
            const mac = fs.readFileSync(addrPath, 'utf-8').trim();
            interfaces[iface] = [{ address: '', netmask: '', family: '', mac, internal: false }];
        }
    }
    return interfaces;
}

function getDiskStatistics(): DiskStats[] {
    try {
        // Use 'df' for default output (sizes in 1K blocks) on /hostroot
        const output = execSync('df /hostroot', { encoding: 'utf-8' });
        const lines = output.trim().split('\n');
        lines.shift();
        return lines.map(line => {
            const parts = line.trim().split(/\s+/);
            if (parts.length < 6) return null as any;
            const [filesystem, size, used, available, , ...mountArr] = parts;
            return {
                filesystem,
                size: parseInt(size, 10) * 1024,
                used: parseInt(used, 10) * 1024,
                available: parseInt(available, 10) * 1024,
                mount: mountArr.join(' '),
            };
        }).filter(Boolean);
    } catch (err) {
        return [];
    }
}

function getHostStatistics(): HostStatistics {
    const { total: totalMemory, free: freeMemory } = getHostMemory();
    return {
        hostname: fs.readFileSync('/host/etc/hostname', 'utf-8').trim(),
        platform: fs.existsSync('/host/etc/os-release')
            ? fs.readFileSync('/host/etc/os-release', 'utf-8').split('\n').find(l => l.startsWith('ID='))?.split('=')[1]?.replace(/"/g, '') || 'linux'
            : 'linux',
        arch: os.arch(), // Node can't get host arch, so fallback to container arch
        uptime: getHostUptime(),
        loadAverage: getHostLoadAvg(),
        totalMemory,
        freeMemory,
        usedMemory: totalMemory - freeMemory,
        cpus: getHostCpus(),
        networkInterfaces: getHostNetworkInterfaces(),
        disks: getDiskStatistics(),
    };
}

function formatHostStatisticsForPrometheus(stats: HostStatistics): string {
    const usedMemoryPercent = stats.totalMemory > 0
        ? (stats.usedMemory / stats.totalMemory) * 100
        : 0;

    const metrics: string[] = [
        // `host_uptime_seconds{hostname="${stats.hostname}"} ${stats.uptime}`,
        `host_memory_total_bytes{hostname="${stats.hostname}"} ${stats.totalMemory}`,
        `host_memory_free_bytes{hostname="${stats.hostname}"} ${stats.freeMemory}`,
        `host_memory_used_bytes{hostname="${stats.hostname}"} ${stats.usedMemory}`,
        `host_memory_used_percent{hostname="${stats.hostname}"} ${usedMemoryPercent}`,
        ...stats.loadAverage.map((value, idx) =>
            `host_load_average_${idx + 1}min{hostname="${stats.hostname}"} ${value}`
        ),
    ];

    for (const disk of stats.disks) {
        metrics.push(
            `host_disk_total_bytes{hostname="${stats.hostname}",filesystem="${disk.filesystem}",mount="${disk.mount}"} ${disk.size}`
        );
        // metrics.push(
        //     `host_disk_used_bytes{hostname="${stats.hostname}",filesystem="${disk.filesystem}",mount="${disk.mount}"} ${disk.used}`
        // );
        metrics.push(
            `host_disk_available_bytes{hostname="${stats.hostname}",filesystem="${disk.filesystem}",mount="${disk.mount}"} ${disk.available}`
        );
    }

    const cpuTimeTotals: Record<string, number> = {};
    let totalCpuTime = 0;

    for (const cpu of stats.cpus) {
        for (const [type, time] of Object.entries(cpu.times)) {
            cpuTimeTotals[type] = (cpuTimeTotals[type] || 0) + time;
            totalCpuTime += time;
        }
    }

    for (const [type, totalTime] of Object.entries(cpuTimeTotals)) {
        const percent = totalCpuTime > 0 ? (totalTime / totalCpuTime) * 100 : 0;
        metrics.push(
            `host_cpu_time_percentage{hostname="${stats.hostname}",mode="${type}"} ${percent}`
        );
        metrics.push(
            `host_cpu_time_seconds_total{hostname="${stats.hostname}",mode="${type}"} ${totalTime / 100}`
        );
    }

    return metrics.join('\n');
}

export async function getHostMetrics(): Promise<string> {
    const stats = getHostStatistics();
    return formatHostStatisticsForPrometheus(stats);
}
