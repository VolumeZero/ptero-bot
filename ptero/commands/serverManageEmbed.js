const Nodeactyl = require("nodeactyl");
const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require("discord.js");
const { pterodactyl } = require("../../config.json");
const { loadApiKey } = require("../keys");
const { WebSocket } = require("ws");
const { getErrorMessage } = require("../utils/clientErrors");
const { formatBytes, formatMegabytes, uptimeToString, serverPowerEmoji, stripAnsi, embedConsoleStr } = require("../utils/serverUtils");


const activeSessions = new Map(); // userId_serverId -> embed data

async function serverManageEmbed(interaction, serverId) {
    try {
        await interaction.deferReply({ ephemeral: true });

        if (activeSessions.has(interaction.user.id)) {
            const oldSession = activeSessions.get(interaction.user.id);  
            // Stop its collector and interval
            oldSession.collector?.stop("replaced");
            clearInterval(oldSession.interval);
            activeSessions.delete(interaction.user.id);
        }


        const clientApiKey = await loadApiKey(interaction.user.id);
        const pteroClient = new Nodeactyl.NodeactylClient(pterodactyl.domain, clientApiKey);
        const serverDetails = await pteroClient.getServerDetails(serverId).catch((err) => {
            const errorMessage = getErrorMessage(err);
            interaction.editReply({ content: `Error fetching server details: ${errorMessage}`});
            return null;
        });
        if (!serverDetails) return; // already handled above

        let serverResourceUsage = await pteroClient.getServerUsages(serverId);
        const serverPowerState = await pteroClient.getServerStatus(serverId);
        const userInfo = await pteroClient.getAccountDetails();
        const defaultAllocation = serverDetails.relationships.allocations.data.find(alloc => alloc.attributes.is_default);
        //console.log(serverDetails);
        //console.log(serverResourceUsage);
        //console.log(userInfo);

        const wsData = await pteroClient.getConsoleWebSocket(serverId);

        // Setup websocket and log buffer
        const ws = new WebSocket(wsData.socket, {
            origin: pterodactyl.domain,
            headers: { "User-Agent": "Nodeactyl/1.0" },
        });


        ws.on("open", () => {
            ws.send(JSON.stringify({ event: "auth", args: [wsData.token] }));
        });

        let logBuffer = "";
        //This is the main websocket handler, this avoids rate limits on the pterodactyl side so discord is our only bottleneck
        ws.on("message", (data) => {
            try {
                const payload = JSON.parse(data.toString());
                if (payload.event === "auth success") {
                    ws.send(JSON.stringify({ event: "send logs", args: [null] })); //this tells the websocket to send previous logs (the amount (lines) is determined by wings config i do believe)
                } else if (payload.event === "console output") { //sent any time there is new console output
                    logBuffer += stripAnsi(payload.args.join(" ")) + "\n";
                    if (logBuffer.length > 10000) {
                        logBuffer = logBuffer.slice(-2048); //really only need the last 2048 characters of logs, this helps memory usage
                    }
                } else if (payload.event === "stats") { //normally this is sent once every second
                    const liveStats = JSON.parse(payload.args[0]);
                    serverResourceUsage.current_state = liveStats.state;
                    serverResourceUsage.resources.cpu_absolute = liveStats.cpu_absolute;
                    serverResourceUsage.resources.memory_bytes = liveStats.memory_bytes;
                    serverResourceUsage.resources.disk_bytes = liveStats.disk_bytes;
                    serverResourceUsage.resources.uptime = liveStats.uptime;
                    serverResourceUsage.resources.network_rx_bytes = liveStats.network.rx_bytes;
                    serverResourceUsage.resources.network_tx_bytes = liveStats.network.tx_bytes;
                } else if (payload.event === "auth failure") {
                    console.error("WebSocket authentication failed.");
                }
            } catch (err) {
                console.error("Failed to parse WebSocket message:", err);
            }
        });

        ws.on("close", () => console.log(`WebSocket closed for server ${serverId}`));
        ws.on("error", (err) => console.error("WebSocket error:", err));

        // Create server embed
        const embed = new EmbedBuilder() //make getter function later for easier editing?? Components v2?? 
            .setTitle(`Manage Server: ${serverDetails.name}`)
            .setColor(0x00AE86)
            .addFields(
                { name: "Address", value: `\`\`\`${defaultAllocation.attributes.ip_alias}:${defaultAllocation.attributes.port}\`\`\``, inline: false },

                { name: "Status", value: `\`\`\`${serverPowerEmoji(serverPowerState)}\`\`\`` ?? "N/A", inline: true },
                { name: "CPU Usage", value: `\`\`\`${serverResourceUsage.resources.cpu_absolute.toFixed(2)}% / ${serverDetails.limits.cpu}%\`\`\``, inline: true },
                { name: "Memory Usage", value: `\`\`\`${formatBytes(serverResourceUsage.resources.memory_bytes)} / ${formatMegabytes(serverDetails.limits.memory)}\`\`\``, inline: true },

                { name: "Disk Usage", value: `\`\`\`${formatBytes(serverResourceUsage.resources.disk_bytes)} / ${formatMegabytes(serverDetails.limits.disk)}\`\`\``, inline: true },
                { name: "Uptime", value: `\`\`\`${uptimeToString(serverResourceUsage.resources.uptime)}\`\`\``, inline: true },
                //last three lines of logs
                { name: "Console", value: logBuffer.length === 0 ? "Loading..." : `\`\`\`\n${embedConsoleStr(logBuffer, 3, 1024)}\n\`\`\``, inline: false }, //limit to last 3 lines or 1024 characters (discord embed limit)
                

            )
            .setTimestamp()
            .setFooter({ text: 'Powered by Pterodactyl', iconURL: 'https://p7.hiclipart.com/preview/978/71/779/pterodactyls-pteranodon-minecraft-pterosaurs-computer-servers-minecraft.jpg' });

        const buttons = [];

        const logsButtonId = `get_console_logs_${interaction.user.id}_${serverId}`;
        const consoleLogButton = new ButtonBuilder()
            .setCustomId(logsButtonId)
            .setLabel('Logs 📋')
            .setStyle(ButtonStyle.Primary);
        buttons.push(consoleLogButton);

        const sftpInfoButtonId = `get_sftp_info_${interaction.user.id}_${serverId}`;
        const sftpInfoButton = new ButtonBuilder()
            .setCustomId(sftpInfoButtonId)
            .setLabel('SFTP Info 🔑')
            .setStyle(ButtonStyle.Secondary);
        buttons.push(sftpInfoButton);

        const panelLinkButton = new ButtonBuilder()
            .setLabel('View on Panel 🌐')
            .setStyle(ButtonStyle.Link)
            .setURL(`${pterodactyl.domain}/server/${serverId}`);
        buttons.push(panelLinkButton);

        const stopServerButtonId = `stop_server_${interaction.user.id}_${serverId}`;
        const stopServerButton = new ButtonBuilder()
            .setLabel('Stop Server ⏹️')
            .setStyle(ButtonStyle.Danger)
            .setCustomId(stopServerButtonId);
        buttons.push(stopServerButton);

        const restartServerButtonId = `restart_server_${interaction.user.id}_${serverId}`;
        const restartServerButton = new ButtonBuilder()
            .setLabel('Restart Server 🔄')
            .setStyle(ButtonStyle.Success)
            .setCustomId(restartServerButtonId);
        buttons.push(restartServerButton);

        const refreshButtonId = `refresh_${interaction.user.id}_${serverId}`;
        const refreshButton = new ButtonBuilder()
            .setCustomId(refreshButtonId)
            .setLabel("Refresh Info 🔄")
            .setStyle(ButtonStyle.Secondary);
        buttons.push(refreshButton);

        const actionRow1 = new ActionRowBuilder().addComponents(buttons.slice(0, 3));
        const actionRow2 = new ActionRowBuilder().addComponents(buttons.slice(3, 6));

        await interaction.editReply({ embeds: [embed], components: [actionRow1, actionRow2] }); //initial reply

        let liveUpdateInterval = setInterval(async () => {
            if (!ws || ws.readyState !== WebSocket.OPEN) return;

            try {
                await updateAllEmbedFields(embed, serverDetails, serverResourceUsage, logBuffer);
                await interaction.editReply({ embeds: [embed] });
            } catch (err) {
                //this is some AI shit i have no idea if it works lol
                if (err.code === 50013 || err.status === 429) {
                    // Rate limited or missing permissions
                    console.warn(`Discord rate limit hit, increasing update interval on server manager for server: ${serverId}`)
                    clearInterval(liveUpdateInterval);
                    liveUpdateInterval = setInterval(arguments.callee, (pterodactyl.MANAGER_EMBED_UPDATE_INTERVAL * 2) * 1000);
                } else {
                    console.error("Failed to auto-update embed:", err);
                }
            }
        }, pterodactyl.MANAGER_EMBED_UPDATE_INTERVAL * 1000);


        // Collector for the unique button
        const collector = interaction.channel.createMessageComponentCollector({
            filter: buttonInteraction => buttonInteraction.user.id === interaction.user.id,  
            time: 15 * 60 * 1000,
            idle: 120_000            // ❗ 2 MINUTE INACTIVITY TIMEOUT
        });

        const cooldowns = new Map(); // userId -> timestamp

        collector.on("collect", async (buttonInteraction) => {
            try {
                // --------------------
                // COOLDOWN (only for logs)
                // --------------------
                if (buttonInteraction.customId === logsButtonId) {
                    const now = Date.now();
                    if (cooldowns.has(buttonInteraction.user.id) && now < cooldowns.get(buttonInteraction.user.id)) {
                        const remaining = Math.ceil((cooldowns.get(buttonInteraction.user.id) - now) / 1000);
                        return await buttonInteraction.reply({
                            content: `Please wait ${remaining}s before requesting logs again.`,
                            ephemeral: true
                        });
                    }
                    cooldowns.set(buttonInteraction.user.id, now + 10000); // 10s cooldown
                }
            
                // --------------------
                // ACTION HANDLER
                // --------------------
                switch (buttonInteraction.customId) {
                
                    // 📋 LOGS BUTTON
                    case logsButtonId: {
                        const logsToSend = logBuffer.length === 0
                            ? "No logs available."
                            : `\`\`\`\n${logBuffer.slice(-1990)}\n\`\`\``;
                    
                        return await buttonInteraction.reply({ content: logsToSend, ephemeral: true });
                    }
                
                    // 🔑 SFTP INFO BUTTON
                    case sftpInfoButtonId: {
                        return await buttonInteraction.reply({
                            ephemeral: true,
                            content:
                                `**Host**: \`sftp://${serverDetails.sftp_details.ip}:${serverDetails.sftp_details.port}\`\n` +
                                `**Username**: ||\`${userInfo.username}.${serverId}\`||\n` +
                                `**Password**: \`(Your account password)\`\n`
                        });
                    }

                    // 🔄 RESTART SERVER BUTTON
                    case restartServerButtonId: {
                        try {
                            const success = await pteroClient.restartServer(serverId);
                            updateEmbedField(embed, "Status", `\`\`\`${serverPowerEmoji(serverResourceUsage.current_state)}\`\`\`` ?? "N/A");
                            if (success) {
                                return await buttonInteraction.reply({ content: "Server is restarting...", ephemeral: true });
                            } else {
                                return await buttonInteraction.reply({ content: "Failed to restart the server.", ephemeral: true });
                            }
                        } catch (err) {
                            //if 403 error, insufficient permissions
                            if (err === 403) {
                                return await buttonInteraction.reply({ content: "You do not have permission to restart this server.", ephemeral: true });
                            }
                            console.error("Error restarting server:", err);
                            return await buttonInteraction.reply({ content: "An unknown error occurred while restarting the server.", ephemeral: true });
                        }
                    }

                    // ⏹️ STOP SERVER BUTTON
                    case stopServerButtonId: {
                        try {
                            const success = await pteroClient.stopServer(serverId);
                            updateEmbedField(embed, "Status", `\`\`\`${serverPowerEmoji(serverResourceUsage.current_state)}\`\`\`` ?? "N/A");
                            if (success) {
                                return await buttonInteraction.reply({ content: "Server is stopping...", ephemeral: true });
                            } else {
                                return await buttonInteraction.reply({ content: "Failed to stop the server.", ephemeral: true });
                            }
                        } catch (err) {
                            //if 403 error, insufficient permissions
                            if (err === 403) {
                                return await buttonInteraction.reply({ content: "You do not have permission to stop this server.", ephemeral: true });
                            }
                            console.error("Error stopping server:", err);
                            return await buttonInteraction.reply({ content: "An unknown error occurred while stopping the server.", ephemeral: true });
                        }
                    }

                    // 🔄 REFRESH BUTTON
                    case refreshButtonId: {
                        try {
                            await updateAllEmbedFields(embed, serverDetails, serverResourceUsage, logBuffer);
                            await buttonInteraction.update({ embeds: [embed] });
                            liveUpdateInterval.refresh(); // reset interval timer
                        } catch (err) {
                            console.error("Error refreshing server info:", err);
                            return await buttonInteraction.reply({ content: "Failed to refresh server info.", ephemeral: true });
                        }
                        break;
                    }
                
                    default:
                        return buttonInteraction.reply({ content: "Unknown action.", ephemeral: true });
                }
            
            } catch (err) {
                console.error("Collector error:", err);
            }
        });

        activeSessions.set(interaction.user.id, { message: await interaction.fetchReply(), collector, interval: liveUpdateInterval });


        collector.on("end", (collected, reason) => {
            clearInterval(liveUpdateInterval);
            console.log("Collector ended because:", reason);

            // Close websocket safely
            try {
                if (ws && ws.readyState === WebSocket.OPEN) ws.close();
            } catch (err) {
                console.error("Failed closing websocket:", err);
            }
            const disabledRow1 = new ActionRowBuilder().addComponents(
                consoleLogButton.setDisabled(true),
                sftpInfoButton.setDisabled(true),
                panelLinkButton.setDisabled(false)
            );
            const disabledRow2 = new ActionRowBuilder().addComponents(
                stopServerButton.setDisabled(true),
                restartServerButton.setDisabled(true),
                refreshButton.setDisabled(true)
            );
            interaction.editReply({ content: "Session ended. Please run the command again or go to the web panel to manage your server.", components: [disabledRow1, disabledRow2] });
            
        });

    } catch (error) {
        console.error("Error fetching server details:", error);
        return interaction.editReply({
            content: "There was an unexpected error fetching server details. Please try again later.",
        });
    }
}

