const handler = async (msg, { conn }) => {
  const chatId = msg.key.remoteJid;
  const pref = global.prefixes?.[0] || ".";

  // Reacción al iniciar
  await conn.sendMessage(chatId, {
    react: { text: "🧠", key: msg.key }
  });

  const caption = `
*🌐INFORMACIÓN DEL BOT🌐*
Sakura Haruno no contiene sistema subbots por el momento
❖ *Versión Privada:*  
  ▸ Con sistema avanzado y estable

❖ *Versión Pública:*  
  ▸ Más ligera y sin sistema de subbots.

📌 Puedes usar el comando ${pref}menu para descubrir mis funciones actuales y futuras.
╰────────────────╯
`.trim();

  await conn.sendMessage(chatId, {
    image: { url: 'https://cdn.russellxz.click/012aac15.jpg' },
    caption
  }, { quoted: msg });
};

handler.command = ['info', 'help'];
handler.tags = ['info'];
handler.help = ['info'];
handler.register = true;

module.exports = handler;
