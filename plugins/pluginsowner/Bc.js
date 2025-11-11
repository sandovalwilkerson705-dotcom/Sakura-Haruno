// plugins/bc.js
const fs = require("fs");
const path = require("path");

// ——— helpers ESM-safe + quoted ———
function unwrapMessage(m) {
  let n = m;
  while (
    n?.viewOnceMessage?.message ||
    n?.viewOnceMessageV2?.message ||
    n?.viewOnceMessageV2Extension?.message ||
    n?.ephemeralMessage?.message
  ) {
    n =
      n.viewOnceMessage?.message ||
      n.viewOnceMessageV2?.message ||
      n.viewOnceMessageV2Extension?.message ||
      n.ephemeralMessage?.message;
  }
  return n;
}
function getQuotedMessage(msg) {
  const root = unwrapMessage(msg?.message) || {};
  const ctxs = [
    root?.extendedTextMessage?.contextInfo,
    root?.imageMessage?.contextInfo,
    root?.videoMessage?.contextInfo,
    root?.audioMessage?.contextInfo,
    root?.documentMessage?.contextInfo,
    root?.stickerMessage?.contextInfo,
  ].filter(Boolean);
  for (const c of ctxs) if (c?.quotedMessage) return unwrapMessage(c.quotedMessage);
  return null;
}
async function getDownloader(wa) {
  if (wa && typeof wa.downloadContentFromMessage === "function") return wa.downloadContentFromMessage;
  try {
    const m = await import("@whiskeysockets/baileys");
    return m.downloadContentFromMessage;
  } catch {
    return null;
  }
}
async function bufFrom(DL, nodeType, node) {
  const stream = await DL(node, nodeType);
  let buf = Buffer.alloc(0);
  for await (const chunk of stream) buf = Buffer.concat([buf, chunk]);
  return buf;
}

const handler = async (msg, { conn, wa }) => {
  const chatId  = msg.key.remoteJid;
  const sender  = (msg.key.participant || msg.key.remoteJid).replace(/\D/g, "");
  const isFromMe = !!msg.key.fromMe;

  // Owners
  const ownerPath = path.resolve("owner.json");
  const owners = fs.existsSync(ownerPath) ? JSON.parse(fs.readFileSync(ownerPath, "utf-8")) : [];
  const isOwner = Array.isArray(owners) && owners.some(([id]) => id === sender);

  if (!isOwner && !isFromMe) {
    await conn.sendMessage(chatId, { text: "⚠️ Solo el *Owner* puede usar este comando." }, { quoted: msg });
    return;
  }

  const DL = await getDownloader(wa);
  if (!DL) {
    await conn.sendMessage(chatId, { text: "❌ Falta downloader de Baileys (wa.downloadContentFromMessage)." }, { quoted: msg });
    return;
  }

  try { await conn.sendMessage(chatId, { react: { text: "🚀", key: msg.key } }); } catch {}

  const quoted = getQuotedMessage(msg);
  if (!quoted) {
    await conn.sendMessage(chatId, { text: "⚠️ Debes *citar* el mensaje que deseas enviar con el comando .bc" }, { quoted: msg });
    return;
  }

  const fecha = new Date().toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" });
  const header = `📢 *COMUNICADO OFICIAL DE SUKI BOT* 📢\n──────────────\n🕒 Fecha: ${fecha}\n──────────────\n\n`;

  let broadcastMsg = null;

  if (quoted.conversation) {
    broadcastMsg = { text: header + quoted.conversation };
  } else if (quoted.extendedTextMessage?.text) {
    broadcastMsg = { text: header + quoted.extendedTextMessage.text };
  } else if (quoted.imageMessage) {
    const buffer = await bufFrom(DL, "image", quoted.imageMessage);
    broadcastMsg = { image: buffer, caption: header + (quoted.imageMessage.caption || "") };
  } else if (quoted.videoMessage) {
    const buffer = await bufFrom(DL, "video", quoted.videoMessage);
    broadcastMsg = {
      video: buffer,
      caption: header + (quoted.videoMessage.caption || ""),
      gifPlayback: !!quoted.videoMessage.gifPlayback
    };
  } else if (quoted.audioMessage) {
    const buffer = await bufFrom(DL, "audio", quoted.audioMessage);
    // mando header antes y luego el audio (WA no soporta caption en audio)
    await conn.sendMessage(chatId, { text: header }, { quoted: msg });
    broadcastMsg = { audio: buffer, mimetype: quoted.audioMessage.mimetype || "audio/mpeg" };
  } else if (quoted.stickerMessage) {
    const buffer = await bufFrom(DL, "sticker", quoted.stickerMessage);
    await conn.sendMessage(chatId, { text: header }, { quoted: msg });
    broadcastMsg = { sticker: buffer };
  } else if (quoted.documentMessage) {
    const buffer = await bufFrom(DL, "document", quoted.documentMessage);
    broadcastMsg = {
      document: buffer,
      fileName: quoted.documentMessage.fileName || "archivo",
      mimetype: quoted.documentMessage.mimetype || "application/octet-stream",
      caption: header + (quoted.documentMessage.caption || "")
    };
  } else {
    await conn.sendMessage(chatId, { text: "❌ No se reconoce el tipo de mensaje citado." }, { quoted: msg });
    return;
  }

  // Enviar a todos los grupos
  let groupsMap = {};
  try { groupsMap = await conn.groupFetchAllParticipating(); }
  catch (e) {
    console.error("groupFetchAllParticipating fallo:", e);
    await conn.sendMessage(chatId, { text: "❌ No pude obtener los grupos." }, { quoted: msg });
    return;
  }

  const groupIds = Object.keys(groupsMap);
  for (const gid of groupIds) {
    try {
      await conn.sendMessage(gid, broadcastMsg);
      await new Promise(r => setTimeout(r, 1000)); // 1s anti-rate limit
    } catch (e) {
      console.error(`Error enviando a ${gid}:`, e);
    }
  }

  await conn.sendMessage(chatId, { text: `✅ *Broadcast enviado a ${groupIds.length} grupos.*` }, { quoted: msg });
};

handler.command = ["bc"];
handler.tags = ["owner"];
handler.help = ["bc (respondiendo a un mensaje)"];
handler.register = true;

module.exports = handler;
