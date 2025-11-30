    
    
    
const { EmbedBuilder } = require('discord.js');
const { pterodactyl } = require("../../config.json");
const { PteroClient } = require("../requests/clientApiReq");

async function listServers(interaction, clientApiKey) {
    try {
		const servers = await PteroClient.request('', clientApiKey) || { data: [] }; 
    	if (servers.length === 0) {
    		return interaction.reply({
    			content: "You have no servers associated with your account.",
    			ephemeral: true,
    		});
    	} else {
    		//sort the servers by name
    		servers.data.sort((a, b) => {
    			if (a.attributes.name.toLowerCase() < b.attributes.name.toLowerCase()) return -1;
    			if (a.attributes.name.toLowerCase() > b.attributes.name.toLowerCase()) return 1;
    			return 0;
    		});
    		const embed = new EmbedBuilder()
    			.setTitle('Your Servers')
    			.setColor(0x00AE86) // nice teal color
    			.setDescription(
    			    servers.data
    			        .map(s => `[**${s.attributes.name}**](${pterodactyl.domain}/server/${s.attributes.identifier}) (ID: ${s.attributes.identifier})`)
    			        .join("\n")
    			)
    			.setTimestamp()
    			.setFooter({ text: 'Pterodactyl Bot' });
            
    		await interaction.reply({ embeds: [embed], flags: 64 }); // ephemeral
    	}
    } catch (error) {
    	console.error("Error fetching servers:", error);
    	let message = `An error occurred while fetching your servers: ${PteroClient.getErrorMessage(error)}`;
    	
    	return interaction.reply({
    	    content: message,
    	    flags: 64, // ephemeral
    	});
    }
}
module.exports = { listServers };