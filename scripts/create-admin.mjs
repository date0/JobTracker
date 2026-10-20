import nextEnv from "@next/env";
const { loadEnvConfig } = nextEnv;
import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";
import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";

loadEnvConfig(process.cwd());

const rl = readline.createInterface({ input: stdin, output: stdout });

function askHidden(prompt) {
  return new Promise((resolve, reject) => {
    if (!stdin.isTTY || typeof stdin.setRawMode !== "function") {
      reject(new Error("Ejecuta este script desde una terminal interactiva."));
      return;
    }

    stdout.write(prompt);
    let value = "";

    const cleanup = () => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener("data", onData);
    };

    const onData = (buffer) => {
      for (const character of buffer.toString("utf8")) {
        if (character === "\u0003") {
          cleanup();
          stdout.write("\n");
          reject(new Error("Operación cancelada."));
          return;
        }

        if (character === "\r" || character === "\n") {
          cleanup();
          stdout.write("\n");
          resolve(value);
          return;
        }

        if (character === "\u007f" || character === "\b") {
          value = value.slice(0, -1);
        } else if (character >= " ") {
          value += character;
        }
      }
    };

    stdin.setRawMode(true);
    stdin.resume();
    stdin.on("data", onData);
  });
}

let connection;

try {
  const name = (await rl.question("Nombre del administrador: ")).trim();
  const email = (await rl.question("Correo electrónico: "))
    .trim()
    .toLowerCase();

  if (!name || name.length > 150) {
    throw new Error(
      "El nombre es obligatorio y debe tener máximo 150 caracteres.",
    );
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    throw new Error("El correo electrónico no tiene un formato válido.");
  }

  const password = await askHidden("Contraseña (mínimo 12 caracteres): ");
  const confirmation = await askHidden("Confirma la contraseña: ");

  if (password.length < 12) {
    throw new Error("La contraseña debe tener al menos 12 caracteres.");
  }

  if (password !== confirmation) {
    throw new Error("Las contraseñas no coinciden.");
  }

  connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 3306),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });

  const [rows] = await connection.query("SELECT COUNT(*) AS total FROM users");

  if (Number(rows[0].total) !== 0) {
    throw new Error(
      "Ya existen usuarios. No se creará otro administrador con este script.",
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await connection.execute(
    "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'admin')",
    [name, email, passwordHash],
  );

  console.log("Primer administrador creado correctamente.");
} catch (error) {
  console.error("No se pudo crear el administrador:", error.message);
  process.exitCode = 1;
} finally {
  if (connection) await connection.end();
  rl.close();
}
