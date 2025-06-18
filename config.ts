import fs from 'fs';

let config = {
    IMAGE_NAME: 'ghcr.io/payt-tec/laravel-fpm:',
    PORT: Bun.env.PORT || 3030,
    LOCAL_PORT: Bun.env.LOCAL_PORT || 3035,
    STUB_STATUS_URL: '/metrics',
    STUB_STATUS_PORT: 8888,
    TOKEN: Bun.env.TOKEN || 'CHANGEME',
    MASTER_NODE: Bun.env.MASTER_NODE || 'http://localhost:3000',
    BEAT_INTERVAL: 30000,
    MODE: Bun.env.MODE || 'slave', // 'master' or 'slave'
    HOSTNAME: Bun.env.HOSTNAME || require("os").hostname()
};

let nodeList: string[] = [];
updateNodeList()

try {
    const configFile = fs.readFileSync('config.json', 'utf-8');
    const parsedConfig = JSON.parse(configFile);
    config = { ...config, ...parsedConfig };

} catch (error) {
    console.warn('Could not read config.json, using defaults:', error.message);
}

const { IMAGE_NAME, PORT, STUB_STATUS_URL, STUB_STATUS_PORT, TOKEN, MASTER_NODE, BEAT_INTERVAL, MODE, LOCAL_PORT, HOSTNAME } = config;

export async function updateNodeList() {
    try {
        const nodeListFile = fs.readFileSync('nodes.json', 'utf-8');
        const parsedNodeList = JSON.parse(nodeListFile);
        
        if (Array.isArray(parsedNodeList)) {
            nodeList = parsedNodeList;
        } else {
            console.warn('nodes.json does not contain a valid array');
        }
    } catch (error) {
        console.warn('Could not read nodes.json:', error.message);
    }
}

export async function addNode(node : string) {
    if (!nodeList.includes(node)) {
        nodeList.push(node);
        fs.writeFileSync('nodes.json', JSON.stringify(nodeList, null, 2));
        console.log(`Node ${node} added to nodeList`);
    }
}

export async function removeNode(node : string) {
    const index = nodeList.indexOf(node);

    if (index !== -1) {
        nodeList.splice(index, 1);
        fs.writeFileSync('nodes.json', JSON.stringify(nodeList, null, 2));
        console.log(`Node ${node} removed from nodeList`);
    }
}

export { IMAGE_NAME, PORT, STUB_STATUS_URL, STUB_STATUS_PORT, TOKEN, HOSTNAME, MASTER_NODE, BEAT_INTERVAL, MODE, nodeList, LOCAL_PORT };