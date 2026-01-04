const mcs = require("node-mcstatus");
const axios = require("axios");

async function checkJava(ip, port, timeout) {
    try {
        const status = await mcs.statusJava(ip, port, { timeout });
        if (!status?.players) return null;

        return {
            type: "minecraft-java",
            players: status.players.online,
            maxPlayers: status.players.max,
            version: status.version.name_clean
        };
    } catch {
        return null;
    }
}

async function checkBedrock(ip, port, timeout) {
    try {
        const status = await mcs.statusBedrock(ip, port, { timeout });
        if (!status?.players) return null;

        return {
            type: "minecraft-bedrock",
            players: status.players.online,
            maxPlayers: status.players.max,
            version: status.version.name_clean
        };
    } catch {
        return null;
    }
}

async function checkFiveM(ip, port, timeout) {
    try {

        const response = await axios.get(`http://${ip}:${port}/info.json`, { timeout });

        const data = response.data;
        if (!data?.vars?.Players) return null;

        return {
            type: "fivem",
            players: data.vars.Players,
            maxPlayers: data.vars.sv_maxClients,
            version: data.server?.match(/v[\d.]+/)?.[0],
            joinLink: `http://${ip}:${port}`
        };
    } catch {
        return null;
    }
}


let failedChecks = new Map();
module.exports = {
    async getServerExtras(ip, port, gameType = null) {
        const timeout = 3000;

        let checks = [];
        if (gameType === "none") {
            return { type: "none" };
        } else if (gameType === "minecraft-java") {
            checks.push(checkJava(ip, port, timeout));
        } else if (gameType === "minecraft-bedrock") {
            checks.push(checkBedrock(ip, port, timeout));
        } else if (gameType === "fivem") {
            checks.push(checkFiveM(ip, port, timeout));
        } else {
            checks.push(checkJava(ip, port, timeout));
            checks.push(checkBedrock(ip, port, timeout));
            checks.push(checkFiveM(ip, port, timeout));
        }
        return await new Promise(resolve => {
            let settledCount = 0;
            checks.forEach(p => {
                p.then(result => {
                    if (result) resolve(result);
                }).finally(() => {
                    settledCount++;
                    if (settledCount === checks.length) {
                        //cache failed check 
                        const failedCount = failedChecks.get(`${ip}:${port}`) || 0;
                        if (failedCount >= 5) {
                            failedChecks.delete(`${ip}:${port}`);
                            //set game type to 'none' to avoid future checks
                            resolve({ type: "none" });
                        } else {
                            failedChecks.set(`${ip}:${port}`, failedCount + 1);
                        }
                        resolve({}); //all checks done, none succeeded
                    }
                });
            });
        });
    }
};
