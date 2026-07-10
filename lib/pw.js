import { createHash, randomUUID } from "node:crypto";

// 아이템 패스워드: 행별 랜덤 솔트로 섞어 'salt:sha256(salt+pw)'로 저장/검증.
export function hashPw(pw) {
  const salt = randomUUID().replace(/-/g, "").slice(0, 12);
  const h = createHash("sha256").update(salt + ":" + pw).digest("hex");
  return salt + ":" + h;
}

export function verifyPw(pw, stored) {
  if (!stored) return false;
  const [salt, h] = stored.split(":");
  return createHash("sha256").update(salt + ":" + pw).digest("hex") === h;
}
