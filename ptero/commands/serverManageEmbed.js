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

        let logBuffer = "";

        ws.on("open", () => {
            ws.send(JSON.stringify({ event: "auth", args: [wsData.token] }));
        });

        ws.on("message", (data) => {
            try {
                const payload = JSON.parse(data.toString());
                if (payload.event === "auth success") {
                    ws.send(JSON.stringify({ event: "send logs", args: [null] }));
                } else if (payload.event === "console output") {
                    logBuffer += stripAnsi(payload.args.join(" ")) + "\n";
                    if (logBuffer.length > 10000) {
                        logBuffer = logBuffer.slice(-8000); // keep last 8000 chars
                    }
                } else if (payload.event === "stats") {
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
        const embed = new EmbedBuilder()
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
                { name: "Console", value: logBuffer.length === 0 ? "Loading..." : `\`\`\`\n${embedConsoleStr(logBuffer, 3, 1024)}\n\`\`\``, inline: false },
                

            )
            .setTimestamp()
            .setFooter({ text: 'Powered by Pterodactyl', iconURL: 'https://p7.hiclipart.com/preview/978/71/779/pterodactyls-pteranodon-minecraft-pterosaurs-computer-servers-minecraft.jpg' });

        const buttonId = `get_console_logs_${interaction.user.id}_${serverId}`;
        const consoleLogButton = new ButtonBuilder()
            .setCustomId(buttonId)
            .setLabel('Logs 📋')
            .setStyle(ButtonStyle.Primary);
        const sftpInfoButtonId = `get_sftp_info_${interaction.user.id}_${serverId}`;
        const sftpInfoButton = new ButtonBuilder()
            .setCustomId(sftpInfoButtonId)
            .setLabel('SFTP Info 🔑')
            .setStyle(ButtonStyle.Secondary)
        const panelLinkButton = new ButtonBuilder()
            .setLabel('View on Panel 🌐')
            .setStyle(ButtonStyle.Link)
            .setURL(`${pterodactyl.domain}/server/${serverId}`);
        const stopServerButtonId = `stop_server_${interaction.user.id}_${serverId}`;
        const stopServerButton = new ButtonBuilder()
            .setLabel('Stop Server ⏹️')
            .setStyle(ButtonStyle.Danger)
            .setCustomId(stopServerButtonId);
        const restartServerButtonId = `restart_server_${interaction.user.id}_${serverId}`;
        const restartServerButton = new ButtonBuilder()
            .setLabel('Restart Server 🔄')
            .setStyle(ButtonStyle.Success)
            .setCustomId(restartServerButtonId);
        const refreshButtonId = `refresh_${interaction.user.id}_${serverId}`;
        const refreshButton = new ButtonBuilder()
            .setCustomId(refreshButtonId)
            .setLabel("Refresh Info 🔄")
            .setStyle(ButtonStyle.Secondary);
        const actionRow1 = new ActionRowBuilder().addComponents(consoleLogButton, sftpInfoButton, panelLinkButton);
        const actionRow2 = new ActionRowBuilder().addComponents(stopServerButton, restartServerButton, refreshButton);

        await interaction.editReply({ embeds: [embed], components: [actionRow1, actionRow2] });

        let liveUpdateInterval = setInterval(async () => {
            if (!ws || ws.readyState !== WebSocket.OPEN) return;

            try {
                updateEmbedField(embed, "Status", `\`\`\`${serverPowerEmoji(serverResourceUsage.current_state)}\`\`\`` ?? "N/A");
                updateEmbedField(embed, "CPU Usage", `\`\`\`${serverResourceUsage.resources.cpu_absolute.toFixed(2)}% / ${serverDetails.limits.cpu}%\`\`\``);
                updateEmbedField(embed, "Memory Usage", `\`\`\`${formatBytes(serverResourceUsage.resources.memory_bytes)} / ${formatMegabytes(serverDetails.limits.memory)}\`\`\``);
                updateEmbedField(embed, "Disk Usage", `\`\`\`${formatBytes(serverResourceUsage.resources.disk_bytes)} / ${formatMegabytes(serverDetails.limits.disk)}\`\`\``);
                updateEmbedField(embed, "Uptime", `\`\`\`${uptimeToString(serverResourceUsage.resources.uptime)}\`\`\``);
                //add recent logs
                updateEmbedField(embed, "Console", logBuffer.length === 0 ? "N/A..." : `\`\`\`\n${embedConsoleStr(logBuffer)}\n\`\`\``);
                embed.setTimestamp();
            
                await interaction.editReply({ embeds: [embed] });
            } catch (err) {
                console.error("Failed to auto-update embed:", err);
            }
        }, 5000);


        // Collector for the unique button
        const collector = interaction.channel.createMessageComponentCollector({
            filter: i => i.user.id === interaction.user.id,  
            time: 15 * 60 * 1000,
            idle: 120_000            // ❗ 2 MINUTE INACTIVITY TIMEOUT
        });

        const cooldowns = new Map(); // userId -> timestamp

        collector.on("collect", async (i) => {
            try {
                // --------------------
                // COOLDOWN (only for logs)
                // --------------------
                if (i.customId === buttonId) {
                    const now = Date.now();
                    if (cooldowns.has(i.user.id) && now < cooldowns.get(i.user.id)) {
                        const remaining = Math.ceil((cooldowns.get(i.user.id) - now) / 1000);
                        return await i.reply({
                            content: `Please wait ${remaining}s before requesting logs again.`,
                            ephemeral: true
                        });
                    }
                    cooldowns.set(i.user.id, now + 10000); // 10s cooldown
                }
            
                // --------------------
                // ACTION HANDLER
                // --------------------
                switch (i.customId) {
                
                    // 📋 LOGS BUTTON
                    case buttonId: {
                        const logsToSend = logBuffer.length === 0
                            ? "No logs available."
                            : `\`\`\`\n${logBuffer.slice(-1990)}\n\`\`\``;
                    
                        return await i.reply({ content: logsToSend, ephemeral: true });
                    }
                
                    // 🔑 SFTP INFO BUTTON
                    case sftpInfoButtonId: {
                        return await i.reply({
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
                                return await i.reply({ content: "Server is restarting...", ephemeral: true });
                            } else {
                                return await i.reply({ content: "Failed to restart the server.", ephemeral: true });
                            }
                        } catch (err) {
                            //if 403 error, insufficient permissions
                            if (err === 403) {
                                return await i.reply({ content: "You do not have permission to restart this server.", ephemeral: true });
                            }
                            console.error("Error restarting server:", err);
                            return await i.reply({ content: "An unknown error occurred while restarting the server.", ephemeral: true });
                        }
                    }

                    // ⏹️ STOP SERVER BUTTON
                    case stopServerButtonId: {
                        try {
                            const success = await pteroClient.stopServer(serverId);
                            updateEmbedField(embed, "Status", `\`\`\`${serverPowerEmoji(serverResourceUsage.current_state)}\`\`\`` ?? "N/A");
                            if (success) {
                                return await i.reply({ content: "Server is stopping...", ephemeral: true });
                            } else {
                                return await i.reply({ content: "Failed to stop the server.", ephemeral: true });
                            }
                        } catch (err) {
                            //if 403 error, insufficient permissions
                            if (err === 403) {
                                return await i.reply({ content: "You do not have permission to stop this server.", ephemeral: true });
                            }
                            console.error("Error stopping server:", err);
                            return await i.reply({ content: "An unknown error occurred while stopping the server.", ephemeral: true });
                        }
                    }

                    // 🔄 REFRESH BUTTON
                    case refreshButtonId: {
                        try {
                            // Update embed fields
                            updateEmbedField(embed, "Status", `\`\`\`${serverPowerEmoji(serverResourceUsage.current_state)}\`\`\`` ?? "N/A");
                            updateEmbedField(embed, "CPU Usage", `\`\`\`${serverResourceUsage.resources.cpu_absolute.toFixed(2)}% / ${serverDetails.limits.cpu}%\`\`\``);
                            updateEmbedField(embed, "Memory Usage", `\`\`\`${formatBytes(serverResourceUsage.resources.memory_bytes)} / ${formatMegabytes(serverDetails.limits.memory)}\`\`\``);
                            updateEmbedField(embed, "Disk Usage", `\`\`\`${formatBytes(serverResourceUsage.resources.disk_bytes)} / ${formatMegabytes(serverDetails.limits.disk)}\`\`\``);
                            updateEmbedField(embed, "Uptime", `\`\`\`${uptimeToString(serverResourceUsage.resources.uptime)}\`\`\``);
                            updateEmbedField(embed, "Console", logBuffer.length === 0 ? "N/A..." : `\`\`\`\n${embedConsoleStr(logBuffer)}\n\`\`\``);
                            embed.setTimestamp();
                            // Edit the original reply
                            await i.update({ embeds: [embed] });
                            liveUpdateInterval.refresh(); // reset interval timer
                        } catch (err) {
                            console.error("Error refreshing server info:", err);
                            return await i.reply({ content: "Failed to refresh server info.", ephemeral: true });
                        }
                        break;
                    }
                
                    default:
                        return i.reply({ content: "Unknown action.", ephemeral: true });
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