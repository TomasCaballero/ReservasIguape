import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

// Almacenamiento de comprobantes de pago (RF-55). En desarrollo se guardan en una
// carpeta local fuera de `public`; se leen solo a través de una ruta con sesión de admin.
// La interfaz permite cambiarlo más adelante por Supabase Storage sin tocar el resto.

export type ReceiptStorage = {
  /** Guarda el archivo y devuelve la clave con la que se lo recupera. */
  save(bytes: Buffer, extension: string): Promise<string>;
  read(key: string): Promise<Buffer>;
  remove(key: string): Promise<void>;
};

const KEY = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|jpg|png)$/;

/** Las claves son un UUID generado acá (nunca el nombre del usuario): no hay recorrido de rutas. */
export function localReceiptStorage(
  root: string = process.env.RECEIPTS_DIR ?? path.join(process.cwd(), "storage", "receipts"),
): ReceiptStorage {
  const resolve = (key: string) => {
    if (!KEY.test(key)) throw new Error("Clave de comprobante inválida");
    return path.join(root, key);
  };
  return {
    async save(bytes, extension) {
      const key = `${randomUUID()}.${extension}`;
      await mkdir(root, { recursive: true });
      await writeFile(resolve(key), bytes);
      return key;
    },
    async read(key) {
      return readFile(resolve(key));
    },
    async remove(key) {
      await rm(resolve(key), { force: true });
    },
  };
}
