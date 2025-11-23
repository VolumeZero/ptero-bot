const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { listServers } = require("../../../ptero/commands/listServers");
const { saveApiKey, loadApiKey } = require("../../../ptero/keys");
const { serverManageEmbed } = require("../../../ptero/commands/serverManageEmbed");
const { sendServerStatusEmbed } = require("../../../ptero/commands/serverStatusEmbed");
const { sendNodeStatusEmbed } = require("../../../ptero/commands/nodeStatusEmbed");
const { isClientKeyValid, isApplicationKeyValid } = require("../../../ptero/utils/serverUtils");
const { pterodactyl } = require("../../../config.json");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("pt")
        .setDescription("Pterodactyl commands")
        .addSubcommand(sub =>
            sub
                .setName("list")
                .setDescription("List all servers associated with your Pterodactyl account.")
        )
        .addSubcommand(sub =>
            sub
                .setName("account")
                .setDescription("View your Pterodactyl account details.")
        )
        .addSubcommand(sub =>
            sub
                .setName("key")
                .setDescription("Save your Pterodactyl API Key. (This is required to use other commands.)")
                .addStringOption(option =>
                    option
                        .setName("api_key")
                        .setDescription(`Your Pterodactyl API Key. (Can be created at ${pterodactyl.domain}/account/api)`)
                        .setRequired(true)
                        .setMaxLength(48)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName("manage")
                .setDescription("Swiftly manage your Pterodactyl servers.")
                .addStringOption(option =>
                    option
                        .setName("server_name") //value is actually the short server ID used in Pterodactyl URLs
                        .setDescription("The name of the server you want to manage.")
                        .setRequired(true)
                        .setAutocomplete(true)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName("server-embed")
                .setDescription("Send a live updating server status embed to the current channel.")
                .addStringOption(option =>
                    option
                        .setName("server_name")
                        .setDescription("The name of the server you want the embed to use.")
                        .setRequired(true)
                        .setAutocomplete(true)
                )
                .addStringOption(option =>
                    option
                        .setName("icon_url")
                        .setDescription("Optional URL for a custom icon to use in the embed.")
                        .setRequired(false)
                )
                .addBooleanOption(option =>
                    option
                        .setName("enable_logs")
                        .setDescription("Enable console logs in the embed if available.")
                        .setRequired(false)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName("node-embed")
                .setDescription("Send a live updating node status embed to the current channel.")
                .addStringOption(option =>
                    option
                        .setName("node_name")
                        .setDescription("The name of the node you want the embed to use.")
                        .setRequired(true)
                        .setAutocomplete(true)
                )
        ),

    async execute(interaction) {
		const subcommand = interaction.options.getSubcommand();
		const clientApiKey = await loadApiKey(interaction.user.id);
		
        if (subcommand === "list") {
            if (!clientApiKey) {
    	    	return interaction.reply({
    	    		content: "You have not set your API key yet. Please use `/pt key` to set it.",
    	    		ephemeral: true,
    	    	});
    	    }

			try {
				await listServers(interaction, clientApiKey);
			} catch (error) {
				console.error("Error in listServers command:", error);
				return interaction.reply({
					content: "An unexpected error occurred while fetching your servers.",
					ephemeral: true,
				});
			}

        } else if (subcommand === "key") {
            const apiKey = interaction.options.getString("api_key");
            interaction.deferReply({ ephemeral: true });
            const isKeyValid = await isClientKeyValid(apiKey);
            if (!isKeyValid) {
                if (apiKey === pterodactyl.apiKey) {
                    return interaction.reply({
                        content: `You cannot use the bot's API key as your personal key. Please generate your own API key from your Pterodactyl account at ${pterodactyl.domain}/account/api.`,
                        ephemeral: true,
                    });
                } else if (apiKey.startsWith('ptla_')) {
                    return interaction.reply({
                        content: "Application API keys are not supported. Please use a client API key generated from your Pterodactyl account.",
                        ephemeral: true,
                    });
                }

                return interaction.reply({
                    content: "The provided API key is invalid. Please double-check and try again.",
                    ephemeral: true,
                });
            }

            await saveApiKey(interaction.user.id, apiKey);
            return interaction.reply({
                content: "Your API key has been saved!",
                ephemeral: true,
            });

        } else if (subcommand === "manage") {
            const serverId = interaction.options.getString("server_name");
            if (!clientApiKey) {
    	    	return interaction.reply({
    	    		content: "You have not set your API key yet. Please use `/pt key` to set it.",
    	    		ephemeral: true,
    	    	});
    	    } else if (!await isClientKeyValid(clientApiKey)) {
                return interaction.reply({
                    content: "Your saved API key is no longer valid. Please update it using `/pt key`.",
                    ephemeral: true,
                });
            }

            try {
                await serverManageEmbed(interaction, serverId);
            } catch (error) {
                console.error("Error in manage command:", error);
                return interaction.followUp({
                    content: "An unexpected error occurred while trying to manage your server.",
                    ephemeral: true,
                });
            }

        } else if (subcommand === "server-embed") {
            const serverId = interaction.options.getString("server_name");
            if (!clientApiKey) {
    	    	return interaction.reply({
    	    		content: "You have not set your API key yet. Please use `/pt key` to set it.",
    	    		ephemeral: true,
    	    	});
    	    }

            if (!interaction.user.id === require("../../../config.json").owner) {
                return interaction.reply({
                    content: "Only the bot owner can use this command.",
                    ephemeral: true,
                });
            } 

            try {
                const iconUrl = interaction.options.getString("icon_url");
                const enableLogs = interaction.options.getBoolean("enable_logs") || false;
                await sendServerStatusEmbed(interaction, serverId, iconUrl, enableLogs); //will be bot owner only and use application api
            } catch (error) {
                console.error("Error in server-embed command:", error);
                return interaction.followUp({
                    content: "An unexpected error occurred while trying to send the server embed.",
                    ephemeral: true,
                });
            }
            
        } else if (subcommand === "node-embed") {

            const nodeId = interaction.options.getString("node_name");
            if (!clientApiKey) {
    	        return interaction.reply({
    	        	content: "You have not set your API key yet. Please use `/pt key` to set it.",
    	        	ephemeral: true,
    	        });
    	    }

            if (!interaction.user.id === require("../../../config.json").owner) {
                return interaction.reply({
                    content: "Only the bot owner can use this command.",
                    ephemeral: true,
                });
            }
            const appKeyVaild = await isApplicationKeyValid(pterodactyl.apiKey);
            if (!appKeyVaild) {
                return interaction.reply({
                    content: "The bot's application API key is invalid.",
                    ephemeral: true,
                });
            }

            try {
                await sendNodeStatusEmbed(interaction, nodeId); //will be bot owner only and use application api
            } catch (error) {
                console.error("Error in node-embed command:", error);
                return interaction.followUp({
                    content: "An unexpected error occurred while trying to send the node embed.",
                    ephemeral: true,
                });
            }

        } else if (subcommand === "account") {
            if (!clientApiKey) {
    	        return interaction.reply({
    	        	content: "You have not set your API key yet. Please use `/pt key` to set it.",
    	        	ephemeral: true,
    	        });
    	    } 

            try {
                const { createAccountDetailsEmbed } = require("../../../ptero/utils/embeds");
                const accountEmbedData = await createAccountDetailsEmbed(interaction.user.id, clientApiKey);
                return interaction.reply({
                    embeds: [accountEmbedData.embed],
                    components: accountEmbedData.components,
                    ephemeral: true,
                });
            } catch (error) {
                console.error("Error in account command:", error);
                return interaction.reply({
                    content: "An unexpected error occurred while fetching your account details.",
                    ephemeral: true,
                });
            }

        } else {
            return interaction.reply({
                content: "Unknown subcommand.",
                ephemeral: true,
            });
        }
    },
};
