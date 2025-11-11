// plugins/abrir.js
const fs = require("fs");
const path = require("path");

const DIGITS = (s = "") => String(s).replace(/\D/g, "");

function lidParser(participants = []) {
  try {
    return participants.map(v => ({
      id: (typeof v?.id === "string" && v.id.endsWith("@lid") && v.jid) ? v.jid : v.id,
      admin: v?.admin ?? null,
      raw: v
    }));
  } catch {
    return participants || [];
  }
}

async function isAdminByNumber(conn, chatId, number) {
  try {
    const meta = await conn.groupMetadata(chatId);
    const raw  = Array.isArray(meta?.participants) ? meta.participants : [];
    const norm = lidParser(raw);
    const adminNums = new Set();
    for (let i = 0; i < raw.length; i++) {
      const r = raw[i], n = norm[i];
      const flag = (r?.admin === "admin" || r?.admin === "superadmin" ||
                    n?.admin === "admin" || n?.admin === "superadmin");
      if (flag) {
        [r?.id, r?.jid, n?.id].forEach(x => {
          const d = DIGITS(x || "");
          if (d) adminNums.add(d);
        });
      }
    }
    return adminNums.has(number);
  } catch { return false; }
}

const handler = async (msg, { conn, args }) => {
  const chatId    = msg.key.remoteJid;
  const senderId  = msg.key.participant || msg.key.remoteJid;
  const senderNum = DIGITS(senderId);
  const isGroup   = chatId.endsWith("@g.us");
  const isFromMe  = !!msg.key.fromMe;

  if (!isGroup) {
    return conn.sendMessage(chatId, { text: "❌ Este comando solo puede usarse en grupos." }, { quoted: msg });
  }

  const isAdmin = await isAdminByNumber(conn, chatId, senderNum);
  const isOwner = Array.isArray(global.owner) && global.owner.some(([id]) => id === senderNum);
  if (!isAdmin && !isOwner && !isFromMe) {
    return conn.sendMessage(chatId, { text: "🚫 Solo administradores u owners pueden usar este comando." }, { quoted: msg });
  }

  if (!args?.[0]) {
    return conn.sendMessage(chatId, { text: "⚙️ Usa: *abrir 10s*, *abrir 10m* o *abrir 1h* para programar la apertura." }, { quoted: msg });
  }

  const match = String(args[0]).trim().match(/^(\d+)([smh])$/i);
  if (!match) {
    return conn.sendMessage(chatId, { text: "❌ Formato incorrecto. Usa: *abrir 10s*, *abrir 10m* o *abrir 1h*." }, { quoted: msg });
  }

  const amount = parseInt(match[1], 10);
  const unit   = match[2].toLowerCase();
  const ms = unit === "s" ? amount * 1000 : unit === "m" ? amount * 60 * 1000 : unit === "h" ? amount * 60 * 60 * 1000 : 0;
  if (ms <= 0) return;

  // ✅ Guardar programación en tiempo_grupo.json
  const filePath = path.resolve("tiempo_grupo.json");
  const data = fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, "utf-8")) : {};
  if (!data[chatId]) data[chatId] = {};

  data[chatId].abrir = Date.now() + ms;
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

  await conn.sendMessage(chatId, { text: `⏳ Grupo programado para abrirse en *${amount}${unit}*.` }, { quoted: msg });
};

handler.command = ["abrir"];
module.exports = handler;
