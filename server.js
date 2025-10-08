import express from "express";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(cors({ origin: "*" }));

// Servir archivos estáticos (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, "public")));

// Conexión a la base de datos
const dbPromise = open({
  filename: "./Asistencia.db",
  driver: sqlite3.Database,
});

// ========== RUTAS DE API ==========

// Obtener todos los usuarios
app.get("/usuarios", async (req, res) => {
  try {
    const db = await dbPromise;
    const rows = await db.all("SELECT * FROM usuarios");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener usuarios" });
  }
});

// Agregar usuario
app.post("/usuarios", async (req, res) => {
  try {
    const { nombre, oficina } = req.body;
    const db = await dbPromise;

    let codigo;
    while (true) {
      codigo = Math.random().toString(36).substring(2, 8).toUpperCase();
      const existente = await db.get("SELECT * FROM usuarios WHERE codigo = ?", [codigo]);
      if (!existente) break;
    }

    const result = await db.run(
      "INSERT INTO usuarios (nombre, oficina, codigo) VALUES (?, ?, ?)",
      [nombre, oficina, codigo]
    );
    res.json({ id: result.lastID, nombre, oficina, codigo });
  } catch (err) {
    res.status(500).json({ error: "Error al agregar usuario" });
  }
});

// Actualizar usuario
app.put("/usuarios/:id_usuarios", async (req, res) => {
  try {
    const { id_usuarios } = req.params;
    const { nombre, oficina } = req.body;
    const db = await dbPromise;
    await db.run(
      "UPDATE usuarios SET nombre = ?, oficina = ? WHERE id_usuarios = ?",
      [nombre, oficina, id_usuarios]
    );
    res.json({ mensaje: "Usuario actualizado correctamente" });
  } catch (err) {
    res.status(500).json({ error: "Error al actualizar usuario" });
  }
});

// Eliminar usuario
app.delete("/usuarios/:id_usuarios", async (req, res) => {
  try {
    const { id_usuarios } = req.params;
    const db = await dbPromise;
    await db.run("DELETE FROM usuarios WHERE id_usuarios = ?", [id_usuarios]);
    res.json({ mensaje: "Usuario eliminado correctamente" });
  } catch (err) {
    res.status(500).json({ error: "Error al eliminar usuario" });
  }
});

// Registrar ingreso
app.post("/asistencia/ingreso", async (req, res) => {
  try {
    const { id_usuarios } = req.body;
    if (!id_usuarios) return res.status(400).json({ error: "ID obligatorio" });

    const db = await dbPromise;
    const hoy = new Date().toISOString().split("T")[0];
    const ingresoHoy = await db.get(
      "SELECT * FROM asistencia WHERE id_usuarios = ? AND DATE(fecha_entrada) = ?",
      [id_usuarios, hoy]
    );
    if (ingresoHoy) return res.status(400).json({ error: "Ya registraste tu ingreso hoy" });

    const fechaActual = new Date().toISOString();
    await db.run("INSERT INTO asistencia (id_usuarios, fecha_entrada) VALUES (?, ?)", [id_usuarios, fechaActual]);
    res.json({ mensaje: "Ingreso registrado", fecha_entrada: fechaActual });
  } catch (err) {
    res.status(500).json({ error: "Error al registrar ingreso" });
  }
});

// Registrar salida
app.post("/asistencia/salida", async (req, res) => {
  try {
    const { id_usuarios } = req.body;
    if (!id_usuarios) return res.status(400).json({ error: "ID obligatorio" });

    const db = await dbPromise;
    const asistencia = await db.get(
      "SELECT * FROM asistencia WHERE id_usuarios = ? AND fecha_salida IS NULL ORDER BY id_asistencia DESC LIMIT 1",
      [id_usuarios]
    );
    if (!asistencia) return res.status(400).json({ error: "No tienes un ingreso pendiente" });

    const fechaSalida = new Date().toISOString();
    await db.run("UPDATE asistencia SET fecha_salida = ? WHERE id_asistencia = ?", [fechaSalida, asistencia.id_asistencia]);
    res.json({ mensaje: "Salida registrada", fecha_salida: fechaSalida });
  } catch (err) {
    res.status(500).json({ error: "Error al registrar salida" });
  }
});

// Login
app.post("/login", async (req, res) => {
  try {
    const { codigo } = req.body;
    const db = await dbPromise;
    const usuario = await db.get("SELECT * FROM usuarios WHERE codigo = ?", [codigo]);
    if (!usuario) return res.status(400).json({ error: "Código incorrecto" });
    res.json(usuario);
  } catch (err) {
    res.status(500).json({ error: "Error al iniciar sesión" });
  }
});

// Puerto dinámico para Vercel
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Servidor corriendo en puerto ${PORT}`));
