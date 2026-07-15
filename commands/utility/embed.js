const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createServerEmbed, parseColor } = require('../../utils/embedBuilder');
const { readJson, writeJson } = require('../../utils/jsonStorage');

async function sendTempReply(interaction, embed) {
    const msg = await interaction.reply({ embeds: [embed], fetchReply: true });
    setTimeout(() => {
        interaction.deleteReply().catch(() => {});
    }, 10000);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('embed').setDescription('Manage embed templates')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addSubcommand(sub => sub.setName('create').setDescription('Create template')
            .addStringOption(opt => opt.setName('name').setDescription('Name').setRequired(true))
            .addStringOption(opt => opt.setName('description').setDescription('Description').setRequired(true))
            .addStringOption(opt => opt.setName('title').setDescription('Title').setRequired(false))
            .addStringOption(opt => opt.setName('color').setDescription('Hex color (e.g. #5865F2)').setRequired(false))
            .addStringOption(opt => opt.setName('footer').setDescription('Footer text').setRequired(false))
            .addStringOption(opt => opt.setName('thumbnail').setDescription('Thumbnail URL').setRequired(false))
            .addStringOption(opt => opt.setName('image').setDescription('Image URL').setRequired(false)))
        .addSubcommand(sub => sub.setName('edit').setDescription('Edit template')
            .addStringOption(opt => opt.setName('name').setDescription('Name').setRequired(true))
            .addStringOption(opt => opt.setName('title').setDescription('Title').setRequired(false))
            .addStringOption(opt => opt.setName('description').setDescription('Description').setRequired(false))
            .addStringOption(opt => opt.setName('color').setDescription('Hex color').setRequired(false))
            .addStringOption(opt => opt.setName('footer').setDescription('Footer').setRequired(false))
            .addStringOption(opt => opt.setName('thumbnail').setDescription('Thumbnail').setRequired(false))
            .addStringOption(opt => opt.setName('image').setDescription('Image').setRequired(false)))
        .addSubcommand(sub => sub.setName('delete').setDescription('Delete template')
            .addStringOption(opt => opt.setName('name').setDescription('Name').setRequired(true)))
        .addSubcommand(sub => sub.setName('list').setDescription('List templates'))
        .addSubcommand(sub => sub.setName('send').setDescription('Send template')
            .addStringOption(opt => opt.setName('name').setDescription('Name').setRequired(true))
            .addChannelOption(opt => opt.setName('channel').setDescription('Channel').setRequired(false))
            .addStringOption(opt => opt.setName('mention').setDescription('Mention @everyone, @here, or a role ID').setRequired(false))),
    async execute(interaction) {
        const embeds = readJson('embeds.json', {});
        const guildId = interaction.guild.id;
        if (!embeds[guildId]) embeds[guildId] = {};
        const sub = interaction.options.getSubcommand();

        if (sub === 'create') {
            const name = interaction.options.getString('name').toLowerCase();
            if (embeds[guildId][name]) {
                const embed = createServerEmbed('error', { title: 'Error', description: `Template **${name}** already exists.` }, interaction.guild);
                return interaction.reply({ embeds: [embed], flags: 64 });
            }
            const colorInput = interaction.options.getString('color');
            embeds[guildId][name] = {
                title: interaction.options.getString('title') || null,
                description: interaction.options.getString('description'),
                color: colorInput || '#5865F2',
                footer: interaction.options.getString('footer') || null,
                thumbnail: interaction.options.getString('thumbnail') || null,
                image: interaction.options.getString('image') || null,
                fields: [],
            };
            writeJson('embeds.json', embeds);
            const embed = createServerEmbed('success', { title: 'Template Created', description: `Embed template **${name}** has been saved.` }, interaction.guild);
            await sendTempReply(interaction, embed);
        } else if (sub === 'edit') {
            const name = interaction.options.getString('name').toLowerCase();
            if (!embeds[guildId][name]) {
                const embed = createServerEmbed('error', { title: 'Error', description: `Template **${name}** not found.` }, interaction.guild);
                return interaction.reply({ embeds: [embed], flags: 64 });
            }
            const t = embeds[guildId][name];
            ['title', 'description', 'color', 'footer', 'thumbnail', 'image'].forEach(k => {
                const v = interaction.options.getString(k);
                if (v !== null) t[k] = v;
                if (v === '' && k === 'title') t[k] = null;
            });
            writeJson('embeds.json', embeds);
            const embed = createServerEmbed('success', { title: 'Template Updated', description: `Embed template **${name}** updated.` }, interaction.guild);
            await sendTempReply(interaction, embed);
        } else if (sub === 'delete') {
            const name = interaction.options.getString('name').toLowerCase();
            if (!embeds[guildId][name]) {
                const embed = createServerEmbed('error', { title: 'Error', description: `Template **${name}** not found.` }, interaction.guild);
                return interaction.reply({ embeds: [embed], flags: 64 });
            }
            delete embeds[guildId][name];
            writeJson('embeds.json', embeds);
            const embed = createServerEmbed('success', { title: 'Template Deleted', description: `Embed template **${name}** deleted.` }, interaction.guild);
            await sendTempReply(interaction, embed);
        } else if (sub === 'list') {
            const names = Object.keys(embeds[guildId]);
            const embed = createServerEmbed('info', { title: 'Embed Templates', description: names.length ? names.map(n => `• **${n}**`).join('\n') : 'No templates saved yet.' }, interaction.guild);
            await interaction.reply({ embeds: [embed] });
        } else if (sub === 'send') {
            const name = interaction.options.getString('name').toLowerCase();
            const channel = interaction.options.getChannel('channel') || interaction.channel;
            const mention = interaction.options.getString('mention');
            const template = embeds[guildId]?.[name];
            if (!template) {
                const embed = createServerEmbed('error', { title: 'Error', description: `Template **${name}** not found.` }, interaction.guild);
                return interaction.reply({ embeds: [embed], flags: 64 });
            }

            const sentEmbed = createServerEmbed('info', {
                title: template.title,
                description: template.description,
                color: parseColor(template.color) || 0x5865F2,
                footer: template.footer,
                thumbnail: template.thumbnail,
                image: template.image,
                fields: template.fields,
            }, interaction.guild);

            const buttons = readJson('buttons.json', {});
            const guildButtons = buttons[guildId] || {};
            const templateButtons = Object.values(guildButtons).filter(b => b.embedName === name);
            const rows = [];
            let currentRow = new ActionRowBuilder();
            for (const btn of templateButtons) {
                if (currentRow.components.length >= 5) { rows.push(currentRow); currentRow = new ActionRowBuilder(); }

                // Link buttons need special handling
                if (btn.type === 'link' && btn.url) {
                    const b = new ButtonBuilder()
                        .setLabel(btn.label)
                        .setStyle(ButtonStyle.Link)
                        .setURL(btn.url);
                    if (btn.emoji) b.setEmoji(btn.emoji);
                    currentRow.addComponents(b);
                } else {
                    const b = new ButtonBuilder()
                        .setCustomId(btn.id)
                        .setLabel(btn.label)
                        .setStyle(ButtonStyle[btn.style] || ButtonStyle.Primary);
                    if (btn.emoji) b.setEmoji(btn.emoji);
                    currentRow.addComponents(b);
                }
            }
            if (currentRow.components.length > 0) rows.push(currentRow);

            let content = undefined;
            if (mention) {
                if (mention === '@everyone') content = '@everyone';
                else if (mention === '@here') content = '@here';
                else if (mention.match(/^\d+$/)) content = `<@&${mention}>`;
            }

            await channel.send({ content, embeds: [sentEmbed], components: rows.length > 0 ? rows : undefined });
            const embed = createServerEmbed('success', { title: 'Sent', description: `Embed **${name}** sent to ${channel}.` }, interaction.guild);
            await sendTempReply(interaction, embed);
        }
    },
};
