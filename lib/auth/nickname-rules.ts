/**
 * 닉네임 규칙 — **브라우저와 서버가 함께 쓴다.**
 *
 * password-rules.ts 와 같은 이유로 분리한다: node:crypto 를 import 하는 모듈에 두면
 * 클라이언트 폼이 규칙을 따로 베껴 적게 되고, 두 벌이 되는 순간 한쪽이 낡는다.
 */

export const MIN_NICKNAME_LENGTH = 2;
export const MAX_NICKNAME_LENGTH = 20;

/** 한글(조합/낱자)·영문·숫자와 공백, `-`, `_` 만 허용한다. `@` 가 빠져 이메일은 자동으로 걸린다. */
const ALLOWED_RE = /^[가-힣ㄱ-ㅎㅏ-ㅣa-zA-Z0-9 _-]+$/;

/**
 * 사칭 금지어. 닉네임은 화면에 그대로 노출되므로 운영진을 자칭하는 이름을 막는다.
 * 공백·기호를 지운 뒤 비교하므로 "a d m i n" 같은 우회도 걸린다.
 */
const RESERVED = ["admin", "administrator", "gitroast", "관리자", "운영자", "깃로스트"];

/** 앞뒤 공백을 떼고 연속 공백을 하나로 줄인다. 저장 전과 검사 전 모두 이 값을 쓴다. */
export function normalizeNickname(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.trim().replace(/\s+/g, " ");
}

export function validateNickname(raw: unknown): string | null {
  const nickname = normalizeNickname(raw);
  if (!nickname) return "닉네임을 입력해 주세요.";

  // 허용 문자가 모두 BMP 안의 단일 코드 유닛이라 length 로 세도 글자 수와 같다.
  // (이모지처럼 서로게이트 쌍인 문자는 아래 ALLOWED_RE 에서 어차피 걸린다.)
  if (nickname.length < MIN_NICKNAME_LENGTH)
    return `닉네임은 ${MIN_NICKNAME_LENGTH}자 이상이어야 합니다.`;
  if (nickname.length > MAX_NICKNAME_LENGTH)
    return `닉네임은 ${MAX_NICKNAME_LENGTH}자 이하여야 합니다.`;

  if (!ALLOWED_RE.test(nickname))
    return "닉네임에는 한글·영문·숫자와 공백, - _ 만 쓸 수 있습니다.";

  const squashed = nickname.toLowerCase().replace(/[\s_-]/g, "");
  if (RESERVED.some((word) => squashed.includes(word)))
    return "운영진을 사칭할 수 있는 닉네임은 사용할 수 없습니다.";

  return null;
}

/** 설정 폼에 그대로 띄우는 안내. 서버 검사와 문구가 갈리지 않도록 여기서 관리한다. */
export const NICKNAME_RULES = [
  `${MIN_NICKNAME_LENGTH}~${MAX_NICKNAME_LENGTH}자`,
  "한글·영문·숫자와 공백, - _",
  "운영진 사칭 금지",
] as const;
