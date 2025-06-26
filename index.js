require('dotenv').config();
const keepAlive = require('./keepAlive'); // <-- ESSENCIAL pro bot ficar 24h

const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionsBitField,
  ActionRowBuilder,
  Events,
} = require('discord.js');
const fs = require('fs');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// IDs
const lojaCanalId = '1387191240482619392';
const suporteRoleId = '1386450460541452298';
const cargoCompradorId = '1386450667908108339';
const cargoExtraId = '1386788804546924839';
const canalLogId = '1387222473337999481';
const canalVozId = '1386795393286668309';

const produtoLink = 'https://www.mediafire.com/folder/1qbrd1jb00m2b/Otmizaçao+Pocoyo';
const anydeskLink = 'https://anydesk.com/pt/downloads/windows';
const pixLink = '00020126580014BR.GOV.BCB.PIX0136f05a24a6-6ee7-4665-99fa-859e0e674e3f520400005303986540519.905802BR5925Joao Paulo Carvalho Peres6009SAO PAULO62140510Nb85U6dLzg6304B55F';

client.once('ready', () => {
  console.log(`✅ Bot iniciado como ${client.user.tag}`);
  const log = client.channels.cache.get(canalLogId);
  if (log) log.send(`🟢 Bot iniciado com sucesso em ${new Date().toLocaleString('pt-BR')}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton()) return;

  if (interaction.customId === 'copiar_pix') {
    return interaction.reply({
      content: `🔗 **PIX (Copia e Cola):**\n\`\`\`\n${pixLink}\n\`\`\``,
      ephemeral: true
    });
  }

  if (interaction.customId === 'comprar') {
    const user = interaction.user;
    const safeName = user.username.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const existing = interaction.guild.channels.cache.find(c => c.name.includes(`compra-${safeName}-${user.id}`));
    if (existing) {
      return interaction.reply({ content: `📌 Você já possui um canal aberto: ${existing}`, ephemeral: true });
    }

    const channel = await interaction.guild.channels.create({
      name: `compra-${safeName}-${user.id}`,
      type: ChannelType.GuildText,
      permissionOverwrites: [
        { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
        { id: suporteRoleId, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
      ],
    });

    const confirmarButton = new ButtonBuilder()
      .setCustomId('confirmar')
      .setLabel('✅ Confirmar')
      .setStyle(ButtonStyle.Success);

    const cancelarButton = new ButtonBuilder()
      .setCustomId('cancelar')
      .setLabel('❌ Cancelar Compra')
      .setStyle(ButtonStyle.Danger);

    const copiarPixButton = new ButtonBuilder()
      .setCustomId('copiar_pix')
      .setLabel('💳 PIX (Copia e Cola)')
      .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder().addComponents(confirmarButton, cancelarButton, copiarPixButton);

    const embed = new EmbedBuilder()
      .setTitle(`📦 Finalize sua compra, ${user.username}`)
      .setDescription(
        '🔔 **ENVIE O COMPROVANTE DO PAGAMENTO ABAIXO!**\n\n' +
        '💳 **PIX (Copia e Cola):**\n' +
        '```\n' + pixLink + '\n```\n' +
        '📷 Escaneie o QR Code abaixo ou copie o código acima para pagar.\n\n' +
        'Depois do pagamento, **somente o suporte** irá clicar em ✅ **Confirmar** para liberar o produto.\n\n' +
        '💬 Seu produto será entregue via DM após a confirmação.'
      )
      .setColor('Red');

    await channel.send({ embeds: [embed], components: [row] });

    const qrPath = './qrcode_pix.png';
    if (fs.existsSync(qrPath)) {
      await channel.send({ files: [qrPath] });
    }

    await interaction.reply({ content: `✅ Canal de compra criado: ${channel}`, ephemeral: true });
  }

  if (interaction.customId === 'confirmar') {
    if (!interaction.member.roles.cache.has(suporteRoleId)) {
      return interaction.reply({ content: '❌ Apenas o suporte pode confirmar a compra.', ephemeral: true });
    }

    const overwrite = interaction.channel.permissionOverwrites.cache.find(o =>
      o.allow.has(PermissionsBitField.Flags.ViewChannel) &&
      o.id !== suporteRoleId &&
      o.id !== interaction.guild.id
    );

    const buyerId = overwrite?.id;
    const member = buyerId ? await interaction.guild.members.fetch(buyerId).catch(() => null) : null;

    if (!member) {
      return interaction.channel.send('❌ Não foi possível encontrar o usuário para adicionar o cargo.');
    }

    let dmSuccess = true;
    try {
      await member.send(
        `✅ Olá, ${member.user.username}! Sua compra foi confirmada com sucesso.\n\n` +
        `📥 Baixe o **AnyDesk** (programa para acesso remoto):\n${anydeskLink}\n\n` +
        `📦 Aqui está o link do seu pack: ${produtoLink}\n\n` +
        `🎧 Após baixar o AnyDesk, abra o programa e envie o código aqui neste canal.\n` +
        `🕐 Enquanto isso, entre no canal de voz <#${canalVozId}> e aguarde o atendimento!`
      );
    } catch {
      dmSuccess = false;
      await interaction.channel.send('⚠️ Não consegui enviar o produto via DM. O usuário pode estar com DMs fechadas.');
    }

    const cargos = [cargoCompradorId, cargoExtraId];
    for (const cargoId of cargos) {
      const role = interaction.guild.roles.cache.get(cargoId);
      if (role) {
        try {
          await member.roles.add(role);
          await interaction.channel.send(`🎉 ${member.user.username}, o cargo **${role.name}** foi adicionado!`);
        } catch {
          await interaction.channel.send(`⚠️ Não consegui adicionar o cargo: ${role.name}`);
        }
      }
    }

    const logChannel = interaction.guild.channels.cache.get(canalLogId);
    if (logChannel) {
      await logChannel.send(`✅ Compra **confirmada** para ${member.user.tag} por ${interaction.user.tag}`);
    }

    if (dmSuccess) {
      await interaction.channel.send('✅ Compra confirmada! Fechando o canal em 5 segundos...');
      setTimeout(() => interaction.channel.delete().catch(console.error), 5000);
    }

    await interaction.reply({ content: '✅ Compra processada com sucesso.', ephemeral: true });
  }

  if (interaction.customId === 'cancelar') {
    const isBuyer = interaction.channel.permissionOverwrites.cache.some(p =>
      p.id === interaction.user.id &&
      p.allow.has(PermissionsBitField.Flags.ViewChannel)
    );

    if (!isBuyer && !interaction.member.roles.cache.has(suporteRoleId)) {
      return interaction.reply({ content: '❌ Você não tem permissão para cancelar esta compra.', ephemeral: true });
    }

    const logChannel = interaction.guild.channels.cache.get(canalLogId);
    if (logChannel) {
      await logChannel.send(`🚫 Compra **cancelada** por ${interaction.user.tag} no canal <#${interaction.channel.id}>`);
    }

    await interaction.reply({ content: '❌ Compra cancelada. Canal será fechado em 5 segundos.', ephemeral: true });
    setTimeout(() => interaction.channel.delete().catch(console.error), 5000);
  }
});

