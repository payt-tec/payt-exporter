import os from 'os';
import { execSync } from 'child_process';

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

function getDiskStatistics(): DiskStats[] {
    try {
        // Use 'df -k' for portable, parseable output (sizes in KB)
        const output = execSync('df -k --output=source,size,used,avail,target /hostroot', { encoding: 'utf-8' });
        const lines = output.trim().split('\n');
        // Remove header
        lines.shift();
        return lines.map(line => {
            const [filesystem, size, used, available, ...mountArr] = line.trim().split(/\s+/);
            return {
                filesystem,
                size: parseInt(size, 10) * 1024,      // Convert KB to bytes
                used: parseInt(used, 10) * 1024,
                available: parseInt(available, 10) * 1024,
                mount: mountArr.join(' '),
            };
        });
    } catch (err) {
        return [];
    }
}

function getHostStatistics(): HostStatistics {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    return {
        hostname: os.hostname(),
        platform: os.platform(),
        arch: os.arch(),
        uptime: os.uptime(),
        loadAverage: os.loadavg(),
        totalMemory,
        freeMemory,
        usedMemory: totalMemory - freeMemory,
        cpus: os.cpus().map(cpu => ({
            model: cpu.model,
            speed: cpu.speed,
            times: cpu.times,
        })),
        networkInterfaces: os.networkInterfaces(),
        disks: getDiskStatistics(),
    };
}

function formatHostStatisticsForPrometheus(stats: HostStatistics): string {
    const usedMemoryPercent = stats.totalMemory > 0
        ? (stats.usedMemory / stats.totalMemory) * 100
        : 0;

    const metrics: string[] = [
        `host_uptime_seconds{hostname="${stats.hostname}"} ${stats.uptime}`,
        `host_memory_total_bytes{hostname="${stats.hostname}"} ${stats.totalMemory}`,
        `host_memory_free_bytes{hostname="${stats.hostname}"} ${stats.freeMemory}`,
        `host_memory_used_bytes{hostname="${stats.hostname}"} ${stats.usedMemory}`,
        `host_memory_used_percent{hostname="${stats.hostname}"} ${usedMemoryPercent}`,
        ...stats.loadAverage.map((value, idx) =>
            `host_load_average_${idx + 1}min{hostname="${stats.hostname}"} ${value}`
        ),
    ];

    // Disk metrics
    for (const disk of stats.disks) {
        metrics.push(
            `host_disk_total_bytes{hostname="${stats.hostname}",filesystem="${disk.filesystem}",mount="${disk.mount}"} ${disk.size}`
        );
        metrics.push(
            `host_disk_used_bytes{hostname="${stats.hostname}",filesystem="${disk.filesystem}",mount="${disk.mount}"} ${disk.used}`
        );
        metrics.push(
            `host_disk_available_bytes{hostname="${stats.hostname}",filesystem="${disk.filesystem}",mount="${disk.mount}"} ${disk.available}`
        );
    }

    // CPU time totals per mode
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
