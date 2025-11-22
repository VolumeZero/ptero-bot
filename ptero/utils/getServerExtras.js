//this is for getting server extras like player counts for minecraft servers or fivem servers for example
const mcs = require('node-mcstatus');
const axios = require('axios');

module.exports = {
    async getServerExtras(ip, port) {
        let extras = {};
        //try getting minecraft server status
        let minecraftPlayers = null;
        let maxPlayers = null;
        let minecraftVersion = null;
        try {
            const mcStatus = await mcs.statusJava(ip, port, { timeout: 5000 });
            if (mcStatus && mcStatus.players) {
                minecraftPlayers = mcStatus.players.online;
                maxPlayers = mcStatus.players.max;
                minecraftVersion = mcStatus.version.name_clean;
            } else {
                //try bedrock
                const mcStatusBedrock = await mcs.statusBedrock(ip, port, { timeout: 5000 });
                if (mcStatusBedrock && mcStatusBedrock.players) {
                    minecraftPlayers = mcStatusBedrock.players.online;
                    maxPlayers = mcStatusBedrock.players.max;
                    minecraftVersion = mcStatusBedrock.version.name_clean;
                }
            }
            if (minecraftPlayers !== null && maxPlayers !== null) {
                extras = {
                    players: minecraftPlayers,
                    maxPlayers: maxPlayers,
                    version: minecraftVersion
                };
            return extras; //end here if we found minecraft info since there would be no point in checking further
            }
        } catch (error) {
            //ignore errors
        }

        //try getting fivem server info
        //ip:port/info.json
        try {
            const response = await axios.get(`http://${ip}:${port}/info.json`, { timeout: 5000 });
            if (response.data && response.data.vars.Players) {
                extras = {
                    players: response.data.vars.Players, //query players.json for more player info if needed
                    maxPlayers: response.data.vars.sv_maxClients,
                    version: response.data.server.match(/v[\d.]+/)[0]
                };
                return extras; //end here if we found fivem info since there would be no point in checking further
            }
        } catch (error) {
            //ignore errors
        }

        return extras;
    }
};