// plugins/guar.js
// Usa wa.downloadContentFromMessage inyectado desde index.js (o conn.wa / global.wa)

function unwrapMessage(m) {
  let node = m;
  while (
    node?.viewOnceMessage?.message ||
    node?.viewOnceMessageV2?.message ||
    node?.viewOnceMessageV2Extension?.message ||
    node?.ephemeralMessage?.message
  ) {
    node =
      node.viewOnceMessage?.message ||
      node.viewOnceMessageV2?.message ||
      node.viewOnceMessageV2Extension?.message ||
      node.ephemeralMessage?.message;
  }
  return node;
}

function ensureWA(wa, conn) {
  if (wa && typeof wa.downloadContentFromMessage === "function") return wa;
  if (conn && conn.wa && typeof conn.wa.downloadContentFromMessage === "function") return conn.wa;
  if (global.wa && typeof global.wa.downloadContentFromMessage === "function") return global.wa;
  return null;
}

function mimeToExt(mime, fallback = "bin") {
  if (!mime || typeof mime !== "string") return fallback;
  const base = mime.split(";")[0];              // e.g. "audio/ogg; codecs=opus"
  const [, sub] = base.split("/");
  if (!sub) return fallback;
  // normalizaciones comunes
  if (sub.includes("mpeg")) return "mp3";
  if (sub.includes("webp")) return "webp";
  if (sub.includes("quicktime")) return "mov";
  if (sub.includes("x-msvideo")) return "avi";
  if (sub.includes("x-matroska")) return "mkv";
  return sub.replace(/^x-/, "") || fallback;
}

const handler = async (msg, { conn, args, wa }) => {
  const chatId = msg.key.remoteJid;
  const sender = msg.key.participant || msg.key.remoteJid;
  const userId = String(sender || "").replace(/[^0-9]/g, "");
  const pref = global.prefixes?.[0] || ".";

  try { await conn.sendMessage(chatId, { react: { text: "⏳", key: msg.key } }); } catch {}

  const ctx = msg.message?.extendedTextMessage?.contextInfo;
  const quotedRaw = ctx?.quotedMessage;
  const quoted = quotedRaw ? unwrapMessage(quotedRaw) : null;

  if (!quoted) {
    try { await conn.sendMessage(chatId, { react: { text: "❌", key: msg.key } }); } catch {}
    return conn.sendMessage(chatId, {
      text: `❌ *Error:* Debes *responder* a un multimedia (imagen, video, audio, sticker o documento) con *${pref}guar <palabra_clave>* para guardarlo.`,
    }, { quoted: msg });
  }

  const saveKey = (args || []).join(" ").trim().toLowerCase();
  if (!saveKey || !/[a-z0-9]/i.test(saveKey)) {
    try { await conn.sendMessage(chatId, { react: { text: "❌", key: msg.key } }); } catch {}
    return conn.sendMessage(chatId, {
      text: "❌ *Error:* Debes indicar una *palabra clave* (con letras o números).",
    }, { quoted: msg });
  }

  // Detectar tipo y nodo de media
  let mediaType = null;
  let node = null;

  if (quoted.imageMessage) { mediaType = "image"; node = quoted.imageMessage; }
  else if (quoted.videoMessage) { mediaType = "video"; node = quoted.videoMessage; }
  else if (quoted.audioMessage) { mediaType = "audio"; node = quoted.audioMessage; }
  else if (quoted.stickerMessage) { mediaType = "sticker"; node = quoted.stickerMessage; }
  else if (quoted.documentMessage) { mediaType = "document"; node = quoted.documentMessage; }
  else {
    try { await conn.sendMessage(chatId, { react: { text: "❌", key: msg.key } }); } catch {}
    return conn.sendMessage(chatId, {
      text: "❌ *Error:* Solo se aceptan *imágenes, videos, audios, stickers o documentos*.",
    }, { quoted: msg });
  }

  const WA = ensureWA(wa, conn);
  if (!WA) {
    try { await conn.sendMessage(chatId, { react: { text: "❌", key: msg.key } }); } catch {}
    return conn.sendMessage(chatId, {
      text: "❌ *Error interno:* downloader no disponible. (Falta inyectar `wa` en index.js)",
    }, { quoted: msg });
  }

  // Descargar
  try {
    const dlType = mediaType === "document" ? "document" : mediaType; // tipo correcto para downloadContentFromMessage
    const stream = await WA.downloadContentFromMessage(node, dlType);
    let buf = Buffer.alloc(0);
    for await (const chunk of stream) buf = Buffer.concat([buf, chunk]);
    if (!buf.length) throw new Error("Descarga vacía");

    // Derivar mimetype, ext y caption
    const mime = node.mimetype || (mediaType === "sticker" ? "image/webp" : null) || "application/octet-stream";
    let ext = "bin";

    // Para documentos, preferir extensión del nombre de archivo
    if (mediaType === "document" && node.fileName && typeof node.fileName === "string") {
      const dot = node.fileName.lastIndexOf(".");
      if (dot !== -1) ext = node.fileName.slice(dot + 1).toLowerCase();
      else ext = mimeToExt(mime, "bin");
    } else {
      ext = mimeToExt(mime, mediaType === "audio" ? "mp3" : (mediaType === "image" ? "jpg" : (mediaType === "video" ? "mp4" : "bin")));
    }

    const caption =
      node.caption ||
      quoted?.message?.extendedTextMessage?.text ||
      null;

    // Estructura a guardar
    const entry = {
      type: mediaType,
      media: buf.toString("base64"),
      mime,
      ext,
      user: userId,
      caption,
      createdAt: Date.now()
    };

    // Cargar/guardar guar.json
    const fsPath = require("path").resolve("./guar.json");
    let db = {};
    if (require("fs").existsSync(fsPath)) {
      try { db = JSON.parse(require("fs").readFileSync(fsPath, "utf-8")); } catch { db = {}; }
    }
    if (!Array.isArray(db[saveKey])) db[saveKey] = [];
    db[saveKey].push(entry);
    require("fs").writeFileSync(fsPath, JSON.stringify(db, null, 2));

    try { await conn.sendMessage(chatId, { react: { text: "✅", key: msg.key } }); } catch {}
    return conn.sendMessage(chatId, {
      text: `✅ *Guardado:* se añadió 1 archivo al paquete *"${saveKey}"*.\n• tipo: *${mediaType}*\n• ext: *${ext}*`,
    }, { quoted: msg });

  } catch (e) {
    console.error("[guar] error:", e);
    try { await conn.sendMessage(chatId, { react: { text: "❌", key: msg.key } }); } catch {}
    return conn.sendMessage(chatId, {
      text: "❌ *Error:* No se pudo descargar/guardar el archivo.",
    }, { quoted: msg });
  }
};

handler.command = ["guar"];
module.exports = handler;