module.exports = { serverManageEmbed };

function updateEmbedField(embed, fieldName, newValue) {
    const fields = embed.data.fields.map(field => {
        if (field.name === fieldName) {
            return { name: field.name, value: newValue, inline: field.inline };
        }
        return field;
    });
    embed.setFields(fields);
}

async function updateAllEmbedFields(embed, serverDetails, serverResourceUsage, logBuffer) {
    updateEmbedField(embed, "Status", `\`\`\`${serverPowerEmoji(serverResourceUsage.current_state)}\`\`\`` ?? "N/A");
    updateEmbedField(embed, "CPU Usage", `\`\`\`${serverResourceUsage.resources.cpu_absolute.toFixed(2)}% / ${serverDetails.limits.cpu}%\`\`\``);
    updateEmbedField(embed, "Memory Usage", `\`\`\`${formatBytes(serverResourceUsage.resources.memory_bytes)} / ${formatMegabytes(serverDetails.limits.memory)}\`\`\``);
    updateEmbedField(embed, "Disk Usage", `\`\`\`${formatBytes(serverResourceUsage.resources.disk_bytes)} / ${formatMegabytes(serverDetails.limits.disk)}\`\`\``);
    updateEmbedField(embed, "Uptime", `\`\`\`${uptimeToString(serverResourceUsage.resources.uptime)}\`\`\``);
    //add recent logs
    updateEmbedField(embed, "Console", logBuffer.length === 0 ? "N/A" : `\`\`\`\n${embedConsoleStr(logBuffer)}\n\`\`\``);
    embed.setTimestamp();
}