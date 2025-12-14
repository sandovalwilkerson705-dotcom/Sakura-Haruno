requireFromRoot = (mod) => require(require('path').join(__dirname, '..', mod));
requireFromRoot('config.js'); // 🔁 Cargar config.js para acceder a global.reto

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

const handler = async (msg, { conn }) => {
  const chatId = msg.key.remoteJid;

  try {
    if (!Array.isArray(global.reto) || global.reto.length === 0) {
      throw new Error("No hay retos disponibles.");
    }

    const reto = pickRandom(global.reto);

    await conn.sendMessage(chatId, {
      react: { text: "🎲", key: msg.key }
    });

    // 📽️ Enviar el video como GIF
    await conn.sendMessage(chatId, {
      video: { url: 'https://cdn.russellxz.click/483421f8.mp4' },
      gifPlayback: true,
      caption: `𝘏𝘢𝘴 𝘦𝘴𝘤𝘰𝘨𝘪𝘥𝘰 *𝘙𝘌𝘛𝘖*\n\n╱╲❀╱╲╱╲❀╱╲╱╲❀╱╲\n◆ ${reto}\n╲╱❀╲╱╲╱❀╲╱╲╱❀╲╱\n\n© SAKURA HARUNO`
    }, { quoted: msg });

    await conn.sendMessage(chatId, {
      react: { text: "✅", key: msg.key }
    });

  } catch (e) {
    console.error("❌ Error en el comando .reto:", e);
    await conn.sendMessage(chatId, {
      text: "❌ *Error:* " + e.message
    }, { quoted: msg });

    await conn.sendMessage(chatId, {
      react: { text: "❌", key: msg.key }
    });
  }
};

handler.command = ['reto'];
module.exports = handler;
