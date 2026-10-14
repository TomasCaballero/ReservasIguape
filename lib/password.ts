import argon2 from "argon2";

// RNF-05: Argon2id con memoria >= 19 MiB e iteraciones >= 2.
const OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456, // KiB = 19 MiB
  timeCost: 2,
  parallelism: 1,
} as const;

export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, OPTIONS);
}

export function verifyPassword(hash: string, password: string): Promise<boolean> {
  return argon2.verify(hash, password);
}
