const Nodeactyl = require("nodeactyl");
const { EmbedBuilder } = require("discord.js");
const { pterodactyl, NODE_STATUS_UPDATE_INTERVAL } = require("../../config.json");
const { formatBytes, formatMegabytes, uptimeToString, serverPowerEmoji, embedColorFromStatus, checkWings, embedColorFromWingsStatus } = require("./serverUtils");
const mcs = require('node-mcstatus');

module.exports = {
    async createNodeStatusEmbed(nodeId) {
        //defer 
        const appApiKey = pterodactyl.apiKey;
        const pteroApp = new Nodeactyl.NodeactylApplication(pterodactyl.domain, appApiKey);

        const nodeDetails = await pteroApp.getNodeDetails(nodeId);
        const nodeConfig = await pteroApp.getNodeConfig(nodeId);
        const locationDetails = await pteroApp.getLocationDetails(nodeDetails.location_id);
        const nodeAllocations = await pteroApp.getNodeAllocations(nodeId);
        const allocationCount = nodeAllocations.data.length;
        
        //to get usage stats we need to get all servers on this node and sum their usages (easy way)
        const serversResponse = await pteroApp.getAllServers();
        //filter servers to only those on this node
        const servers = serversResponse.data.filter(server => server.attributes.node === parseInt(nodeId));


        //use client api key with admin access to get server usages since app api key cannot access server usages for some reason
        const clientApiKey = pterodactyl.cl_apiKey;
        const pteroClient = new Nodeactyl.NodeactylClient(pterodactyl.domain, clientApiKey);
        const nodeUsages = { cpu: 0, memory: 0, disk: 0, network_tx: 0, network_rx: 0
        };
        for (const server of servers) {
            const usage = await pteroClient.getServerUsages(server.attributes.identifier).catch(() => null);
            if (usage && usage.resources) {
                nodeUsages.cpu += usage.resources.cpu_absolute || 0;
                nodeUsages.memory += usage.resources.memory_bytes || 0;
                nodeUsages.disk += usage.resources.disk_bytes || 0;
                nodeUsages.network_tx += usage.resources.network_tx_bytes || 0;
                nodeUsages.network_rx += usage.resources.network_rx_bytes || 0;
            }
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
                { name: "Network TX", value: `\`\`\`${formatBytes(nodeUsages.network_tx)}\`\`\``, inline: true },
                { name: "Network RX", value: `\`\`\`${formatBytes(nodeUsages.network_rx)}\`\`\``, inline: true },

                { name: "Location", value: `\`\`\`${locationDetails.short}\`\`\``, inline: true },
                { name: "Allocations", value: `\`\`\`${allocationCount}\`\`\``, inline: true },
                { name: "Total Servers", value: `\`\`\`${servers.length}\`\`\``, inline: true },
                { name: "Wings Version", value: `\`\`\`${wingsInfo ? wingsInfo.version : 'N/A'}\`\`\``, inline: true },
            )
            .setDescription(`Last updated: <t:${Math.floor(Date.now() / 1000)}:T>\nNext update at <t:${Math.floor(Date.now() / 1000) + NODE_STATUS_UPDATE_INTERVAL}:T>`)
            .setTimestamp()
            .setFooter({ text: 'Powered by Pterodactyl', iconURL: 'https://p7.hiclipart.com/preview/978/71/779/pterodactyls-pteranodon-minecraft-pterosaurs-computer-servers-minecraft.jpg' });

        return embed;
    },

    async createServerStatusEmbed(serverId, clientApiKey, iconUrl) {
        const pteroClient = new Nodeactyl.NodeactylClient(pterodactyl.domain, clientApiKey);
        const serverDetails = await pteroClient.getServerDetails(serverId);
        const serverResourceUsage = await pteroClient.getServerUsages(serverId);
        const serverPowerState = await pteroClient.getServerStatus(serverId);
        const defaultAllocation = serverDetails.relationships.allocations.data.find(alloc => alloc.attributes.is_default);
        let minecraftPlayers = null;
        let maxPlayers = null;
        let minecraftVersion = null;
        if (defaultAllocation) {
            //check if server is a minecraft server by checking if the server name or description contains "minecraft"
            const res = await mcs.statusJava(defaultAllocation.attributes.ip_alias, defaultAllocation.attributes.port);
            if (res && res.players) {
                minecraftPlayers = res.players.online;
                maxPlayers = res.players.max;
                minecraftVersion = res.version.name_clean;
            } else {
                //try bedrock
                const resBedrock = await mcs.statusBedrock(defaultAllocation.attributes.ip_alias, defaultAllocation.attributes.port);
                if (resBedrock && resBedrock.players) {
                    minecraftPlayers = resBedrock.players.online;
                    maxPlayers = resBedrock.players.max;
                    minecraftVersion = resBedrock.version.name_clean;
                }
            }
        }

        const embed = new EmbedBuilder()
            .setAuthor({ name: `Status: ${serverPowerEmoji(serverPowerState)} ${serverPowerState.charAt(0).toUpperCase() + serverPowerState.slice(1)}` })
            .setTitle(`${serverDetails.name}`)
            .setColor(embedColorFromStatus(serverPowerState))
            .setDescription(`Last updated at <t:${Math.floor(Date.now() / 1000)}:T>`)
            .addFields(
                { name: "Address", value: `\`\`\`${defaultAllocation.attributes.ip_alias}:${defaultAllocation.attributes.port}\`\`\``, inline: false },
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
        if (minecraftPlayers !== null && maxPlayers !== null) {
            embed.addFields(
                { name: "Players", value: `\`\`\`${minecraftPlayers} / ${maxPlayers}\`\`\``, inline: true },
            );
        }
        if (minecraftVersion !== null) {
            embed.addFields(
                { name: "MC Version", value: `\`\`\`${minecraftVersion}\`\`\``, inline: true,  },
            );
        }
        return embed;
    }


};