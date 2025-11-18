
const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const { pterodactyl } = require("../config.json");

const DATA_FILE = path.resolve("./apikeys.json");
const ENCRYPTION_KEY = pterodactyl.API_ENCRYPTION_KEY || "12345678901234567890123456789012"; // 32 bytes
const IV_LENGTH = 16;


function encrypt(text) {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv("aes-256-cbc", Buffer.from(ENCRYPTION_KEY), iv);
    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");
    return iv.toString("hex") + ":" + encrypted;
}

function decrypt(text) {
    const [ivHex, encryptedData] = text.split(":");
    const iv = Buffer.from(ivHex, "hex");
    const decipher = crypto.createDecipheriv("aes-256-cbc", Buffer.from(ENCRYPTION_KEY), iv);
    let decrypted = decipher.update(encryptedData, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
}

async function saveApiKey(userId, apiKey) {
    let data = {};
    try {
        const fileContent = await fs.readFile(DATA_FILE, "utf8");
        data = JSON.parse(fileContent);
    } catch (err) {
        if (err.code !== "ENOENT") throw err;
    }
    data[userId] = encrypt(apiKey);
    await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), "utf8");
    console.log(`Saved API key for user ${userId}`);
}

async function loadApiKey(userId) {
    try {
        const fileContent = await fs.readFile(DATA_FILE, "utf8");
        const data = JSON.parse(fileContent);
        if (!data[userId]) return null;
        return decrypt(data[userId]);
    } catch (err) {
        return null; // file doesn't exist or key not found
    }
}

module.exports = { saveApiKey, loadApiKey };