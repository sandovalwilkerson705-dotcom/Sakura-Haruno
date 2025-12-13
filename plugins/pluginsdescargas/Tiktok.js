
// comandos/tt.js — TikTok con opciones (👍 video / ❤️ documento o 1 / 2)
// Usa tu API: POST /tiktok
const axios = require("axios");

const API_BASE = process.env.API_BASE || "https://api-russell-test.ultraplus.click";
const API_KEY  = process.env.API_KEY  || "sk_732a209b-322a-47b3-8ce0-965aa13a7024";
const MAX_TIMEOUT = 25000;

const fmtSec = (s) => {
  const n = Number(s || 0);
  const h = Math.floor(n / 3600);
  const m = Math.floor((n % 3600) / 60);
  const sec = n % 60;
  return (h ? `${h}:` : "") + `${m.toString().padStart(2,"0")}:${sec.toString().padStart(2,"0")}`;
};

const pendingTT = Object.create(null);

async function getTikTokFromSky(url){
  // ✅ endpoint correcto: POST /tiktok
  const { data: res, status: http } = await axios.post(
    `${API_BASE}/tiktok`,
    { url },
    {
      headers: {
        // ✅ tu middleware acepta apikey o Authorization
        apikey: API_KEY,
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      timeout: MAX_TIMEOUT,
      validateStatus: s => s >= 200 && s < 600
    }
  );

  if (http !== 200) throw new Error(`HTTP ${http}${res?.message ? ` - ${res.message}` : ""}`);

  // ✅ formato real de tu API: { status: true, result: {...} }
  if (!res || res.status !== true || !res.result?.media?.video) {
    throw new Error(res?.message || "La API no devolvió un video válido.");
  }

  const r = res.result;

  return {
    title: r.title || "TikTok",
    author: r.author || {},
    duration: r.duration || 0,
    likes: r.stats?.likes ?? 0,
    comments: r.stats?.comments ?? 0,
    video: r.media.video,
    audio: r.media.audio || null,
    cover: r.media.cover || null,
  };
}

const handler = async (msg, { conn, args, command }) => {
  const chatId = msg.key.remoteJid;
  const text   = (args || []).join(" ");
  const pref   = (global.prefixes && global.prefixes[0]) || ".";

  if (!text) {
    return conn.sendMessage(chatId, {
      text:
`✳️ Usa:
${pref}${command} <enlace>
Ej: ${pref}${command} https://vm.tiktok.com/xxxxxx/`
    }, { quoted: msg });
  }

  const url = args[0];
  if (!/^https?:\/\//i.test(url) || !/tiktok\.com|vt\.tiktok\.com|vm\.tiktok\.com/i.test(url)) {
    return conn.sendMessage(chatId, { text: "❌ Enlace de TikTok inválido." }, { quoted: msg });
  }

  try {
    await conn.sendMessage(chatId, { react: { text: "⏱️", key: msg.key } });

    // 1) Llama a tu API
    const d = await getTikTokFromSky(url);

    const title   = d.title || "TikTok";
    const author  = (d.author && (d.author.name || d.author.username)) || "—";
    const durTxt  = d.duration ? fmtSec(d.duration) : "—";
    const likes   = d.likes ?? 0;
    const comments= d.comments ?? 0;

    const txt =
`⚡ TikTok — opciones

Elige cómo enviarlo:
👍 Video (normal)
❤️ Video como documento
— o responde: 1 = video · 2 = documento

✦ Título: ${title}
✦ Autor: ${author}
✦ Dur.: ${durTxt} • 👍 ${likes} · 💬 ${comments}
✦ Source: ${API_BASE}
────────────
🤖 Suki Bot`;

    const preview = await conn.sendMessage(chatId, { text: txt }, { quoted: msg });

    pendingTT[preview.key.id] = {
      chatId,
      url: d.video,
      caption:
`⚡ TikTok listo

✦ Título: ${title}
✦ Autor: ${author}
✦ Duración: ${durTxt}
✦ Likes: ${likes} • Comentarios: ${comments}

✦ Source: ${API_BASE}
────────────
🤖 Suki Bot`,
      quotedBase: msg
    };

    await conn.sendMessage(chatId, { react: { text: "✅", key: msg.key } });

    if (!conn._ttListener) {
      conn._ttListener = true;

      conn.ev.on("messages.upsert", async ev => {
        for (const m of ev.messages) {
          try {
            // REACCIONES
            if (m.message?.reactionMessage) {
              const { key: reactKey, text: emoji } = m.message.reactionMessage;
              const job = pendingTT[reactKey.id];
              if (job) {
                const asDoc = emoji === "❤️";
                await sendTikTok(conn, job, asDoc, m);
                delete pendingTT[reactKey.id];
              }
            }

            // RESPUESTAS 1/2
            const ctx = m.message?.extendedTextMessage?.contextInfo;
            const replyTo = ctx?.stanzaId;
            const textLow =
              (m.message?.conversation ||
               m.message?.extendedTextMessage?.text ||
               "").trim().toLowerCase();

            if (replyTo && pendingTT[replyTo]) {
              const job = pendingTT[replyTo];
              if (textLow === "1" || textLow === "2") {
                const asDoc = textLow === "2";
                await sendTikTok(conn, job, asDoc, m);
                delete pendingTT[replyTo];
              } else {
                await conn.sendMessage(job.chatId, {
                  text: "⚠️ Responde con *1* (video) o *2* (documento), o reacciona con 👍 / ❤️."
                }, { quoted: job.quotedBase });
              }
            }
          } catch (e) {
            console.error("TT listener error:", e);
          }
        }
      });
    }

  } catch (err) {
    console.error("❌ Error en tt:", err?.message || err);
    await conn.sendMessage(chatId, {
      text: `❌ *Error:* ${err?.message || "Fallo al procesar el TikTok."}`
    }, { quoted: msg });
    await conn.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
  }
};

async function sendTikTok(conn, job, asDocument, triggerMsg){
  const { chatId, url, caption, quotedBase } = job;

  await conn.sendMessage(chatId, { react: { text: asDocument ? "📁" : "🎬", key: triggerMsg.key } });

  if (asDocument) {
    await conn.sendMessage(chatId, {
      document: { url },
      mimetype: "video/mp4",
      fileName: `tiktok-${Date.now()}.mp4`
    }, { quoted: quotedBase });
  } else {
    await conn.sendMessage(chatId, {
      video: { url },
      mimetype: "video/mp4",
      caption
    }, { quoted: quotedBase });
  }

  await conn.sendMessage(chatId, { react: { text: "✅", key: triggerMsg.key } });
}

handler.command = ["tiktok","tt"];
handler.help = ["tiktok <url>", "tt <url>"];
handler.tags = ["descargas"];
handler.register = true;

module.exports = handler;
