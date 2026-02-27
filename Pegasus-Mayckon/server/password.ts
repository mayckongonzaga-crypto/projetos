import bcrypt from "bcryptjs";

const BCRYPT_ROUNDS = 12;
const BCRYPT_HASH_REGEX = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;

export function isBcryptHash(value: string): boolean {
  return BCRYPT_HASH_REGEX.test(value);
}

export async function hashPassword(plainPassword: string): Promise<string> {
  return bcrypt.hash(plainPassword, BCRYPT_ROUNDS);
}

export async function verifyPassword(
  plainPassword: string,
  storedPasswordHash: string,
): Promise<{ valid: boolean; needsRehash: boolean }> {
  if (isBcryptHash(storedPasswordHash)) {
    const valid = await bcrypt.compare(plainPassword, storedPasswordHash);
    return { valid, needsRehash: false };
  }

  const valid = plainPassword === storedPasswordHash;
  return { valid, needsRehash: valid };
}