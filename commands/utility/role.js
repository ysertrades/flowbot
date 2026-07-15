const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { checkPermission } = require("../utils/permissions");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("role")
        .setDescription("Role management")
        .addSubcommand(sub =>
            sub.setName("add").setDescription("Add a role to a user")
            .addUserOption(opt => opt.setName("user").setDescription("User").setRequired(true))
            .addRoleOption(opt => opt.setName("role").setDescription("Role").setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName("remove").setDescription("Remove a role from a user")
            .addUserOption(opt => opt.setName("user").setDescription("User").setRequired(true))
            .addRoleOption(opt => opt.setName("role").setDescription("Role").setRequired(true))
        ),

    async execute(interaction) {
        if (!(await checkPermission(interaction, "role"))) {
            return interaction.reply({ content: "You don't have permission.", ephemeral: true });
        }

        const sub = interaction.options.getSubcommand();
        const user = interaction.options.getUser("user");
        const role = interaction.options.getRole("role");
        const member = interaction.guild.members.cache.get(user.id);

        if (!member) return interaction.reply({ content: "User not found.", ephemeral: true });

        if (sub === "add") {
            if (member.roles.cache.has(role.id)) {
                return interaction.reply({ content: "User already has this role.", ephemeral: true });
            }
            await member.roles.add(role);
            const embed = new EmbedBuilder()
                .setColor(0x2ECC71)
                .setDescription("➕ Added **" + role.name + "** to **" + user.tag + "**.")
                .setFooter({ text: "YSER Flow" });
            await interaction.reply({ embeds: [embed] });
        }

        if (sub === "remove") {
            if (!member.roles.cache.has(role.id)) {
                return interaction.reply({ content: "User doesn't have this role.", ephemeral: true });
            }
            await member.roles.remove(role);
            const embed = new EmbedBuilder()
                .setColor(0xE74C3C)
                .setDescription("➖ Removed **" + role.name + "** from **" + user.tag + "**.")
                .setFooter({ text: "YSER Flow" });
            await interaction.reply({ embeds: [embed] });
        }
    }
};
