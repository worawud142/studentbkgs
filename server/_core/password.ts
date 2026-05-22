import { randomBytes, pbkdf2Sync, timingSafeEqual } from "crypto";

const PASSWORD_ALGORITHM = "pbkdf2";
const PASSWORD_ITERATIONS = 120_000;
const PASSWORD_KEY_LENGTH = 64;
const PASSWORD_DIGEST = "sha256";

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = pbkdf2Sync(
    password,
    salt,
    PASSWORD_ITERATIONS,
    PASSWORD_KEY_LENGTH,
    PASSWORD_DIGEST
  ).toString("hex");

  return [
    PASSWORD_ALGORITHM,
    PASSWORD_ITERATIONS.toString(),
    salt,
    hash,
  ].join("$");
}

export function verifyPassword(password: string, storedHash: string | null | undefined): boolean {
  if (!storedHash) return false;

  const [algorithm, iterationsText, salt, hash] = storedHash.split("$");
  if (
    algorithm !== PASSWORD_ALGORITHM ||
    !iterationsText ||
    !salt ||
    !hash
  ) {
    return false;
  }

  const iterations = Number(iterationsText);
  if (!Number.isFinite(iterations) || iterations <= 0) return false;

  const computed = pbkdf2Sync(
    password,
    salt,
    iterations,
    Buffer.from(hash, "hex").length,
    PASSWORD_DIGEST
  );
  const expected = Buffer.from(hash, "hex");

  return expected.length === computed.length && timingSafeEqual(expected, computed);
}
