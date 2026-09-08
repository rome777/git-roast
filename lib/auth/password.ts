import { randomBytes, scrypt as _scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(_scrypt) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number
) => Promise<Buffer>;

const KEYLEN = 64;

/**
 * 레거시 시드 값. 이 값이 저장되어 있으면 아직 비밀번호가 설정되지 않은 계정으로 본다.
 * (초기 개발 단계에서 모든 계정이 이 문자열로 저장되어 있었다.)
 */
export const LEGACY_PLACEHOLDER_HASH = "mock_pw_hash";

export function isLegacyPlaceholder(hash: string | null | undefined): boolean {
  return !hash || hash === LEGACY_PLACEHOLDER_HASH || !hash.startsWith("scrypt$");
}

/** `scrypt$<salt-hex>$<key-hex>` 형식으로 직렬화한다. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, KEYLEN);
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (isLegacyPlaceholder(stored)) return false;

  const [, saltHex, keyHex] = stored.split("$");
  if (!saltHex || !keyHex) return false;

  try {
    const expected = Buffer.from(keyHex, "hex");
    const derived = await scrypt(password, Buffer.from(saltHex, "hex"), expected.length);
    return timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

export const MIN_PASSWORD_LENGTH = 8;

export function validatePassword(password: unknown): string | null {
  if (typeof password !== "string" || !password) return "비밀번호를 입력해 주세요.";
  if (password.length < MIN_PASSWORD_LENGTH)
    return `비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.`;
  return null;
}
