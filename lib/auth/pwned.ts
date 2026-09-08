import { createHash } from "node:crypto";

/**
 * 유출 비밀번호 검사 (Have I Been Pwned — Pwned Passwords).
 *
 * **비밀번호를 외부로 보내지 않는다.** k-익명성(k-anonymity) 방식이라
 * SHA-1 해시의 앞 5자리만 보내고, 돌아온 후보 목록에서 나머지 35자리를
 * 우리 쪽에서 대조한다. HIBP 는 우리가 무엇을 물었는지 알 수 없다.
 *
 * 참고: https://haveibeenpwned.com/API/v3#PwnedPasswords
 */

const RANGE_URL = "https://api.pwnedpasswords.com/range/";
const TIMEOUT_MS = 2500;

export interface PwnedVerdict {
  /** 조회에 성공했는가. false 면 count 는 의미가 없다(네트워크 실패 등). */
  checked: boolean;
  /** 유출 데이터셋에서 이 비밀번호가 관측된 횟수. 0 이면 미발견. */
  count: number;
}

/** 이 횟수를 **초과**하면 거부한다. 기본 0 = 한 번이라도 유출됐으면 거부. */
function threshold(): number {
  const raw = process.env.PWNED_MAX_COUNT;
  if (!raw) return 0;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function isPwnedCheckEnabled(): boolean {
  return process.env.DISABLE_PWNED_CHECK !== "true";
}

export async function countPwned(password: string): Promise<PwnedVerdict> {
  if (!isPwnedCheckEnabled()) return { checked: false, count: 0 };

  const sha1 = createHash("sha1").update(password, "utf8").digest("hex").toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);

  try {
    const res = await fetch(RANGE_URL + prefix, {
      // 응답 길이로 요청 내용을 추측하는 것까지 막는다.
      headers: { "Add-Padding": "true", "User-Agent": "GitRoast-password-check" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) return { checked: false, count: 0 };

    const body = await res.text();
    for (const line of body.split("\n")) {
      const [hashSuffix, countRaw] = line.trim().split(":");
      if (hashSuffix === suffix) {
        const count = Number.parseInt(countRaw ?? "0", 10);
        // 패딩으로 끼워 넣은 가짜 항목은 count 가 0 이다.
        return { checked: true, count: Number.isFinite(count) ? count : 0 };
      }
    }
    return { checked: true, count: 0 };
  } catch {
    // 조회 실패는 통과시킨다(fail-open).
    //
    // 여기서 막으면 HIBP 가 잠깐 죽는 순간 아무도 가입할 수 없다.
    // 유출 검사는 복잡도 규칙 위에 얹는 **추가** 방어선이지 유일한 방어선이 아니므로,
    // 가용성을 택한다. 대신 조용히 넘어가지 않고 로그를 남긴다.
    return { checked: false, count: 0 };
  }
}

/**
 * 유출된 비밀번호면 사용자에게 보여줄 문구를, 아니면 null 을 돌려준다.
 * 조회에 실패한 경우에도 null(통과)이다 — 위 fail-open 설명 참조.
 */
export async function checkPasswordNotPwned(password: string): Promise<string | null> {
  const verdict = await countPwned(password);

  if (!verdict.checked) {
    if (isPwnedCheckEnabled()) {
      console.warn("[pwned] 유출 검사를 수행하지 못했습니다 — 이번 요청은 통과시킵니다.");
    }
    return null;
  }

  if (verdict.count > threshold()) {
    return (
      `이 비밀번호는 알려진 유출 목록에 ${verdict.count.toLocaleString("ko-KR")}회 등장합니다. ` +
      "다른 비밀번호를 사용해 주세요."
    );
  }
  return null;
}
