const { owner } = require("../../../config.json");
const { loadApiKey } = require("../../../ptero/keys");
const { PteroClient } = require("../../../ptero/requests/clientApiReq");
const { PteroApp } = require("../../../ptero/requests/appApiReq");

module.exports = {
    name: "pt",

    async execute(interaction) {
        if (!interaction.isAutocomplete()) return;

        const focused = interaction.options.getFocused(true);
        const sub = interaction.options.getSubcommand();

        if (sub === "manage") {

            const clientApiKey = await loadApiKey(interaction.user.id);
            if (!clientApiKey) return interaction.respond([]);

            const serversResponse = await PteroClient.request('', clientApiKey).catch(() => null);
            if (!serversResponse || !serversResponse.data) return interaction.respond([]);

            const servers = serversResponse.data;

            const filtered = servers
                .filter(s => s.attributes.name.toLowerCase().includes(focused.value.toLowerCase()))
                .map(s => ({
                    name: s.attributes.name,
                    value: s.attributes.identifier
                }));

            return interaction.respond(filtered);
        } else if (sub === "server-embed") {

           const clientApiKey = await loadApiKey(interaction.user.id);
            if (!clientApiKey) return interaction.respond([]);

            const serversResponse = await PteroClient.request('', clientApiKey).catch(() => null);
            if (!serversResponse || !serversResponse.data) return interaction.respond([]);

            const servers = serversResponse.data;

            const filtered = servers
                .filter(s => s.attributes.name.toLowerCase().includes(focused.value.toLowerCase()))
                .map(s => ({
                    name: s.attributes.name,
                    value: s.attributes.identifier
                }));

            return interaction.respond(filtered);
        } else if (sub === "node-embed") {
            //if not owner return empty
            if (interaction.user.id !== owner) return interaction.respond([]);

            const nodes = await PteroApp.request('nodes').catch(() => null);
            if (!nodes || !nodes.data) return interaction.respond([]);

            const filtered = nodes.data
                .filter(n => n.attributes.name.toLowerCase().includes(focused.value.toLowerCase()))
                .map(n => ({
                    name: n.attributes.name,
                    value: n.attributes.id.toString()
                }));

            return interaction.respond(filtered);
        }
    }
};
