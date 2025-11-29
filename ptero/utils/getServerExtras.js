//this is for getting server extras like player counts for minecraft servers or fivem servers for example
const mcs = require('node-mcstatus');
const axios = require('axios');

module.exports = {
    async getServerExtras(ip, port) {
        const timeout = 3000;

        const mcJavaCheck = mcs.statusJava(ip, port, { timeout })
            .then(status => status?.players ? {
                players: status.players.online,
                maxPlayers: status.players.max,
                version: status.version.name_clean
            } : null)
            .catch(() => null);

        const mcBedrockCheck = mcs.statusBedrock(ip, port, { timeout })
            .then(status => status?.players ? {
                players: status.players.online,
                maxPlayers: status.players.max,
                version: status.version.name_clean
            } : null)
            .catch(() => null);

        const fivemCheck = axios.get(`http://${ip}:${port}/info.json`, { timeout })
            .then(response => {
                if (response.data?.vars?.Players) {
                    return {
                        players: response.data.vars.Players,
                        maxPlayers: response.data.vars.sv_maxClients,
                        version: response.data.server.match(/v[\d.]+/)?.[0],
                        joinLink: `http://${ip}:${port}` //a fivem server will redirect to its cfx.re/join link when accessed via browser
                    };
                }
                return null;
            })
            .catch(() => null);

        // Run all checks in parallel
        const results = await Promise.all([mcJavaCheck, mcBedrockCheck, fivemCheck]);

        // Return the first non-null result
        return results.find(r => r) || {};
    }
};