client.on('messageCreate', async (message) => {
  if (message.channel.id === lojaCanalId && message.content === '!enviar-produto') {
    const embed = new EmbedBuilder()
      .setTitle('📦 Otimização Profissional para Free Fire (VIA ANYDESK)')
      .setDescription(
        `🚀 **Mais FPS, menos lag e resposta mais rápida!**\n\n` +
        `🔧 *Serviço remoto feito via* **ANYDESK** 🔴\n\n` +
        `✅ Ideal para jogadores sérios\n` +
        `💰 **Apenas R$ 24,99**\n🖥️ Compatível com versões 4.240 ou superiores\n\n` +
        `📌 Após pagar, envie o comprovante e aguarde a otimização!`
      )
      .setColor('Red')
      .setFooter({ text: 'Pagamento via PIX. Após pagar, clique em Confirmar!' });

    const comprarBtn = new ButtonBuilder()
      .setCustomId('comprar')
      .setLabel('🛒 Comprar')
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(comprarBtn);

    await message.channel.send({ embeds: [embed], components: [row] });

    const qrPath = './qrcode_pix.png';
    if (fs.existsSync(qrPath)) {
      await message.channel.send({ files: [qrPath] });
    }
  }
});

keepAlive();
client.login(process.env.TOKEN).catch(console.error);
