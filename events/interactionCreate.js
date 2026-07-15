const { Events, MessageFlags, PermissionFlagsBits, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { createServerEmbed, colors } = require('../utils/embedBuilder');
const { readJson, writeJson } = require('../utils/jsonStorage');

const pollVotes = new Map();

// Default ticket settings (mirrored from ticket.js for safety)
const defaultSettings = {
    inactivityEnabled: true,
    inactivityTime: 2,
    inactivityMessage: 'This ticket has been inactive for {time}. If you still need help, click the button below to notify support.',
    autoCloseEnabled: false,
    autoCloseTime: 10,
    transcriptEnabled: false,
};

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        if (interaction.isChatInputCommand()) {
            const command = interaction.client.commands.get(interaction.commandName);
            if (!command) return;

            const allowed = await checkCommandPermission(interaction, command);
            if (!allowed) {
                const embed = createServerEmbed('error', {
                    title: 'Permission Denied',
                    description: 'You do not have permission to use this command.',
                }, interaction.guild);
                return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            }

            try {
                await command.execute(interaction);
            } catch (error) {
                console.error(error);
                const embed = createServerEmbed('error', {
                    title: 'Command Error',
                    description: 'There was an error while executing this command!',
                }, interaction.guild);
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ embeds: [embed], flags: MessageFlags.Ephemeral });
                } else {
                    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
                }
            }
            return;
        }

        if (interaction.isButton()) {
            await handleButton(interaction);
            return;
        }
    },
};

async function checkCommandPermission(interaction, command) {
    const config = readJson('config.json', {});
    const guildConfig = config[interaction.guild.id] || {};

    const adminOnly = ['config', 'embed', 'button', 'autoreply', 'ticket', 'warn', 'mute', 'unmute', 'kick', 'ban', 'unban', 'purge', 'shop'];
    if (adminOnly.includes(command.data.name)) {
        const cmdPerms = guildConfig.commandPermissions?.[command.data.name];
        if (cmdPerms && cmdPerms.length > 0) {
            const hasRole = cmdPerms.some(roleId => interaction.member.roles.cache.has(roleId));
            if (hasRole) return true;
        }
        return interaction.member.permissions.has(PermissionFlagsBits.Administrator) ||
               interaction.member.permissions.has(PermissionFlagsBits.ManageGuild);
    }

    const cmdPerms = guildConfig.commandPermissions?.[command.data.name];
    if (cmdPerms && cmdPerms.length > 0) {
        return cmdPerms.some(roleId => interaction.member.roles.cache.has(roleId));
    }

    return true;
}

