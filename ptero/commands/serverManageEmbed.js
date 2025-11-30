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
        let currentLogMessage = null;
        //This is the main websocket handler, this avoids rate limits on the pterodactyl side so discord is our only bottleneck
        ws.on("message", (data) => {
            try {
                const payload = JSON.parse(data.toString());
                if (payload.event === "auth success") {
                    ws.send(JSON.stringify({ event: "send logs", args: [null] })); //this tells the websocket to send previous logs (the amount (lines) is determined by wings config i do believe)
                } else if (payload.event === "console output" || payload.event === "install output") { //sent any time there is new console output
                    logBuffer += payload.args[0] + "\n";
                    if (logBuffer.length > 2048) {
                        logBuffer = logBuffer.slice(-2048); //really only need the last 2048 characters of logs
                    }
                }else if (payload.event === "status") { //sent when server status changes
                    const status = payload.args[0];
                    serverResourceUsage.current_state = status;
                    logBuffer += `\u001b[0;33mcontainer@pterodactyl~\u001b[0;0m Server marked as: ${status}\n`;
                    if (logBuffer.length > 2048) {
                        logBuffer = logBuffer.slice(-2048);
                    }
                    
                } else if (payload.event === "stats") { //normally this is sent once every second unless the server is off then its only sent once upon auth success until the server is started
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

        ws.on("close", (code, reason) => {
            //console.log(`WebSocket connection closed. Code: ${code}, Reason: ${reason.toString()}`);
            if (code === 1006) {
                interaction.followUp({ content: `WebSocket connection was closed abnormally. The server may be offline or there was a network issue.`, ephemeral: true });
                serverResourceUsage.current_state = "offline";
            } else if (code !== 1000) {
                interaction.followUp({ content: `WebSocket connection was unexpectedly closed (Code: ${code}). The server may be offline or there was a network issue.`, ephemeral: true });
                serverResourceUsage.current_state = "offline";
            }
        });
        ws.on("error", (err) => console.error("WebSocket error:", err));


        // Create server embed
        const embed = new EmbedBuilder() //make getter function later for easier editing??
            .setTitle(`Manage Server: ${serverDetails.name}`)
            .setColor(0x00AE86)
            //show expiry (2minutes from expireStamp)
            .setDescription(`**Server ID:** \`${serverDetails.identifier}\`\n** Session expires:** <t:${Math.floor(Math.floor(Date.now() / 1000) + Number(pterodactyl.SERVER_MANAGER_TIMEOUT))}:R>`)
            .addFields(
                { name: "Address", value: `\`\`\`${defaultAllocation.attributes.ip_alias}:${defaultAllocation.attributes.port}\`\`\``, inline: false },

                { name: "Status", value: `\`\`\`${serverPowerEmoji(serverPowerState)}\`\`\`` ?? "N/A", inline: true },
                { name: "CPU Usage", value: `\`\`\`${serverResourceUsage.resources.cpu_absolute.toFixed(2)}% / ${serverDetails.limits.cpu}%\`\`\``, inline: true },
                { name: "Memory Usage", value: `\`\`\`${formatBytes(serverResourceUsage.resources.memory_bytes)} / ${formatMegabytes(serverDetails.limits.memory)}\`\`\``, inline: true },

                { name: "Disk Usage", value: `\`\`\`${formatBytes(serverResourceUsage.resources.disk_bytes)} / ${formatMegabytes(serverDetails.limits.disk)}\`\`\``, inline: true },
                { name: "Uptime", value: `\`\`\`${uptimeToString(serverResourceUsage.resources.uptime)}\`\`\``, inline: true },

                //last three lines of logs
                { name: "Console", value: logBuffer.length === 0 ? "\`\`\`Loading...\`\`\`" : `\`\`\`${embedConsoleStr(stripAnsi(logBuffer), 3, 512)}\n\`\`\``, inline: false }, //limit to last 3 lines or 512 characters (half of discord embed limit)

                //network usage
                { name: "Network Up", value: `> 📤  ${formatBytes(serverResourceUsage.resources.network_tx_bytes)}`, inline: true },
                { name: "Network Down", value: `> 📥  ${formatBytes(serverResourceUsage.resources.network_rx_bytes)}`, inline: true },
                

            )
            .setTimestamp()
            .setFooter({ text: `${pterodactyl.EMBED_FOOTER_TEXT}`, iconURL: `${pterodactyl.EMBED_FOOTER_ICON_URL}` });

        const buttons = [];
        const restartServerButtonId = `restart_server_${interaction.user.id}_${serverId}`;
        const restartServerButton = new ButtonBuilder()
            .setLabel('Start / Restart 🔄')
            .setStyle(ButtonStyle.Success)
            .setCustomId(restartServerButtonId);
        buttons.push(restartServerButton);

        const stopServerButtonId = `stop_server_${interaction.user.id}_${serverId}`;
        const stopServerButton = new ButtonBuilder()
            .setLabel('Stop ⏹️')
            .setStyle(ButtonStyle.Danger)
            .setCustomId(stopServerButtonId);
        buttons.push(stopServerButton);

        const killServerButtonId = `kill_server_${interaction.user.id}_${serverId}`;
        const killServerButton = new ButtonBuilder()
            .setLabel('Kill ❌')
            .setStyle(ButtonStyle.Danger)
            .setCustomId(killServerButtonId)
            .setDisabled(true);
        buttons.push(killServerButton);

        const refreshButtonId = `refresh_${interaction.user.id}_${serverId}`;
        const refreshButton = new ButtonBuilder()
            .setCustomId(refreshButtonId)
            .setLabel("Refresh Info 🔃")
            .setStyle(ButtonStyle.Secondary);
        buttons.push(refreshButton);

        const sendCommandButtonId = `send_command_${interaction.user.id}_${serverId}`;
        const sendCommandButton = new ButtonBuilder()
            .setLabel('Send Command 🖥️')
            .setStyle(ButtonStyle.Primary)
            .setCustomId(sendCommandButtonId);
        buttons.push(sendCommandButton);

        const panelLinkButton = new ButtonBuilder()
            .setLabel('View on Panel 🌐')
            .setStyle(ButtonStyle.Link)
            .setURL(`${pterodactyl.domain}/server/${serverId}`);
        buttons.push(panelLinkButton);

        const sftpInfoButtonId = `get_sftp_info_${interaction.user.id}_${serverId}`;
        const sftpInfoButton = new ButtonBuilder()
            .setCustomId(sftpInfoButtonId)
            .setLabel('SFTP Info 🔑')
            .setStyle(ButtonStyle.Secondary);
        buttons.push(sftpInfoButton);

        const logsButtonId = `get_console_logs_${interaction.user.id}_${serverId}`;
        const consoleLogButton = new ButtonBuilder()
            .setCustomId(logsButtonId)
            .setLabel('Logs 📋')
            .setStyle(ButtonStyle.Primary);
        buttons.push(consoleLogButton);

        const endSessionButtonId = `end_session_${interaction.user.id}_${serverId}`;
        const endSessionButton = new ButtonBuilder()
            .setLabel('End Session 🚫')
            .setStyle(ButtonStyle.Secondary)
            .setCustomId(endSessionButtonId)
        buttons.push(endSessionButton);


        const initialButtonRows = handleButtonToggle(buttons, serverResourceUsage.current_state);
        await interaction.editReply({ embeds: [embed], components: initialButtonRows });

        // Set up live update interval
        let lastSentLogs = "";
        let liveUpdateInterval = setInterval(async () => {
            if (!ws || ws.readyState !== WebSocket.OPEN) {
                serverResourceUsage.current_state = "unknown";
                collector.stop("websocket_closed");
            }

            try {
                
                await updateAllEmbedFields(embed, serverDetails, serverResourceUsage, logBuffer);
                const newActionRows = handleButtonToggle(buttons, serverResourceUsage.current_state);
                await interaction.editReply({ embeds: [embed] , components: newActionRows });

                if (currentLogMessage && !currentLogMessage.deleted) {
                    const isDeleted = await currentLogMessage.fetch().then(() => false).catch(() => true);
                    if (isDeleted) {
                        currentLogMessage = null;
                    } else {
                        const logsToSend = logBuffer.length === 0
                            ? "No logs available."
                            : `\`\`\`ansi\n${logBuffer.slice(-1900)}\n\`\`\``; //we can actually use ansi when updating here since it doesnt glitch on updates like embeds do
                        if (logsToSend !== lastSentLogs) {
                            lastSentLogs = logsToSend;
                            await currentLogMessage.edit({ content: logsToSend });
                        }
                    }
                } else {
                    currentLogMessage = null;
                }

            } catch (err) {
                //this is some AI shit i have no idea if it works lol
                if (err.code === 50013 || err.status === 429) {
                    // Rate limited or missing permissions
                    console.warn(`⚠️ Discord rate limit hit, increasing update interval on server manager for server: ${serverId}`)
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
            idle: pterodactyl.SERVER_MANAGER_TIMEOUT * 1000 || 2 * 60 * 1000, //default to 2 minutes if not set
        });

        const cooldowns = new Map(); // userId -> timestamp

        collector.on("collect", async (buttonInteraction) => {
            try {
                const expireEpochSeconds = Math.floor((Date.now() / 1000) + Number(pterodactyl.SERVER_MANAGER_TIMEOUT));
                embed.setDescription(`**Server ID:** \`${serverDetails.identifier}\`\n** Session expires:** <t:${expireEpochSeconds}:R>`);

                // --------------------
                // COOLDOWN (only for logs)
                // --------------------
                if (buttonInteraction.customId === logsButtonId) {
                    const now = Date.now();
                    if (cooldowns.has(buttonInteraction.user.id) && now < cooldowns.get(buttonInteraction.user.id)) {
                        const remaining = Math.ceil((cooldowns.get(buttonInteraction.user.id) - now)/1000);
                        return await buttonInteraction.reply({
                            content: `Please wait ${remaining}s before requesting full logs again.`,
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
                            : `\`\`\`ansi\n${logBuffer.slice(-1900)}\n\`\`\``;
                        currentLogMessage = await buttonInteraction.reply({ content: logsToSend, ephemeral: true });
                        lastSentLogs = logsToSend;
                        return 
                    }
                
                    // 🔑 SFTP INFO BUTTON
                    case sftpInfoButtonId: {
                        const sftpInfoEmbed = new EmbedBuilder()
                            .setTitle(`SFTP for ${serverDetails.name}`)
                            .setColor(0x00AE86)
                            .setDescription("Use the following details to connect to your server via SFTP.")
                            .addFields(
                                { name: "Host", value: `> ${serverDetails.sftp_details.ip}`, inline: true },
                                { name: "Port", value: `> ${serverDetails.sftp_details.port}`, inline: true },
                                { name: "Username", value: `> ||${userInfo.username}.${serverId}||`, inline: false },
                                { name: "Password", value: `> (Your account password for ${pterodactyl.domain})`, inline: false },
                            )
                            .setTimestamp()
                            .setFooter({ text: `${pterodactyl.EMBED_FOOTER_TEXT}`, iconURL: `${pterodactyl.EMBED_FOOTER_ICON_URL}` });
                        return buttonInteraction.reply({embeds: [sftpInfoEmbed], ephemeral: true});
                    }

                    // 🔄 RESTART SERVER BUTTON
                    case restartServerButtonId: {
                        try {
                            const startType = serverResourceUsage.current_state === "running" ? "restarting" : "starting";
                            const success = await pteroClient.restartServer(serverId);
                            updateEmbedField(embed, "Status", `\`\`\`${serverPowerEmoji(serverResourceUsage.current_state)}\`\`\`` ?? "N/A");
                            if (success) {
                                return await buttonInteraction.reply({ content: `Server is ${startType}...`, ephemeral: true });
                            } else {
                                return await buttonInteraction.reply({ content: "Failed to restart the server.", ephemeral: true });
                            }
                        } catch (err) {
                            //if 403 error, insufficient permissions
                            if (err === 403) {
                                return await buttonInteraction.reply({ content: "You do not have permission to restart this server.", ephemeral: true });
                            } else if (err === 504) {
                                return await buttonInteraction.reply({ content: "The server is currently unreachable (504 Gateway Timeout). Please try again later.", ephemeral: true });
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
                            } else if (err === 504) {
                                return await buttonInteraction.reply({ content: "The server is currently unreachable (504 Gateway Timeout). Please try again later.", ephemeral: true });
                            }
                            console.error("Error stopping server:", err);
                            return await buttonInteraction.reply({ content: "An unknown error occurred while stopping the server.", ephemeral: true });
                        }
                    }

                    // ❌ KILL SERVER BUTTON
                    case killServerButtonId: {
                        try {
                            const success = await pteroClient.killServer(serverId);
                            updateEmbedField(embed, "Status", `\`\`\`${serverPowerEmoji(serverResourceUsage.current_state)}\`\`\`` ?? "N/A");
                            if (success) {
                                return await buttonInteraction.reply({ content: "Server killed...", ephemeral: true });
                            } else {
                                return await buttonInteraction.reply({ content: "Failed to kill the server.", ephemeral: true });
                            }
                        } catch (err) {
                            //if 403 error, insufficient permissions
                            if (err === 403) {
                                return await buttonInteraction.reply({ content: "You do not have permission to kill this server.", ephemeral: true });
                            } else if (err === 504) {
                                return await buttonInteraction.reply({ content: "The server is currently unreachable (504 Gateway Timeout). Please try again later.", ephemeral: true });
                            }
                            console.error("Error killing server:", err);
                            return await buttonInteraction.reply({ content: "An unknown error occurred while killing the server.", ephemeral: true });
                        }
                    }

                    // 🔄 REFRESH BUTTON
                    case refreshButtonId: {
                        try {

                            //make sure websocket is still open otherwise consider the server offline
                            if (!ws || ws.readyState !== WebSocket.OPEN) {
                                serverResourceUsage.current_state = "unknown";
                            }

                            await updateAllEmbedFields(embed, serverDetails, serverResourceUsage, logBuffer);
                            const newActionRows = handleButtonToggle(buttons, serverResourceUsage.current_state);
                            await buttonInteraction.update({ embeds: [embed] , components: newActionRows });
                            liveUpdateInterval.refresh(); // reset interval timer
                        } catch (err) {
                            console.error("Error refreshing server info:", err);
                            return await buttonInteraction.reply({ content: "Failed to refresh server info.", ephemeral: true });
                        }
                        break;
                    }

                    // 🖥️ SEND COMMAND BUTTON
                    case sendCommandButtonId: {
                        try {
                            const modal = await createCommandModal(interaction.user.id, serverId);
                            await buttonInteraction.showModal(modal);
                            
                        } catch (err) {
                            console.error("Error showing command modal:", err);
                            return await buttonInteraction.reply({ content: "Failed to open command modal.", ephemeral: true });
                        }
                        break;
                    }

                    // 🚫 END SESSION BUTTON
                    case endSessionButtonId: {
                        buttonInteraction.reply({ content: "Ending session...", ephemeral: true });
                        embed.setDescription(`**Server ID:** \`${serverDetails.identifier}\`\n** Session ended by user: <t:${Math.floor(Date.now() / 1000)}:R>**`);
                        collector.stop("user_ended");
                        return;
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
            //console.log("Collector ended because:", reason);

            // Close websocket safely
            try {
                if (ws && ws.readyState === WebSocket.OPEN) ws.close(1000, "Session ended");;
            } catch (err) {
                console.error("Failed closing websocket:", err);
            }

            //delete log message if exists
            if (currentLogMessage && !currentLogMessage.deleted) {
                currentLogMessage.delete().catch(() => { });
            }


            // Disable buttons (all but links get disabled)
            const disabledButtonRows = handleButtonToggle(buttons, serverResourceUsage.current_state, true);
            embed.setDescription(`**Server ID:** \`${serverDetails.identifier}\`\n** Session ended:** <t:${Math.floor(Date.now() / 1000)}:R>`);
            interaction.editReply({ content: "Session ended. Please run the command again or go to the web panel to manage your server.", components: disabledButtonRows, embeds: [embed] });
            activeSessions.delete(interaction.user.id);


        });

    } catch (error) {
        if (error == 504) {
            return interaction.editReply({
                content: "The Wings node for this server is currently unreachable (504 Gateway Timeout). Please try again later or contact your server provider.",
            });
        }
        console.error("Error fetching server details for server manage embed:", getErrorMessage(error));
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
    updateEmbedField(embed, "CPU Usage", `\`\`\`${serverResourceUsage.resources.cpu_absolute.toFixed(2)}% / ${serverDetails.limits.cpu}%\`\`\``);
    updateEmbedField(embed, "Memory Usage", `\`\`\`${formatBytes(serverResourceUsage.resources.memory_bytes)} / ${formatMegabytes(serverDetails.limits.memory)}\`\`\``);
    updateEmbedField(embed, "Disk Usage", `\`\`\`${formatBytes(serverResourceUsage.resources.disk_bytes)} / ${formatMegabytes(serverDetails.limits.disk)}\`\`\``);
    updateEmbedField(embed, "Uptime", `\`\`\`${uptimeToString(serverResourceUsage.resources.uptime)}\`\`\``);
    updateEmbedField(embed, "Network Up", `> 📤  ${formatBytes(serverResourceUsage.resources.network_tx_bytes)}`);
    updateEmbedField(embed, "Network Down", `> 📥  ${formatBytes(serverResourceUsage.resources.network_rx_bytes)}`);
    //add recent logs
    updateEmbedField(embed, "Console", logBuffer.length === 0 ? "\`\`\`N/A\`\`\`" : `\`\`\`${embedConsoleStr(stripAnsi(logBuffer), 3, 512)}\`\`\``);
    embed.setTimestamp();
}

async function createCommandModal(userId, serverId) {
    const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require("discord.js");
    const modal = new ModalBuilder()
        .setCustomId(`send_command_modal_${userId}_${serverId}`)
        .setTitle('Send Command to Server');
    const commandInput = new TextInputBuilder()
        .setCustomId('command_input')
        .setLabel("Command")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("Enter the command to send to the server")
        .setRequired(true)
        .setMaxLength(128);
    const firstActionRow = new ActionRowBuilder().addComponents(commandInput);
    modal.addComponents(firstActionRow);
    return modal;
}

function handleButtonToggle(buttons, serverStatus, disableAll) {
    if (disableAll) {
        //disable all buttons except panel link
        buttons.forEach(button => {
            if (button.data.style === ButtonStyle.Link) { //dont disable links by default since they should always be usable
                button.setDisabled(false);
            } else {
                button.setDisabled(true);
            }
        });

    } else {
        //enable/disable certain buttons based on server status
        buttons.forEach(button => {
            if (button.data.custom_id?.startsWith("restart_server_")) {
                button.setDisabled(serverStatus === "starting" || serverStatus === "stopping");
                if (serverStatus === "running") {
                    button.setLabel("Restart 🔄");
                } else {
                    button.setLabel("Start ▶️");
                }
            } else if (button.data.custom_id?.startsWith("stop_server_")) {
                button.setDisabled(serverStatus !== "running");
            } else if (button.data.custom_id?.startsWith("kill_server_")) { //only if status is stopping
                button.setDisabled(serverStatus !== "stopping");
            } else if (button.data.custom_id?.startsWith("send_command_")) {
                button.setDisabled(serverStatus !== "running");
            }
        });
    }
    //return new action rows
    const actionRow1 = new ActionRowBuilder().addComponents(buttons.slice(0, 4));
    const actionRow2 = new ActionRowBuilder().addComponents(buttons.slice(4, 6));
    const actionRow3 = new ActionRowBuilder().addComponents(buttons.slice(6, 9));
    return [actionRow1, actionRow2, actionRow3];
}
