const fs = require("fs");
const path = require("path");

const handler = async (msg, { conn, args }) => {
  const chatId = msg.key.remoteJid;
  const sender = msg.key.participant || msg.key.remoteJid;
  const numero = sender.replace(/[^0-9]/g, "");

  await conn.sendMessage(chatId, { react: { text: "📥", key: msg.key } });

  if (args.length < 4) {
    return conn.sendMessage(chatId, {
      text: `✳️ *Uso correcto:*\n.rpg Nombre Apellido Edad FechaNacimiento\n\n📌 Ejemplo:\n.rpg wilker sandoval 15 01/08/2010`
    }, { quoted: msg });
  }

  const [nombre, apellido, edad, fechaNacimiento] = args;

  const sukirpgPath = path.join(process.cwd(), "sukirpg.json");
  let db = fs.existsSync(sukirpgPath) ? JSON.parse(fs.readFileSync(sukirpgPath)) : {};
  if (!db.usuarios) db.usuarios = [];
  if (!db.mascotas) db.mascotas = [];

  if (db.usuarios.find(u => u.numero === numero)) {
    return conn.sendMessage(chatId, {
      text: "⚠️ Ya estás registrado en el RPG. Usa `.nivel` para ver tus datos.",
      quoted: msg
    });
  }

  const steps = [
    "🧠 Procesando tu registro...",
    "🔍 Buscando tus habilidades...",
    "📜 Verificando tu fecha de nacimiento...",
    "🎒 Preparando tu cartera inicial...",
    "🐾 Asignando compañero mascota...",
    "💳 Generando tus créditos de bienvenida...",
    "✅ Registro casi completo...",
    "🎉 ¡Bienvenido al mundo RPG de *Sakura Haruno*!"
  ];

  let { key } = await conn.sendMessage(chatId, { text: steps[0] }, { quoted: msg });
  for (let i = 1; i < steps.length; i++) {
    await new Promise(r => setTimeout(r, 1050));
    await conn.sendMessage(chatId, {
      text: steps[i],
      edit: key
    }, { quoted: msg });
  }

  const habilidadesDisponibles = [
    "🔥 Fuego Interior", "⚡ Descarga Rápida", "🧊 Hielo Mental", "🌪️ Golpe de Viento",
    "💥 Explosión Controlada", "🧠 Concentración", "🌀 Vórtice Arcano", "👊 Impacto Bestial"
  ];

  const habilidad1 = habilidadesDisponibles[Math.floor(Math.random() * habilidadesDisponibles.length)];
  let habilidad2;
  do {
    habilidad2 = habilidadesDisponibles[Math.floor(Math.random() * habilidadesDisponibles.length)];
  } while (habilidad2 === habilidad1);

  // Elegir mascota aleatoria si hay disponibles
  let mascotasUsuario = [];
  let mascotaNombre = "❌ No hay mascotas en la tienda para asignar.";
  if (db.mascotas.length > 0) {
    const mascotaRandom = db.mascotas[Math.floor(Math.random() * db.mascotas.length)];
    const mascotaFormateada = {
      nombre: mascotaRandom.nombre,
      imagen: mascotaRandom.imagen,
      precio: mascotaRandom.precio,
      nivel: 1,
      habilidades: mascotaRandom.habilidades.map(h => ({ ...h }))
    };
    mascotasUsuario.push(mascotaFormateada);
    mascotaNombre = `🐾 *Mascota inicial:* ${mascotaFormateada.nombre}`;
  }

  const usuario = {
    numero,
    nombre,
    apellido,
    edad,
    fechaNacimiento,
    nivel: 1,
    creditos: Math.floor(Math.random() * 1000) + 1,
    guardado: 0,
    habilidades: [
      { nombre: habilidad1, nivel: 1 },
      { nombre: habilidad2, nivel: 1 }
    ],
    mascotas: mascotasUsuario
  };

  db.usuarios.push(usuario);
  fs.writeFileSync(sukirpgPath, JSON.stringify(db, null, 2));

  const texto = `🎉 *¡Bienvenido al RPG de Sakura Haruno!*\n\n` +
                `👤 *Nombre:* ${nombre} ${apellido}\n` +
                `📅 *Edad:* ${edad} años\n` +
                `🎂 *Fecha de Nacimiento:* ${fechaNacimiento}\n` +
                `💳 *Créditos recibidos:* ${usuario.creditos}\n` +
                `📦 *Saldo guardado:* ${usuario.guardado}\n` +
                `📈 *Nivel inicial:* ${usuario.nivel}\n\n` +
                `🌀 *Tus habilidades iniciales:*\n` +
                `1. ${habilidad1} (Nivel 1)\n` +
                `2. ${habilidad2} (Nivel 1)\n\n` +
                `${mascotaNombre}\n\n` +
                `✨ Usa:\n` +
                `- *.nivelmascota* Mira los comandos y sube de nivel tu mascota\n` +
                `- *.nivel* Mira los comandos para subir de nivel\n` +
                `- *.saldo* Para ver tu saldo disponible\n\n` +
                `¡Empieza tu aventura ahora! 🚀`;

  await conn.sendMessage(chatId, {
    image: { url: "https://cdn.russellxz.click/b0043441.jpg" },
    caption: texto
  }, { quoted: msg });

  await conn.sendMessage(chatId, {
    react: { text: "🎮", key: msg.key }
  });
};

handler.command = ["rpg"];
module.exports = handler;
