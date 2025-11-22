const Nodeactyl = require("nodeactyl");
const { EmbedBuilder } = require("discord.js");
const { pterodactyl } = require("../../config.json");
const { formatBytes, formatMegabytes, uptimeToString, serverPowerEmoji, embedColorFromStatus, checkWings, embedColorFromWingsStatus, embedConsoleStr, stripAnsi } = require("./serverUtils");
const { getServerExtras } = require("./getServerExtras");
const { getAppErrorMessage } = require("./appErrors");
const { wingsApiReq } = require("../requests/wingsApiReq");

module.exports = {
    async createNodeStatusEmbed(nodeId) {
        //defer 
        const appApiKey = pterodactyl.apiKey;
        const pteroApp = new Nodeactyl.NodeactylApplication(pterodactyl.domain, appApiKey);

        const nodeDetails = await pteroApp.getNodeDetails(nodeId).catch((error) => {
            console.error(`Error fetching node details for node ID ${nodeId}:`, getAppErrorMessage(error));
            throw new Error(`Failed to fetch node details: ${error}`);
        });

        
        const nodeConfig = await pteroApp.getNodeConfig(nodeId);
        const locationDetails = await pteroApp.getLocationDetails(nodeDetails.location_id);
        const nodeAllocations = await pteroApp.getNodeAllocations(nodeId);
        const allocationCount = nodeAllocations.data.length;
        
        //filter servers to only those on this node using wings api
        const servers = await wingsApiReq(nodeDetails, nodeConfig.token, 'servers').catch((error) => {
            console.error(`Error fetching servers for node ID ${nodeId}:`, getAppErrorMessage(error));
            throw new Error(`Failed to fetch servers for node: ${error}`);
        });

        const nodeUsages = { 
            cpu: 0, 
            memory: 0, 
            disk: 0, 
            network_tx: 0, 
            network_rx: 0,
            allocations: 0,
            onlineServers: 0
        };
        let err = false;
        for (const server of servers) {
            const usage = server.utilization;
            if (usage) {
                nodeUsages.cpu += usage.cpu_absolute || 0;
                nodeUsages.memory += usage.memory_bytes || 0;
                nodeUsages.disk += usage.disk_bytes || 0;
                nodeUsages.network_tx += usage.network.tx_bytes || 0;
                nodeUsages.network_rx += usage.network.rx_bytes || 0;
            } else {
                err = true;
            }
            const mappings = server.configuration.allocations.mappings;
            nodeUsages.allocations += Object.keys(mappings).length || 0;
            if (server.state === 'running') {
                nodeUsages.onlineServers += 1;
            }
        }
        if (err) {
            console.warn(`Warning: One or more server usages could not be fetched for node ${nodeId}. The node usages may be incomplete or inaccurate. You can safely ignore this message if you wish to continue using partial data for the node embed.`);
        }

        const wingsInfo = await checkWings(nodeDetails, nodeConfig.token); //contains {architecture: 'amd64',cpu_count: 4,kernel_version: '6.8.0-87-generic',os: 'linux',version: 'develop'}
        const nodeStatus = wingsInfo ? "online" : "offline";
        const statusIcon = nodeStatus === "online" ? "🟢 Online" : "🔴 Offline";

        //cpu usage is 100% for each core so if we have 4 cores and 200% usage that means 50% actual usage
        if (wingsInfo && wingsInfo.cpu_count && wingsInfo.cpu_count > 0) {
            nodeUsages.cpu = nodeUsages.cpu / wingsInfo.cpu_count;
        }

        const embed = new EmbedBuilder()
            .setAuthor({ name: `Node ID: ${nodeDetails.id} - Status: ${statusIcon}` })
            .setTitle(`${nodeDetails.name}`)
            .setColor(embedColorFromWingsStatus(nodeStatus))
            .addFields(
                { name: "FQDN", value: `\`\`\`${nodeDetails.fqdn}\`\`\``, inline: false },
                { name: `CPU Usage (${wingsInfo.cpu_count}c)`, value: `\`\`\`${nodeUsages.cpu.toFixed(2)} %\`\`\``, inline: true },
                { name: "Memory Usage", value: `\`\`\`${formatBytes(nodeUsages.memory)} / ${formatMegabytes(nodeDetails.memory)}\`\`\``, inline: true },
                { name: "Disk Usage", value: `\`\`\`${formatBytes(nodeUsages.disk)} / ${formatMegabytes(nodeDetails.disk)}\`\`\``, inline: true },
                { name: "Network ↑", value: `\`\`\`${formatBytes(nodeUsages.network_tx)}\`\`\``, inline: true },
                { name: "Network ↓", value: `\`\`\`${formatBytes(nodeUsages.network_rx)}\`\`\``, inline: true },

                { name: "Location", value: `\`\`\`${locationDetails.short}\`\`\``, inline: true },
                { name: "Allocations", value: `\`\`\`${nodeUsages.allocations} / ${allocationCount}\`\`\``, inline: true },
                { name: "Servers Running", value: `\`\`\`${nodeUsages.onlineServers} / ${servers.length}\`\`\``, inline: true },
                { name: "Wings Version", value: `\`\`\`${wingsInfo ? wingsInfo.version : 'N/A'}\`\`\``, inline: true },
            )
            .setDescription(`Last updated: <t:${Math.floor(Date.now() / 1000)}:R>\nNext update in <t:${Math.floor(Date.now() / 1000) + pterodactyl.NODE_STATUS_UPDATE_INTERVAL}:R>`)
            .setTimestamp()
            .setFooter({ text: 'Powered by Pterodactyl', iconURL: 'https://p7.hiclipart.com/preview/978/71/779/pterodactyls-pteranodon-minecraft-pterosaurs-computer-servers-minecraft.jpg' });

        return embed;
    },

    async createServerStatusEmbed(serverId, clientApiKey, iconUrl, enableLogs) {
        const pteroClient = new Nodeactyl.NodeactylClient(pterodactyl.domain, clientApiKey);
        const serverDetails = await pteroClient.getServerDetails(serverId);
        const serverResourceUsage = await pteroClient.getServerUsages(serverId);
        const serverPowerState = await pteroClient.getServerStatus(serverId);
        const defaultAllocation = serverDetails.relationships.allocations.data.find(alloc => alloc.attributes.is_default);
        const ip = defaultAllocation.attributes.ip_alias || defaultAllocation.attributes.ip;
        const port = defaultAllocation.attributes.port;
        const extras = await getServerExtras(ip, port);
        let latestLogs = null;


        if (pterodactyl.ENABLE_SERVER_STATUS_CONSOLE_LOGS && enableLogs) {
            //try and get the logs using an api request to wings (need an appliction api key with server.read permission) This will be optional so users without an api key can still use the bot
            const pteroApp = new Nodeactyl.NodeactylApplication(pterodactyl.domain, pterodactyl.apiKey);
            const nodes = await pteroApp.getAllNodes().catch((error) => { //do nothing since this is an optional feature
                //console.warn(`Error fetching all nodes:`, getAppErrorMessage(error)); 
            });
            if (nodes !== undefined && nodes.data !== undefined) { 
                const node = nodes.data.find(n => n.attributes.fqdn === serverDetails.sftp_details.ip);
                if (node) {
                    const nodeConfig = await pteroApp.getNodeConfig(node.attributes.id).catch((error) => {
                        //console.warn(`Error fetching node config for node ID ${node.attributes.id}:`, getAppErrorMessage(error));
                    });
                    if (nodeConfig) {
                        const wingsLogs = await wingsApiReq(node.attributes, nodeConfig.token, `servers/${serverDetails.uuid}/logs`).catch((error) => {
                            //console.warn(`Error fetching logs for server ID ${serverId} from wings:`, getAppErrorMessage(error));
                        });
                        if (wingsLogs?.data) {
                            const last3 = wingsLogs.data.slice(-3);

                            latestLogs = last3
                                .map(line => stripAnsi(line.replace(/^\[\s*\w+:\w+\]\s*/, '')))
                                .join('\n'); // preserve newlines

                            // Trim to 512 characters if needed
                            if (latestLogs.length > 512) {
                                latestLogs = latestLogs.slice(-512);
                            }
                        }


                    }
                }
            }
        }

        const embed = new EmbedBuilder()
            .setAuthor({ name: `Status: ${serverPowerEmoji(serverPowerState)}` })
            .setTitle(`${serverDetails.name}`)
            .setColor(embedColorFromStatus(serverPowerState))
            .setDescription(`Last updated <t:${Math.floor(Date.now() / 1000)}:R>`)
            .addFields(
                { name: "Address", value: `\`\`\`${ip}:${port}\`\`\``, inline: false },
                { name: "CPU Usage", value: `\`\`\`${serverResourceUsage.resources.cpu_absolute.toFixed(2)}% / ${serverDetails.limits.cpu}%\`\`\``, inline: true },
                { name: "Memory Usage", value: `\`\`\`${formatBytes(serverResourceUsage.resources.memory_bytes)} / ${formatMegabytes(serverDetails.limits.memory)}\`\`\``, inline: true },
                { name: "Disk Usage", value: `\`\`\`${formatBytes(serverResourceUsage.resources.disk_bytes)} / ${formatMegabytes(serverDetails.limits.disk)}\`\`\``, inline: true },
                { name: "Uptime", value: `\`\`\`${uptimeToString(serverResourceUsage.resources.uptime)}\`\`\``, inline: true },
            )
            .setTimestamp()
            .setFooter({ text: 'Powered by Pterodactyl', iconURL: 'https://p7.hiclipart.com/preview/978/71/779/pterodactyls-pteranodon-minecraft-pterosaurs-computer-servers-minecraft.jpg' });
        if (iconUrl) {
            embed.setThumbnail(iconUrl);
        }
        if (extras && extras.players !== undefined && extras.maxPlayers !== undefined) {
            embed.addFields(
                { name: "Players", value: `\`\`\`${extras.players} / ${extras.maxPlayers}\`\`\``, inline: true },
            );
        }
        if (extras && extras.version !== undefined) {
            embed.addFields(
                { name: "MC Version", value: `\`\`\`${extras.version}\`\`\``, inline: true,  },
            );
        }
        if (latestLogs && pterodactyl.ENABLE_SERVER_STATUS_CONSOLE_LOGS && enableLogs) {
            embed.addFields(
                { name: "Latest Logs", value: `\`\`\`${latestLogs}\`\`\``, inline: false },
            );
        }
        return embed;
    }


};