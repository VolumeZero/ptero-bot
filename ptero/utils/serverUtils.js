const { pterodactyl } = require("../../config.json");
const { PteroClient } = require("../requests/clientApiReq");
const { PteroApp } = require("../requests/appApiReq");

// Helper functions
function serverPowerEmoji(status) {
    switch (status) {
        case "running": return "🟢 Running";
        case "offline": return "🔴 Offline";
        case "starting": return "🟡 Starting";
        case "stopping": return "🟠 Stopping";
        default: return "⚪ Unknown";
    }
}

function uptimeToString(uptimeMs) {
    const totalSeconds = Math.floor(uptimeMs / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}

function formatBytes(bytes) {
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
}

function formatMegabytes(megabytes) { 
    const sizes = ['MB', 'GB', 'TB'];
    if (megabytes === 0) return '∞';
    const i = Math.floor(Math.log(megabytes) / Math.log(1024));
    //if in tb range show two decimal places otherwise show no decimal places
    if (i >= 2) {
        return `${(megabytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
    } else {
        return `${Math.round(megabytes / Math.pow(1024, i))} ${sizes[i]}`;
    }
}

function stripAnsi(str) {
    return str
        // ANSI escape sequences (CSI)
        .replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, '')
        // ANSI OSC sequences
        .replace(/\x1b\].*?(?:\x07|\x1b\\)/g, '')
        // Remove backspaces and the characters they delete
        .replace(/.\x08/g, '')
        // Remove stray escape characters
        .replace(/\x1b/g, '')
        // Cleanup leftover control chars (excluding \n which is \x0A)
        .replace(/[\x00-\x09\x0B-\x1F\x7F]/g, '');
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

function embedColorFromWingsStatus(status) {
    switch (status) {
        case "online": return 0x00FF00; // Green
        case "offline": return 0xFF0000; // Red
        case "starting": return 0xFFFF00; // Yellow
        case "stopping": return 0xFFA500; // Orange
        case "installing": return 0x0000FF; // Blue
        default: return 0x808080; // Grey
    }
}

function embedConsoleStr(logBuffer, lineCount, maxLength) {
    // Normalize to array of lines
    const lines = Array.isArray(logBuffer)
        ? logBuffer
        : logBuffer?.toString().trim().split("\n");

    if (!lines || lines.length === 0) return "N/A...";

    // Last X lines
    let output = lines.slice(-lineCount).join("\n");
    // Trim if too long
    if (output.length > maxLength) {
        output = output.slice(output.length - maxLength);
    }

    return output;
}

async function isClientKeyValid(apiKey) {
    try {
        if (!apiKey || apiKey.trim() === '') {
            return false;
        } else if (apiKey === pterodactyl.apiKey) {
            return false;
        } else if (apiKey.startsWith('ptla_')) {
            return false;
        }
        await PteroClient.request('account', apiKey);
        return true;
    } catch (error) {
        return false;
    }
}

async function isApplicationKeyValid() {
    const apiKey = pterodactyl.apiKey;
    try {
        if (!apiKey || apiKey.trim() === '') {
            return false;
        } else if (apiKey.startsWith('ptlc_')) { //client key prefix
            console.warn(`Found a client API key (ptlc_) in the application API key field. Please ensure you are using an application API key (ptla_).`);
            return false;
        }
        await PteroApp.request('nodes');
        return true;
    } catch (error) {
        return false;
    }
}

module.exports = {
    serverPowerEmoji,
    uptimeToString,
    formatBytes,
    formatMegabytes,
    stripAnsi,
    embedColorFromStatus,
    embedColorFromWingsStatus,
    embedConsoleStr,
    isClientKeyValid,
    isApplicationKeyValid
};