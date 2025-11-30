const { EmbedBuilder, ButtonBuilder, ActionRowBuilder } = require("discord.js");
const { pterodactyl } = require("../../config.json");
const { formatBytes, formatMegabytes, uptimeToString, serverPowerEmoji, embedColorFromStatus, embedColorFromWingsStatus, stripAnsi, isApplicationKeyValid } = require("./serverUtils");
const { getServerExtras } = require("./getServerExtras");
const { PteroWings } = require("../requests/wingsApiReq");
const { PteroClient } = require("../requests/clientApiReq");
const { PteroApp } = require("../requests/appApiReq");

module.exports = {
    async createNodeStatusEmbed(nodeId) {
        
        const nodeDetailsResponse = await PteroApp.request(`nodes/${nodeId}`, 'get', {include: 'location,allocations,servers'});
        const nodeDetails = nodeDetailsResponse.attributes;
        const nodeConfigResponse = await PteroApp.request(`nodes/${nodeId}/configuration`);
        const nodeConfig = nodeConfigResponse;
        const allocationCount = nodeDetails.relationships.allocations.data.length || 0;
        const locationDetails = nodeDetails.relationships.location.attributes;
        
        //get server details from wings api since it provides the most info about servers (including logs even when the server is offline)
        let servers = [];
        let wingsSuccess = false;
        try {
            servers = await PteroWings.request('servers', nodeDetails, nodeConfig.token);
            wingsSuccess = true;
        } catch (error) {
            console.warn(`Could not fetch servers from Wings for node with ID ${nodeId} : ${PteroWings.getErrorMessage(error)} You can delete the status embed if you wish to stop seeing this message.`);
            // Continue with empty servers array
            wingsSuccess = false; //was not able to fetch wings 
        }

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
            const mappings = server.configuration?.allocations?.mappings;
            if (mappings) {
                nodeUsages.allocations += Object.values(mappings).reduce((sum, arr) => sum + arr.length, 0) || 0;
            }
            if (server.state === 'running') {
                nodeUsages.onlineServers += 1;
            }
        }
        if (err) {
            console.warn(`Warning: One or more server usages could not be fetched for node ${nodeId}. The node usages may be incomplete or inaccurate. You can safely ignore this message if you wish to continue using partial data for the node embed.`);
        }


        let wingsInfo;
        if (wingsSuccess) {
            wingsInfo = await PteroWings.request('system', nodeDetails, nodeConfig.token).catch((error) => {
                if (pterodactyl.ERROR_LOGGING_ENABLED) {
                    console.error(`Error fetching wings system info for node ID ${nodeId}:`, PteroApp.getErrorMessage(error));
                }
                return null; //treat as offline
            });
        } else {
            wingsInfo = null;
        }


        const nodeStatus = wingsInfo ? "online" : "offline";
        const statusIcon = nodeStatus === "online" ? "🟢 Online" : "🔴 Offline";

        //cpu usage is 100% for each core so if we have 4 cores and 200% usage that means 50% actual usage
        if (wingsInfo && wingsInfo.cpu_count && wingsInfo.cpu_count > 0) {
            nodeUsages.cpu = nodeUsages.cpu / wingsInfo.cpu_count || 0;
        }

        const cpuCount = wingsInfo?.cpu_count || 'N/A';
        const cpuLabel = cpuCount !== 'N/A' ? `CPU Usage (${cpuCount}c)` : 'CPU Usage';

        const embed = new EmbedBuilder()
            .setAuthor({ name: `Node ID: ${nodeDetails.id} - Status: ${statusIcon}` })
            .setTitle(`${nodeDetails.name}`)
            .setColor(embedColorFromWingsStatus(nodeStatus))
            .addFields(
                { name: "FQDN", value: `\`\`\`${nodeDetails.fqdn}\`\`\``, inline: false },
                { name: cpuLabel, value: `\`\`\`${nodeUsages.cpu.toFixed(2)}%\`\`\``, inline: true },
                { name: "Memory Usage", value: `\`\`\`${formatBytes(nodeUsages.memory)} / ${formatMegabytes(nodeDetails.memory)}\`\`\``, inline: true },
                { name: "Disk Usage", value: `\`\`\`${formatBytes(nodeUsages.disk)} / ${formatMegabytes(nodeDetails.disk)}\`\`\``, inline: true },
                { name: "Network ↑", value: `\`\`\`${formatBytes(nodeUsages.network_tx)}\`\`\``, inline: true },
                { name: "Network ↓", value: `\`\`\`${formatBytes(nodeUsages.network_rx)}\`\`\``, inline: true },

                { name: "Location", value: `\`\`\`${locationDetails.short}\`\`\``, inline: true },
                { name: "Allocations", value: `\`\`\`${nodeUsages.allocations} / ${allocationCount}\`\`\``, inline: true },
                { name: "Servers Running", value: `\`\`\`${nodeUsages.onlineServers} / ${servers.length}\`\`\``, inline: true },
                { name: "Wings Version", value: `\`\`\`${wingsInfo ? wingsInfo.version : 'N/A'}\`\`\``, inline: true },
            )
            .setDescription(`Last updated: <t:${Math.floor(Date.now() / 1000)}:R>\nNext update in <t:${Math.floor(Date.now() / 1000) + pterodactyl.NODE_STATUS_UPDATE_INTERVAL}:R>`)
            .setTimestamp()
            .setFooter({ text: `${pterodactyl.EMBED_FOOTER_TEXT}`, iconURL: `${pterodactyl.EMBED_FOOTER_ICON_URL}` });

        return embed;
    },

    async createServerStatusEmbed(serverId, clientApiKey, iconUrl, enableLogs) {
        const serverInfoRespone = await PteroClient.request(`servers/${serverId}`, clientApiKey);
        const serverDetails = serverInfoRespone.attributes;
        
        let serverResourceUsage = null;
        try {
            const resourceResponse = await PteroClient.request(`servers/${serverDetails.uuid}/resources`, clientApiKey);
            serverResourceUsage = resourceResponse.attributes;
        } catch (error) {
            if (pterodactyl.ERROR_LOGGING_ENABLED) {
                console.warn(`Could not fetch server usage for ${serverId} :  ${PteroClient.getErrorMessage(error)} The node may be offline or unreachable.`);
            }
            // Set default offline values
            serverResourceUsage = {
                current_state: "unknown",
                resources: {
                    cpu_absolute: 0,
                    memory_bytes: 0,
                    disk_bytes: 0,
                    uptime: 0
                }
            };
        }

        const serverPowerState = serverResourceUsage.current_state || "unknown";        
        const defaultAllocation = serverDetails.relationships.allocations.data.find(alloc => alloc.attributes.is_default);
        const ip = defaultAllocation.attributes.ip_alias || defaultAllocation.attributes.ip;
        const port = defaultAllocation.attributes.port;
        const extras = await getServerExtras(ip, port);
        let latestLogs = null;

        if (pterodactyl.ENABLE_SERVER_STATUS_CONSOLE_LOGS && enableLogs) {
            const isAppKeyValid = await isApplicationKeyValid();
            if (!isAppKeyValid) {
                console.warn("The Pterodactyl application API key is invalid. Cannot fetch server logs for status embed for server ID:", serverId);
                return;
            }
            //try and get the logs using an api request to wings (need an appliction api key with server.read permission) This will be optional so users without an api key can still use the bot
            //const pteroApp = new Nodeactyl.NodeactylApplication(pterodactyl.domain, pterodactyl.apiKey);
            const nodes = await PteroApp.request('nodes').catch((error) => {
                console.warn(`Error fetching nodes to get logs for server status embed (ID): ${serverId}:`, PteroApp.getErrorMessage(error));
            });
            if (nodes !== undefined && nodes.data !== undefined) { 
                const node = nodes.data.find(n => n.attributes.fqdn === ip);
                if (node) {
                    const nodeConfig = await PteroApp.request(`nodes/${node.attributes.id}/configuration`).catch((error) => {
                        console.warn(`Error fetching node config to get logs for server status embed (ID): ${serverId}:`, PteroApp.getErrorMessage(error));
                    });
                    if (nodeConfig) {
                        const wingsLogs = await PteroWings.request(`servers/${serverDetails.uuid}/logs?size=3`, node.attributes, nodeConfig.token).catch((error) => {
                            console.warn(`Error fetching logs for server ID ${serverId} from wings:`, PteroApp.getErrorMessage(error));
                        });
                        if (wingsLogs?.data) {
                            latestLogs = wingsLogs.data
                                .map(line => line.replace(/.*?\[[^\]]*]\s*/, ''))
                                .join('\n');

                            // Trim to 512 characters if needed
                            if (latestLogs.length > 512) {
                                latestLogs = latestLogs.slice(-512);
                            }
                        }
                    }
                }
            } else {
                console.warn(`Could not fetch nodes to get logs for server status embed (ID): ${serverId}.`);
            }
        }

        const embed = new EmbedBuilder()
            .setAuthor({ name: `${serverDetails.identifier} - Status: ${serverPowerEmoji(serverPowerState)}` })
            .setTitle(`${serverDetails.name}`)
            .setColor(embedColorFromStatus(serverPowerState))
            .setDescription(`Last updated: <t:${Math.floor(Date.now() / 1000)}:R>`)
            .addFields(
                { name: "Address", value: `\`\`\`${ip}:${port}\`\`\``, inline: false },
                { name: "CPU Usage", value: `\`\`\`${serverResourceUsage.resources.cpu_absolute.toFixed(2)}% / ${serverDetails.limits.cpu}%\`\`\``, inline: true },
                { name: "Memory Usage", value: `\`\`\`${formatBytes(serverResourceUsage.resources.memory_bytes)} / ${formatMegabytes(serverDetails.limits.memory)}\`\`\``, inline: true },
                { name: "Disk Usage", value: `\`\`\`${formatBytes(serverResourceUsage.resources.disk_bytes)} / ${formatMegabytes(serverDetails.limits.disk)}\`\`\``, inline: true },
                { name: "Uptime", value: `\`\`\`${uptimeToString(serverResourceUsage.resources.uptime)}\`\`\``, inline: true },
            )
            .setTimestamp()
            .setFooter({ text: `${pterodactyl.EMBED_FOOTER_TEXT}`, iconURL: `${pterodactyl.EMBED_FOOTER_ICON_URL}` });
        if (iconUrl) {
            embed.setThumbnail(iconUrl);
        }
        if (extras && extras.players !== undefined && extras.maxPlayers !== undefined) {
            embed.addFields(
                { name: "Players", value: `\`\`\`${extras.players} / ${extras.maxPlayers}\`\`\``, inline: true },
            );
        }
        if (extras && extras.version !== undefined) {
            embed.addFields(
                { name: "Version", value: `\`\`\`${extras.version}\`\`\``, inline: true,  },
            );
        }
        if (latestLogs && pterodactyl.ENABLE_SERVER_STATUS_CONSOLE_LOGS && enableLogs) {
            embed.addFields(
                { name: "Latest Logs", value: `\`\`\`ansi\n${latestLogs}\`\`\``, inline: false },
            );
        }
        if (extras && extras.joinLink !== undefined) {
            embed.setURL(extras.joinLink);
        }
        return embed;
    },


    async createAccountDetailsEmbed(userId, clientApiKey) {
        try {
            const userInfoResponse = await PteroClient.request('account', clientApiKey);
            const userInfo = userInfoResponse.attributes;
            const serversResponse = await PteroClient.request('', clientApiKey); //servers is for some reason the root endpoint
            const servers = serversResponse;
            let totalAllocatedResources = {
                memory: 0,
                disk: 0,
                cpu: 0
            };
            for (const server of servers.data) {
                totalAllocatedResources.memory += server.attributes.limits.memory || 0;
                totalAllocatedResources.disk += server.attributes.limits.disk || 0;
                totalAllocatedResources.cpu += server.attributes.limits.cpu || 0;
            }

            const panelButton = new ButtonBuilder()
                .setLabel('Open Panel')
                .setStyle('Link')
                .setURL(`${pterodactyl.domain}`);
            const actionRow = new ActionRowBuilder().addComponents(panelButton);

            const embed = new EmbedBuilder()
                .setAuthor({ name: `Account ID: ${userId}` })
                .setTitle(`${userInfo.username}'s Account Details`)
                .setColor(0x00AE86)
                .addFields(
                    { name: "Username", value: `\`\`\`${userInfo.username}\`\`\``, inline: true },
                    { name: "Name", value: `||\`\`\`${userInfo.first_name || 'N/A'}\`\`\`||`, inline: true },
                    { name: "Email", value: `||\`\`\`${userInfo.email}\`\`\`||`, inline: false },
                    { name: "Total Allocated CPU", value: `\`\`\`${totalAllocatedResources.cpu}%\`\`\``, inline: true },
                    { name: "Total Allocated Memory", value: `\`\`\`${formatMegabytes(totalAllocatedResources.memory)}\`\`\``, inline: true },
                    { name: "Total Allocated Disk", value: `\`\`\`${formatMegabytes(totalAllocatedResources.disk)}\`\`\``, inline: true },
                    { name: "Total Servers", value: `\`\`\`${servers.data.length}\`\`\``, inline: true },
                    { name: "Admin", value: `\`\`\`${userInfo.admin ? 'Yes' : 'No'}\`\`\``, inline: true },
                )
                .setTimestamp()
                .setFooter({ text: `${pterodactyl.EMBED_FOOTER_TEXT}`, iconURL: `${pterodactyl.EMBED_FOOTER_ICON_URL}` });  
            return { embed, components: [actionRow]  };

        } catch (error) {
            console.error(`Error creating account details embed for user ID ${userId}:`, PteroClient.getErrorMessage(error));
            throw new Error(`Failed to create account details embed: ${error}`);
        }
    }



};