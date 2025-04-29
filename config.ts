import fs from 'fs';


let config = {
    IMAGE_NAME: 'ghcr.io/payt-tec/laravel-fpm:',
    METRICS_PORT: 3000,
    STUB_STATUS_URL: '/metrics',
    STUB_STATUS_PORT: 8888,
};

try {
    const configFile = fs.readFileSync('config.json', 'utf-8');
    const parsedConfig = JSON.parse(configFile);
    config = { ...config, ...parsedConfig };
} catch (error) {
    console.warn('Could not read config.json, using defaults:', error.message);
}

const { IMAGE_NAME, METRICS_PORT, STUB_STATUS_URL, STUB_STATUS_PORT } = config;

export { IMAGE_NAME, METRICS_PORT, STUB_STATUS_URL, STUB_STATUS_PORT };