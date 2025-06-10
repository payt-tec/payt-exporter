import os from 'os';

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
