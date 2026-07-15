const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');
const { createServerEmbed } = require('../../utils/embedBuilder');
const { readJson, writeJson } = require('../../utils/jsonStorage');

async function sendTempReply(interaction, embed) {
    const msg = await interaction.reply({ embeds: [embed], fetchReply: true });
    setTimeout(() => {
        interaction.deleteReply().catch(() => {});
    }, 10000);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ticket').setDescription('Ticket system')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addSubcommand(sub => sub.setName('setup').setDescription('Setup ticket panel')
            .addChannelOption(opt => opt.setName('channel').setDescription('Channel').setRequired(true).addChannelTypes(ChannelType.GuildText)))
        .addSubcommand(sub => sub.setName('supportrole').setDescription('Set support role')
            .addRoleOption(opt => opt.setName('role').setDescription('Support role').setRequired(true)))
        .addSubcommand(sub => sub.setName('close').setDescription('Close current ticket channel')),
    async execute(interaction) {
        const config = readJson('config.json', {});
        const guildId = interaction.guild.id;
        if (!config[guildId]) config[guildId] = {};
        const sub = interaction.options.getSubcommand();

        if (sub === 'setup') {
            const channel = interaction.options.getChannel('channel');

            const embed = createServerEmbed('ticket', {
                title: 'Support Tickets',
                description: 'Need help? Click the button below to create a private ticket and our team will assist you!',
                fields: [
                    { name: 'Response Time', value: 'Usually within a few hours', inline: true },
                    { name: 'What to Include', value: 'Describe your issue clearly', inline: true },
                ],
            }, interaction.guild);

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('create_ticket')
                    .setLabel('Create Ticket')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🎫')
            );

            await channel.send({ embeds: [embed], components: [row] });
            const replyEmbed = createServerEmbed('success', { title: 'Ticket Panel Created', description: `Panel sent to ${channel}.` }, interaction.guild);
            await sendTempReply(interaction, replyEmbed);

        } else if (sub === 'supportrole') {
            const role = interaction.options.getRole('role');
            config[guildId].supportRole = role.id;
            writeJson('config.json', config);
            const embed = createServerEmbed('success', { title: 'Support Role Set', description: `Support role set to **${role.name}**.` }, interaction.guild);
            await sendTempReply(interaction, embed);

        } else if (sub === 'close') {
            const channel = interaction.channel;
            if (!channel.name.startsWith('ticket-')) {
                return interaction.reply({ embeds: [createServerEmbed('error', { title: 'Error', description: 'This is not a ticket channel.' }, interaction.guild)], ephemeral: true });
            }

            const closingEmbed = createServerEmbed('info', {
                title: 'Closing Ticket',
                description: 'This ticket will be closed in **5 seconds**...',
            }, interaction.guild);
            await interaction.reply({ embeds: [closingEmbed] });

            setTimeout(async () => {
                try { await channel.delete('Ticket closed by user'); } catch {}
            }, 5000);
        }
    },
};
