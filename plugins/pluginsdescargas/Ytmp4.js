// comandos/ytmp4.js — Sky API (video) + banner estilo Suki
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { pipeline } = require("stream");
const { promisify } = require("util");
const streamPipeline = promisify(pipeline);

const API_BASE = process.env.API_BASE || "https://api-sky.ultraplus.click";
const API_KEY  = process.env.API_KEY  || "Russellxz"; // tu key
const MAX_MB   = 99;

const isYouTube = (u="") =>
  /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be|music\.youtube\.com)\//i.test(u);

const fmtSec = (s) => {
  const n = Number(s || 0);
  const h = Math.floor(n / 3600);
  const m = Math.floor((n % 3600) / 60);
  const sec = n % 60;
  return (h ? `${h}:` : "") + `${m.toString().padStart(2,"0")}:${sec.toString().padStart(2,"0")}`;
};

const handler = async (msg, { conn, text, usedPrefix, command }) => {
  const chatId = msg.key.remoteJid;
  const pref = (global.prefixes && global.prefixes[0]) || usedPrefix || ".";

  if (!text || !isYouTube(text)) {
    return conn.sendMessage(chatId, {
      text:
`✳️ 𝙐𝙨𝙤 𝙘𝙤𝙧𝙧𝙚𝙘𝙩𝙤:
${pref}${command} <enlace de YouTube>

📌 𝙀𝙟𝙚𝙢𝙥𝙡𝙤:
${pref}${command} https://youtube.com/watch?v=abc123`
    }, { quoted: msg });
  }

  await conn.sendMessage(chatId, { react: { text: "⏳", key: msg.key } });

  try {
    // 1) Llamar a tu Sky API (formato video)
    const { data: api, status: http } = await axios.get(
      `${API_BASE}/api/download/yt.php`,
      {
        params: { url: text, format: "video" },
        headers: { Authorization: `Bearer ${API_KEY}` },
        timeout: 35000,
        validateStatus: s => s >= 200 && s < 600
      }
    );

    if (http !== 200 || !api || api.status !== "true" || !api.data?.video) {
      const errMsg = api?.error || `HTTP ${http}`;
      throw new Error(`No se pudo obtener el video (${errMsg}).`);
    }

    const d = api.data;
    const title = d.title || "YouTube Video";
    const durationTxt = d.duration ? fmtSec(d.duration) : "—";
    const thumb = d.thumbnail || "";
    const videoUrl = String(d.video);

    // 2) Banner informativo (Suki futurista) con source Sky
    await conn.sendMessage(chatId, {
      image: thumb ? { url: thumb } : undefined,
      caption:
`⚡ 𝗬𝗼𝘂𝗧𝘂𝗯𝗲 — 𝗩𝗶𝗱𝗲𝗼 𝗲𝗻 𝗣𝗿𝗼𝗰𝗲𝘀𝗼

✦ 𝗧𝗶́𝘁𝘂𝗹𝗼: ${title}
✦ 𝗗𝘂𝗿𝗮𝗰𝗶𝗼́𝗻: ${durationTxt}
✦ 𝗦𝗼𝘂𝗿𝗰𝗲: api-sky.ultraplus.click

✨ Preparando MP4…`,
      mimetype: "image/jpeg"
    }, { quoted: msg });

    // 3) Descarga temporal (1 solo archivo)
    const tmpDir = path.resolve("./tmp");
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const filePath = path.join(tmpDir, `yt-${Date.now()}.mp4`);

    const dl = await axios.get(videoUrl, {
      responseType: "stream",
      timeout: 120000,
      headers: { "User-Agent": "Mozilla/5.0" },
      validateStatus: s => s >= 200 && s < 400
    });

    await streamPipeline(dl.data, fs.createWriteStream(filePath));

    const sizeMB = fs.statSync(filePath).size / (1024 * 1024);
    if (sizeMB > MAX_MB) {
      fs.unlinkSync(filePath);
      return conn.sendMessage(chatId, {
        text:
`🚫 𝗔𝗿𝗰𝗵𝗶𝘃𝗼 𝗱𝗲𝗺𝗮𝘀𝗶𝗮𝗱𝗼 𝗽𝗲𝘀𝗮𝗱𝗼
📦 Tamaño: ${sizeMB.toFixed(2)} MB
🔒 Límite: ${MAX_MB} MB`
      }, { quoted: msg });
    }

    // 4) Enviar el video con caption Suki
    const caption =
`⚡ 𝗬𝗼𝘂𝗧𝘂𝗯𝗲 𝗩𝗶𝗱𝗲𝗼 — 𝗟𝗶𝘀𝘁𝗼

✦ 𝗧𝗶́𝘁𝘂𝗹𝗼: ${title}
✦ 𝗗𝘂𝗿𝗮𝗰𝗶𝗼́𝗻: ${durationTxt}
✦ 𝗦𝗼𝘂𝗿𝗰𝗲: api-sky.ultraplus.click

🤖 𝙎𝙪𝙠𝙞 𝘽𝙤𝙩`;

    await conn.sendMessage(chatId, {
      video: fs.readFileSync(filePath),
      mimetype: "video/mp4",
      fileName: `${title}.mp4`,
      caption
    }, { quoted: msg });

    fs.unlinkSync(filePath);
    await conn.sendMessage(chatId, { react: { text: "✅", key: msg.key } });

  } catch (err) {
    console.error("❌ Error en ytmp4 (Sky):", err?.message || err);
    await conn.sendMessage(chatId, {
      text: `❌ *Error al procesar el video:* ${err?.message || "Fallo desconocido."}`
    }, { quoted: msg });
    await conn.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
  }
};

handler.command = ["ytmp4","ytv"];
handler.help    = ["ytmp4 <enlace>","ytv <enlace>"];
handler.tags    = ["descargas"];
handler.register = true;

module.exports = handler;
