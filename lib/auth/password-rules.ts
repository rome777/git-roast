/**
 * 비밀번호 규칙 — **브라우저와 서버가 함께 쓴다.**
 *
 * node:crypto 를 import 하는 password.ts 에 두면 클라이언트 컴포넌트에서 불러올 수
 * 없어 가입 폼이 규칙을 따로 베껴 적게 된다. 두 벌이 되는 순간 한쪽이 낡는다.
 * 그래서 순수 함수만 여기에 분리한다.
 */

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 200;

/**
 * **로그인 시** 쓰는 형식 검사. 길이만 본다.
 *
 * 여기에 복잡도 규칙을 넣으면 안 된다 — 규칙을 강화하는 순간 그 이전에 가입한
 * 사용자가 전부 400 을 받고 **자기 계정에서 잠긴다.** 복잡도는 비밀번호를
 * "새로 정하는" 경로(가입·변경)에서만 요구한다. validateNewPassword 를 쓸 것.
 */
export function validatePassword(password: unknown): string | null {
  if (typeof password !== "string" || !password) return "비밀번호를 입력해 주세요.";
  if (password.length < MIN_PASSWORD_LENGTH)
    return `비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.`;
  if (password.length > MAX_PASSWORD_LENGTH)
    return `비밀번호는 ${MAX_PASSWORD_LENGTH}자 이하여야 합니다.`;
  return null;
}

/**
 * 비밀번호를 새로 정할 때의 복잡도 규칙 (TECH_SPEC 4장 3번: "최소 8자, 숫자/특수문자 포함").
 *
 * 대소문자를 따로 요구하지는 않는다. 문자 종류를 늘릴수록 사용자는 규칙을 만족하는
 * 가장 짧고 뻔한 조합("Password1!")으로 수렴하는데, 그런 값은 어차피 유출 목록에
 * 들어 있어 checkPasswordNotPwned 에서 걸린다. 두 검사는 짝으로 동작한다.
 *
 * 네트워크를 타지 않는 동기 함수다. 유출 검사는 호출부에서 따로 await 한다.
 */
export function validateNewPassword(password: unknown, email?: string): string | null {
  const basic = validatePassword(password);
  if (basic) return basic;

  const pw = password as string;

  if (!/[A-Za-z가-힣]/.test(pw)) return "비밀번호에 문자를 하나 이상 포함해 주세요.";
  if (!/[0-9]/.test(pw)) return "비밀번호에 숫자를 하나 이상 포함해 주세요.";
  if (!/[^A-Za-z0-9가-힣]/.test(pw))
    return "비밀번호에 특수문자(!@#$ 등)를 하나 이상 포함해 주세요.";

  // 같은 문자 4회 이상 반복("aaaa1111!")은 길이만 채운 값이다.
  if (/(.)\1{3,}/.test(pw)) return "같은 문자를 4번 이상 반복할 수 없습니다.";

  // 이메일 아이디를 그대로 쓴 비밀번호는 계정 이름만 알면 뚫린다.
  const localPart = typeof email === "string" ? email.split("@")[0]?.trim().toLowerCase() : "";
  if (localPart && localPart.length >= 4 && pw.toLowerCase().includes(localPart))
    return "비밀번호에 이메일 아이디를 그대로 넣을 수 없습니다.";

  return null;
}

/** 가입 폼에 그대로 띄우는 규칙 안내. 서버 검사와 문구가 갈리지 않도록 여기서 관리한다. */
export const PASSWORD_RULES = [
  `${MIN_PASSWORD_LENGTH}자 이상`,
  "숫자 1개 이상",
  "특수문자 1개 이상",
  "알려진 유출 비밀번호 불가",
] as const;