async function handleButton(interaction) {
    const customId = interaction.customId;

    if (customId.startsWith('poll_vote_')) {
        await handlePollVote(interaction);
        return;
    }

    if (customId === 'giveaway_enter') {
        await handleGiveawayEntry(interaction);
        return;
    }

    if (customId === 'create_ticket') {
        await handleTicketCreate(interaction);
        return;
    }

    if (customId === 'close_ticket') {
        await handleTicketClose(interaction);
        return;
    }

    if (customId === 'call_support') {
        await handleCallSupport(interaction);
        return;
    }

    const buttons = readJson('buttons.json', {});
    // FIX: buttons are stored under guildId, so we need to access them properly
    const buttonData = buttons[interaction.guild.id]?.[interaction.customId];
    if (!buttonData) return;

    if (buttonData.type === 'link') {
        try {
            await interaction.reply({ content: 'Opening link...', flags: MessageFlags.Ephemeral });
        } catch {
            try { await interaction.update({}); } catch {}
        }
        return;
    }

    if (buttonData.type === 'role') {
        const member = interaction.member;
        const role = interaction.guild.roles.cache.get(buttonData.roleId);
        if (!role) {
            const embed = createServerEmbed('error', {
                title: 'Role Not Found',
                description: 'The configured role no longer exists.',
            }, interaction.guild);
            return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }
        try {
            if (member.roles.cache.has(role.id)) {
                await member.roles.remove(role);
                const embed = createServerEmbed('success', {
                    title: 'Role Removed',
                    description: `Removed **${role.name}** from you.`,
                }, interaction.guild);
                await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            } else {
                await member.roles.add(role);
                const embed = createServerEmbed('success', {
                    title: 'Role Added',
                    description: `Added **${role.name}** to you.`,
                }, interaction.guild);
                await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            }
        } catch (err) {
            console.error('Role button error:', err);
            const embed = createServerEmbed('error', {
                title: 'Error',
                description: 'Could not modify your roles. I may lack permissions or the role is higher than mine.',
            }, interaction.guild);
            await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }
        return;
    }

    if (buttonData.type === 'custom') {
        const embed = createServerEmbed('info', {
            title: 'Custom Action',
            description: buttonData.message || 'Action triggered!',
        }, interaction.guild);
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
}

async function handlePollVote(interaction) {
    const parts = interaction.customId.split('_');
    const optionIndex = parseInt(parts[2]);
    const messageId = interaction.message.id;

    if (!pollVotes.has(messageId)) {
        pollVotes.set(messageId, new Map());
    }
    const votes = pollVotes.get(messageId);

    for (const [idx, userSet] of votes) {
        if (userSet.has(interaction.user.id)) {
            userSet.delete(interaction.user.id);
        }
    }

    if (!votes.has(optionIndex)) {
        votes.set(optionIndex, new Set());
    }
    votes.get(optionIndex).add(interaction.user.id);

    const originalEmbed = interaction.message.embeds[0];
    const updatedFields = originalEmbed.fields.map((field, idx) => {
        const count = votes.get(idx)?.size || 0;
        const letter = String.fromCharCode(65 + idx);
        const optionText = field.name.split('. ').slice(1).join('. ');
        return { name: `${letter}. ${optionText}`, value: `**${count}** votes`, inline: false };
    });

    const newEmbed = EmbedBuilder.from(originalEmbed).setFields(updatedFields);
    await interaction.update({ embeds: [newEmbed] });
}

async function handleGiveawayEntry(interaction) {
    const messageId = interaction.message.id;
    if (!global.giveawayEntrants) global.giveawayEntrants = new Map();
    if (!global.giveawayEntrants.has(messageId)) {
        global.giveawayEntrants.set(messageId, new Set());
    }
    const entrants = global.giveawayEntrants.get(messageId);

    if (entrants.has(interaction.user.id)) {
        entrants.delete(interaction.user.id);
        const embed = createServerEmbed('warning', {
            title: 'Entry Removed',
            description: 'You have left the giveaway.',
        }, interaction.guild);
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    } else {
        entrants.add(interaction.user.id);
        const embed = createServerEmbed('success', {
            title: 'Entry Confirmed!',
            description: 'You have entered the giveaway! Good luck!',
        }, interaction.guild);
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    const originalEmbed = interaction.message.embeds[0];
    const count = entrants.size;
    const newEmbed = EmbedBuilder.from(originalEmbed);
    const fields = newEmbed.data.fields || [];
    const participantField = fields.find(f => f.name.includes('Entries') || f.name.includes('Participants'));
    if (participantField) {
        participantField.value = `**${count}** participants`;
    }
    await interaction.message.edit({ embeds: [newEmbed] });
}

async function handleTicketCreate(interaction) {
    const guild = interaction.guild;
    const member = interaction.member;
    const config = readJson('config.json', {});
    const guildConfig = config[guild.id] || {};
    const settings = guildConfig.ticketSettings || { ...defaultSettings };

    const safeName = member.user.username.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20);
    const existing = guild.channels.cache.find(ch => ch.name === `ticket-${safeName}`);
    if (existing) {
        const embed = createServerEmbed('warning', {
            title: 'Ticket Already Open',
            description: `You already have an open ticket: ${existing}`,
        }, guild);
        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    const channelName = `ticket-${safeName}`;
    const supportRoleId = guildConfig.supportRole;

    const permissionOverwrites = [
        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: member.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles] },
        { id: interaction.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] },
    ];

    if (supportRoleId) {
        permissionOverwrites.push({
            id: supportRoleId,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
        });
    }

    const adminRoles = guild.roles.cache.filter(r => r.permissions.has(PermissionFlagsBits.Administrator));
    adminRoles.forEach(role => {
        if (!permissionOverwrites.find(p => p.id === role.id)) {
            permissionOverwrites.push({
                id: role.id,
                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
            });
        }
    });

    try {
        const ticketChannel = await guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            permissionOverwrites,
        });

        const welcomeEmbed = new EmbedBuilder()
            .setColor(colors.ticket)
            .setTitle('Support Ticket')
            .setDescription(`Hello ${member}, a support member will be with you shortly.`)
            .addFields(
                { name: 'Created By', value: `<@${member.id}>`, inline: true },
                { name: 'Created At', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true },
                { name: 'Status', value: 'Waiting for support', inline: true },
            )
            .setFooter({ text: 'Click the button below to close this ticket' })
            .setTimestamp();

        const closeRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('close_ticket')
                .setLabel('Close Ticket')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('🔒')
        );

        await ticketChannel.send({ content: supportRoleId ? `<@&${supportRoleId}>` : undefined, embeds: [welcomeEmbed], components: [closeRow] });

        if (settings.inactivityEnabled) {
            const inactivityMs = (settings.inactivityTime || 2) * 60 * 1000;

            setTimeout(async () => {
                try {
                    const messages = await ticketChannel.messages.fetch({ limit: 5 });
                    const botMsgs = messages.filter(m => m.author.id === interaction.client.user.id);
                    const hasInactiveMsg = botMsgs.some(m => m.embeds[0]?.title?.includes('Inactivity'));
                    if (hasInactiveMsg) return;

                    const timeText = `${settings.inactivityTime || 2} minute${(settings.inactivityTime || 2) !== 1 ? 's' : ''}`;
                    const msgText = (settings.inactivityMessage || defaultSettings.inactivityMessage).replace('{time}', timeText);

                    const inactiveEmbed = new EmbedBuilder()
                        .setColor(colors.warning)
                        .setTitle('Inactivity Detected')
                        .setDescription(msgText)
                        .setFooter({ text: 'YSER Flow Ticket System' })
                        .setTimestamp();

                    const callSupportRow = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId('call_support')
                            .setLabel('📢 Call Support')
                            .setStyle(ButtonStyle.Danger)
                    );

                    await ticketChannel.send({ embeds: [inactiveEmbed], components: [callSupportRow] });

                    if (settings.autoCloseEnabled) {
                        const autoCloseMs = (settings.autoCloseTime || 10) * 60 * 1000;
                        setTimeout(async () => {
                            try {
                                const recentMessages = await ticketChannel.messages.fetch({ limit: 5 });
                                const lastMsg = recentMessages.first();
                                const lastBotMsg = recentMessages.find(m => m.author.id === interaction.client.user.id && m.embeds[0]?.title?.includes('Inactivity'));

                                if (lastMsg && lastBotMsg && lastMsg.id !== lastBotMsg.id && lastMsg.createdTimestamp > lastBotMsg.createdTimestamp) {
                                    return;
                                }

                                const closingEmbed = new EmbedBuilder()
                                    .setColor(colors.error)
                                    .setTitle('Auto-Closing Ticket')
                                    .setDescription('This ticket is being closed due to inactivity.')
                                    .setTimestamp();

                                await ticketChannel.send({ embeds: [closingEmbed] });
                                setTimeout(async () => {
                                    try { await ticketChannel.delete('Auto-closed due to inactivity'); } catch {}
                                }, 5000);
                            } catch {}
                        }, autoCloseMs);
                    }
                } catch {}
            }, inactivityMs);
        }

        const embed = createServerEmbed('success', {
            title: 'Ticket Created',
            description: `Your ticket has been created: ${ticketChannel}`,
        }, guild);
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });

    } catch (err) {
        console.error('Ticket creation error:', err);
        const embed = createServerEmbed('error', {
            title: 'Error',
            description: 'Failed to create ticket. I may lack permissions.',
        }, guild);
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
}

