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
  const email = (await rl.question("Correo del administrador: "))
    .trim()
    .toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("El correo electrónico no tiene un formato válido.");
  }

  const password = await askHidden("Nueva contraseña (mínimo 12 caracteres): ");
  const confirmation = await askHidden("Confirma la nueva contraseña: ");

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

  const [result] = await connection.execute(
    "UPDATE users SET password_hash = ? WHERE email = ? AND role = 'admin'",
    [await bcrypt.hash(password, 12), email],
  );

  if (result.affectedRows !== 1) {
    throw new Error(
      "No se encontró exactamente un administrador con ese correo.",
    );
  }

  console.log("Contraseña del administrador actualizada correctamente.");
} catch (error) {
  console.error("No se pudo cambiar la contraseña:", error.message);
  process.exitCode = 1;
} finally {
  if (connection) await connection.end();
  rl.close();
}
