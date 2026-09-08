import { randomInt } from "node:crypto";
import { MAX_NICKNAME_LENGTH } from "@/lib/auth/nickname-rules";

/**
 * 가입 시 넣어 주는 임의의 초기 닉네임.
 *
 * 이메일 아이디를 초기값으로 쓰지 않는다. 닉네임은 화면에 노출되는 값이라
 * 그렇게 두면 사용자가 손대기 전까지 메일 주소 앞부분이 그대로 드러난다.
 *
 * **중복을 허용한다. 신경 쓰지 않는다.** 계정의 신원은 이메일이고 닉네임은
 * 표시용이다. 조회·삭제·권한 판정은 전부 이메일이나 ID 를 키로 쓰므로 같은
 * 닉네임이 여러 개 있어도 아무것도 섞이지 않는다.
 *
 * 그래서 **꼬리번호(`졸린 다람쥐38`)를 붙이지 않는다.** 조합이 192가지뿐이라
 * 동명이인은 실제로 자주 생기며, 그것이 의도한 상태다. 숫자를 붙이는 것은
 * 유일성을 보장하지도 못하면서 신경 쓰는 척만 하는 절충이었다 —
 * 보장이 필요해지면 UNIQUE 제약과 충돌 시 재생성을 함께 넣어야 한다.
 * (닉네임을 남에게 보여 주기 시작하는 시점이 그때다. HANDOVER.md 참조)
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

  // 단어 목록이 길어져도 규칙(최대 길이)을 넘기지 않게 잘라 둔다.
  return `${adjective} ${noun}`.slice(0, MAX_NICKNAME_LENGTH);
}