async function handleTicketClose(interaction) {
    const channel = interaction.channel;
    if (!channel.name.startsWith('ticket-')) {
        return interaction.reply({ embeds: [createServerEmbed('error', { title: 'Error', description: 'This is not a ticket channel.' }, interaction.guild)], flags: MessageFlags.Ephemeral });
    }

    const closingEmbed = new EmbedBuilder()
        .setColor(colors.error)
        .setTitle('Closing Ticket')
        .setDescription('This ticket will be closed in **5 seconds**...')
        .setFooter({ text: 'YSER Flow' })
        .setTimestamp();

    await interaction.reply({ embeds: [closingEmbed] });

    setTimeout(async () => {
        try { await channel.delete('Ticket closed'); } catch {}
    }, 5000);
}

async function handleCallSupport(interaction) {
    const config = readJson('config.json', {});
    const guildConfig = config[interaction.guild.id] || {};
    const supportRoleId = guildConfig.supportRole;

    if (!supportRoleId) {
        const embed = createServerEmbed('error', {
            title: 'No Support Role',
            description: 'No support role is configured for this server. Use `/ticket supportrole` to set one.',
        }, interaction.guild);
        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    await interaction.channel.send({
        content: `<@&${supportRoleId}> **Support requested in this ticket by <@${interaction.user.id}>!**`,
        allowedMentions: { roles: [supportRoleId] }
    });

    const embed = createServerEmbed('success', {
        title: 'Support Called',
        description: 'The support team has been notified and will assist you shortly.',
    }, interaction.guild);
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}
