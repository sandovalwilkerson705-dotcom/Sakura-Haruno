// plugins/tagall.js
const DIGITS = (s = "") => String(s || "").replace(/\D/g, "");

const handler = async (msg, { conn, args }) => {
  try {
    const chatId   = msg.key.remoteJid;
    const isGroup  = chatId.endsWith("@g.us");
    const isFromMe = !!msg.key.fromMe;

    await conn.sendMessage(chatId, { react: { text: "🔊", key: msg.key } }).catch(() => {});

    if (!isGroup) {
      return conn.sendMessage(chatId, { text: "⚠️ *Este comando solo puede usarse en grupos.*" }, { quoted: msg });
    }

    // Autor (puede venir @lid o @s.whatsapp.net). Si tu index ya setea msg.realJid, lo usamos.
    const senderId      = msg.key.participant || msg.key.remoteJid; // puede ser @lid en grupos LID
    const senderRealJid = typeof msg.realJid === "string"
      ? msg.realJid
      : (senderId?.endsWith?.("@s.whatsapp.net") ? senderId : null);
    const senderDigits  = DIGITS(senderRealJid || senderId);

    // Owner por dígitos
    const isOwner = Array.isArray(global.owner) && global.owner.some(([id]) => id === senderDigits);

    // Metadata
    let meta;
    try {
      meta = await conn.groupMetadata(chatId);
    } catch (e) {
      console.error("[tagall] metadata error:", e);
      return conn.sendMessage(chatId, { text: "❌ No pude leer la metadata del grupo." }, { quoted: msg });
    }

    const participantes = Array.isArray(meta?.participants) ? meta.participants : [];

    // Candidatos del autor para matchear contra p.id (puede ser @lid) o p.jid (real)
    const authorCandidates = new Set([
      senderId,
      senderRealJid,
      `${senderDigits}@s.whatsapp.net`,
      `${senderDigits}@lid`
    ].filter(Boolean));

    // ¿Es admin? (funciona en LID y no-LID)
    const isAdmin = participantes.some(p => {
      const idsPosibles = [
        p?.id,                                   // puede ser @lid o real
        (typeof p?.jid === "string" ? p.jid : "")// algunos wrappers traen .jid = real
      ].filter(Boolean);

      const matchId = idsPosibles.some(id => authorCandidates.has(id) || DIGITS(id) === senderDigits);
      const rolOK   = p?.admin === "admin" || p?.admin === "superadmin";
      return matchId && rolOK;
    });

    if (!isAdmin && !isOwner && !isFromMe) {
      return conn.sendMessage(chatId, {
        text: "🚫 *Este comando solo puede usarlo un administrador o el dueño del bot.*"
      }, { quoted: msg });
    }

    // Menciones: usa el id tal como viene (soporta @lid y @s.whatsapp.net); fallback a .jid si faltara
    const mentionIdsRaw = participantes.map(p => p?.id || p?.jid).filter(Boolean);
    // De-duplicar por dígitos para evitar dobles si vienen id y jid
    const seen = new Set();
    const mentionIds = [];
    for (const jid of mentionIdsRaw) {
      const d = DIGITS(jid);
      if (!seen.has(d)) {
        seen.add(d);
        mentionIds.push(jid);
      }
    }

    const mentionList = mentionIds.map(id => `➤ @${id.split("@")[0]}`).join("\n");
    const extraMsg = (args || []).join(" ");

    let finalMsg  = `╭─⌈ 🔊 𝐓𝐀𝐆𝐀𝐋𝐋 𝐌𝐎𝐃𝐄 ⌋──╮\n`;
        finalMsg += `│ 🤖 *Sakura Haruno*\n`;
        finalMsg += `│ 👤 *Invocador:* @${senderDigits}\n`;
    if (extraMsg.length > 0) {
        finalMsg += `│ 💬 *Mensaje:* ${extraMsg}\n`;
    }
        finalMsg += `╰──────────────╯\n\n`;
        finalMsg += `📢 *Etiquetando a todos los miembros...*\n\n`;
        finalMsg += mentionList;

    await conn.sendMessage(chatId, {
      image: { url: "https://cdn.russellxz.click/012aac15.jpg" },
      caption: finalMsg,
      mentions: mentionIds
    }, { quoted: msg });

  } catch (err) {
    console.error("❌ Error en el comando tagall:", err);
    await conn.sendMessage(msg.key.remoteJid, { text: "❌ Ocurrió un error al ejecutar el comando tagall." }, { quoted: msg });
  }
};

handler.command = ["tagall", "invocar", "todos"];
module.exports = handler;
