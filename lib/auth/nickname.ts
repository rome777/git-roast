import { randomInt } from "node:crypto";
import { MAX_NICKNAME_LENGTH } from "@/lib/auth/nickname-rules";

/**
 * 가입 시 넣어 주는 임의의 초기 닉네임.
 *
 * 이메일 아이디를 초기값으로 쓰지 않는다. 닉네임은 화면에 노출되는 값이라
 * 그렇게 두면 사용자가 손대기 전까지 메일 주소 앞부분이 그대로 드러난다.
 *
 * 중복을 허용한다(닉네임에 UNIQUE 를 걸지 않는다). 계정의 신원은 이메일이고,
 * 닉네임은 표시용이다. 여기서 유일성을 요구하면 충돌 때 가입 자체가 실패한다.
 *
 * `Math.random` 대신 randomInt 를 쓴다 — 편향 없이 고르는 쪽이 맞고, 어차피
 * 이 파일은 서버에서만 돈다.
 */

const ADJECTIVES = [
  "야근하는",
  "커밋하는",
  "머지하는",
  "잠수타는",
  "새벽형",
  "리팩터링",
  "무한루프",
  "테스트없는",
  "주석없는",
  "빌드깨는",
  "포크뜨는",
  "성실한",
  "졸린",
  "배고픈",
  "겸손한",
  "느긋한",
] as const;

const NOUNS = [
  "판다",
  "코알라",
  "너구리",
  "수달",
  "펭귄",
  "다람쥐",
  "올빼미",
  "햄스터",
  "여우",
  "치타",
  "고양이",
  "물범",
] as const;

export function generateNickname(): string {
  const adjective = ADJECTIVES[randomInt(ADJECTIVES.length)];
  const noun = NOUNS[randomInt(NOUNS.length)];
  const suffix = randomInt(10, 100);

  // 단어 목록이 길어져도 규칙(최대 길이)을 넘기지 않게 잘라 둔다.
  return `${adjective} ${noun}${suffix}`.slice(0, MAX_NICKNAME_LENGTH);
}
