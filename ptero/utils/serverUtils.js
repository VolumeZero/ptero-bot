const { default: axios } = require("axios");
const Nodeactyl = require("nodeactyl");
const { pterodactyl } = require("../../config.json");

// Helper functions
function serverPowerEmoji(status) {
    switch (status) {
        case "running": return "🟢 Online";
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
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 Byte';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
}

function formatMegabytes(megabytes) { 
    const sizes = ['MB', 'GB', 'TB'];
    if (megabytes === 0) return '∞';
    const i = Math.floor(Math.log(megabytes) / Math.log(1024));
    return `${(megabytes / Math.pow(1024, i)).toFixed(0)} ${sizes[i]}`;
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
        // Cleanup leftover control chars
        .replace(/[\x00-\x1F\x7F]/g, '');
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

function embedColorFromWingsStatus(isOnline) {
    return isOnline ? 0x00FF00 : 0xFF0000; // Green if online, Red if offline
}

function embedConsoleStr(logBuffer, lineCount = 3, maxLength = 1024) {
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


function isApplicationKeyValid(key) {
    try {
        const application = new Nodeactyl.NodeactylApplication(pterodactyl.domain, key);
        if (application) {
            return true;
        } 
    } catch (error) {
        return false;
    }
    return false;
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
    isApplicationKeyValid,
};