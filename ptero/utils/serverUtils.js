const { default: axios } = require("axios");

// Helper functions
function serverPowerEmoji(status) {
    switch (status) {
        case "running": return "🟢";
        case "offline": return "🔴";
        case "starting": return "🟡";
        case "stopping": return "🟠";
        default: return "⚪";
    }
}

function uptimeToString(uptimeMs) {
    const totalSeconds = Math.floor(uptimeMs / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}

function formatBytes(bytes) {
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 Byte';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
}

function formatMegabytes(megabytes) { 
    const sizes = ['MB', 'GB', 'TB'];
    if (megabytes === 0) return '0 MB';
    const i = Math.floor(Math.log(megabytes) / Math.log(1024));
    return `${(megabytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
}

function stripAnsi(str) {
    return str
        .replace(/\u001b\[[0-9;]*m/g, '')
        .replace(/\u001b\].*?(\u0007|\u001b\\)/g, '')
        .replace(/\u001b\[[0-9;]*K/g, '');
}


function embedColorFromStatus(status) {
    switch (status) {
        case "running": return 0x00FF00; // Green
        case "offline": return 0xFF0000; // Red
        case "starting": return 0xFFFF00; // Yellow
        case "stopping": return 0xFFA500; // Orange
        default: return 0x808080; // Grey
    }
}

async function checkWings(nodeDetails, token) {
    try {
        const res = await axios.get(`https://${nodeDetails.fqdn}:${nodeDetails.daemon_listen}/api/system`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': '*/*',
            },
            timeout: 5000,
        });
        if (res.status === 200) {
            return res.data;
        } else {
            return false;
        }
    } catch (error) {
        console.log(`Node ${nodeDetails.name} is offline or unreachable. Error: ${error.message}`);
        return false;
    }
}

function embedColorFromWingsStatus(isOnline) {
    return isOnline ? 0x00FF00 : 0xFF0000; // Green if online, Red if offline
}


module.exports = {
    serverPowerEmoji,
    uptimeToString,
    formatBytes,
    formatMegabytes,
    stripAnsi,
    embedColorFromStatus,
    embedColorFromWingsStatus,
    checkWings,
};