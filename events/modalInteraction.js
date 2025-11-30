/**
 * @file Modal Interaction Handler
 * @author Naman Vrati
 * @since 3.2.0
 * @version 3.3.0
 */

const { InteractionType } = require("discord-api-types/v10");
const { loadApiKey } = require("../ptero/keys");
const { pterodactyl } = require("../config.json");
const { PteroClient } = require("../ptero/requests/clientApiReq");

module.exports = {
	name: "interactionCreate",

	/**
	 * @description Executes when an interaction is created and handle it.
	 * @author Naman Vrati
	 * @param {import('discord.js').Interaction & { client: import('../typings').Client }} interaction The interaction which was created
	 */

	async execute(interaction) {
		// Deconstructed client from interaction object.
		const { client } = interaction;
	    const id = interaction.customId;

		// Checks if the interaction is a modal interaction (to prevent weird bugs)

		if (interaction.type !== InteractionType.ModalSubmit) return;
		
			
		if (id.startsWith("send_command_modal_")) {
			
			const parts = id.split("_");
			const userId = parts[3]; // send_command_modal_userId_serverId
			const serverId = parts[4];
			
	    	// EXTRA SAFETY: ensure the modal belongs to same user
	    	if (interaction.user.id !== userId) {
	    	    return interaction.reply({ 
	    	        content: "This modal isn't for you.", 
	    	        ephemeral: true 
	    	    });
	    	}

	    	const command = interaction.fields.getTextInputValue("command_input");

	    	try {
				const apiKey = await loadApiKey(interaction.user.id);
	    	    await PteroClient.request(`servers/${serverId}/command`, apiKey, 'post', {
	    	        command: command
	    	    });
	    	    await interaction.reply({
	    	        content: `Command \`${command}\` sent to server. Check the console for more details.`,
	    	        ephemeral: true
	    	    });
	    	} catch (err) {
				if (pterodactyl.ERROR_LOGGING_ENABLED) {
					console.error(`Error sending command to server ID ${serverId}:`, err);
				}
	    	    await interaction.reply({
	    	        content: `Failed to send command: \`${PteroClient.getErrorMessage(err)}\``,
	    	        ephemeral: true
	    	    });
			
	    	}
		} 


		const command = client.modalCommands.get(interaction.customId);

		// If the interaction is not a command in cache, return error message.
		// You can modify the error message at ./messages/defaultModalError.js file!

		if (!command) {
			await require("../messages/defaultModalError").execute(interaction);
			return;
		}

		// A try to execute the interaction.

		try {
			await command.execute(interaction);
			return;
		} catch (err) {
			console.error(err);
			await interaction.reply({
				content: "There was an issue while understanding this modal!",
				ephemeral: true,
			});
			return;
		}
	},
};
