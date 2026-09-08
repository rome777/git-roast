// GitRoast 인증·권한 회귀 검증 스크립트
//
// 실행 중인 서버(기본 http://localhost:3000)에 실제 HTTP 요청을 보내
// 인증 게이트·권한 분리·데이터 격리·공유 링크가 살아 있는지 확인한다.
//
//   npm run verify:auth
//
// 주의: rome777@gmail.com 계정으로 로그인을 시도한다. 이 계정이 아직
// 레거시(mock_pw_hash) 상태라면 비밀번호가 'admin1234' 로 확정된다.
// 인증 로직을 건드린 뒤에는 반드시 이 스크립트를 다시 돌린다.

const BASE = "http://localhost:3000";
let pass = 0, fail = 0;

// 실행마다 다른 클라이언트 IP 인 척한다.
// 인증 엔드포인트에 요청량 제한이 걸려 있어, 같은 IP 로 반복 실행하면
// 2회차부터 429 가 나서 검사가 무의미해진다.
// (Vercel 은 x-forwarded-for 를 실제 클라이언트로 덮어쓰므로 운영에서는 위조 불가)
const RUN_IP = `198.51.100.${Math.floor(Math.random() * 250) + 1}`;

function check(name, cond, detail = "") {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}  ${detail}`); }
}

/**
 * 429 는 어떤 검사에서도 "기대한 실패" 로 취급하면 안 된다.
 * 요청량 제한에 걸려 401 대신 429 가 났을 뿐인데 통과로 세면,
 * 검사가 통째로 거짓 통과한다 (실제로 겪었다 — 2026-09-08).
 */
function checkStatus(name, res, expected) {
  if (res.status === 429 && expected !== 429) {
    fail++;
    console.log(`  FAIL  ${name}  요청량 제한(429)에 걸려 검사 불가 — 잠시 후 다시 실행하세요`);
    return;
  }
  check(name, res.status === expected, `status=${res.status}`);
}

async function req(path, { method = "GET", body, cookie, ip } = {}) {
  const headers = { "x-forwarded-for": ip || RUN_IP };
  if (body) headers["Content-Type"] = "application/json";
  if (cookie) headers["Cookie"] = cookie;
  const res = await fetch(BASE + path, {
    method, headers, body: body ? JSON.stringify(body) : undefined, redirect: "manual",
  });
  let json = null;
  try { json = await res.json(); } catch {}
  const setCookies = res.headers.getSetCookie?.() ?? [];
  const session = setCookies
    .map((c) => c.split(";")[0])
    .find((c) => c.startsWith("gitroast_session=") && c.length > "gitroast_session=".length);
  return { status: res.status, json, session, setCookies };
}

console.log("\n[1] 인증 없는 접근 차단");
check("GET /api/admin/evaluations -> 401", (await req("/api/admin/evaluations")).status === 401);
check("DELETE /api/admin/evaluations -> 401", (await req("/api/admin/evaluations?id=x", { method: "DELETE" })).status === 401);
check("GET /api/history -> 401", (await req("/api/history")).status === 401);
check("POST /api/history -> 401", (await req("/api/history", { method: "POST", body: { evaluation: {} } })).status === 401);
check("DELETE /api/history -> 401", (await req("/api/history", { method: "DELETE" })).status === 401);

console.log("\n[2] 쿠키 위조 차단");
const forgedLegacy = "gitroast_user=" + encodeURIComponent(JSON.stringify({ id: "x", email: "rome777@gmail.com", role: "admin" }));
check("레거시 평문 쿠키(gitroast_user) 무시 -> 401", (await req("/api/admin/evaluations", { cookie: forgedLegacy })).status === 401);
const forgedPayload = Buffer.from(JSON.stringify({ id: "x", email: "attacker@evil.com", role: "admin", iat: Date.now() })).toString("base64url");
check("서명 없는 세션 토큰 -> 401", (await req("/api/admin/evaluations", { cookie: `gitroast_session=${forgedPayload}.` })).status === 401);
check("서명 위조 세션 토큰 -> 401", (await req("/api/admin/evaluations", { cookie: `gitroast_session=${forgedPayload}.bogussignature` })).status === 401);
check("이메일 쿼리 우회(?email=) -> 401", (await req("/api/history?email=rome777@gmail.com")).status === 401);

console.log("\n[3] 비밀번호 검증");
check("짧은 비밀번호 -> 400", (await req("/api/auth/login", { method: "POST", body: { email: "rome777@gmail.com", password: "123" } })).status === 400);
check("없는 계정 -> 401", (await req("/api/auth/login", { method: "POST", body: { email: "nobody@nowhere.com", password: "whatever123" } })).status === 401);

const claim = await req("/api/auth/login", { method: "POST", body: { email: "rome777@gmail.com", password: "admin1234" } });
check("관리자 계정 정상 로그인 -> 200 + 세션 발급", claim.status === 200 && !!claim.session, `status=${claim.status}`);
const adminCookie = claim.session;

const wrongPw = await req("/api/auth/login", { method: "POST", body: { email: "rome777@gmail.com", password: "wrongpassword999" } });
check("틀린 비밀번호 -> 401", wrongPw.status === 401, `status=${wrongPw.status}`);
const rightPw = await req("/api/auth/login", { method: "POST", body: { email: "rome777@gmail.com", password: "admin1234" } });
check("맞는 비밀번호 -> 200", rightPw.status === 200, `status=${rightPw.status}`);

// 비밀번호가 설정되지 않은 시드 계정은 어떤 값으로도 로그인되면 안 된다.
// (예전에는 첫 로그인 값으로 비밀번호가 확정돼 admin@gitroast.dev 를 아무나 선점할 수 있었다.)
{
  const unsetAccounts = ["admin@gitroast.dev", "rookie@example.com"];
  const guesses = ["whatever12345", "admin1234", "password123", "adminadmin"];
  let allBlocked = true;
  const leaks = [];
  let throttled = false;
  let n = 0;
  for (const email of unsetAccounts) {
    for (const password of guesses) {
      // 시도마다 다른 IP 로 보낸다. 이 검사의 목적은 "어떤 비밀번호도 통하지 않는다" 이지
      // 요청량 제한이 아니다. 같은 IP 로 몰면 429 에 걸려 검사가 무의미해진다.
      const r = await req("/api/auth/login", {
        method: "POST", body: { email, password }, ip: "203.0.113." + (++n),
      });
      if (r.status === 200) { allBlocked = false; leaks.push(email + ' / ' + password); }
      if (r.status === 429) throttled = true;
    }
  }
  if (throttled) {
    fail++;
    console.log("  FAIL  비밀번호 미설정 계정은 어떤 값으로도 로그인 불가  요청량 제한(429)에 걸려 검사 불가");
  } else {
    check("비밀번호 미설정 계정은 어떤 값으로도 로그인 불가", allBlocked, leaks.join(", "));
  }
}

console.log("\n[4] 관리자 권한");
const adminGet = await req("/api/admin/evaluations", { cookie: adminCookie });
check("관리자 세션으로 조회 -> 200", adminGet.status === 200, `status=${adminGet.status}`);
check("관리자 응답에 stats 포함", !!adminGet.json?.stats, JSON.stringify(adminGet.json).slice(0, 120));

const dup = await req("/api/auth/signup", { method: "POST", body: { email: "rome777@gmail.com", password: "another12345" } });
check("중복 가입 -> 409", dup.status === 409, `status=${dup.status}`);
check("약한 비밀번호 가입 -> 400", (await req("/api/auth/signup", { method: "POST", body: { email: "weak@test.com", password: "123" } })).status === 400);
check("잘못된 이메일 형식 -> 400", (await req("/api/auth/signup", { method: "POST", body: { email: "notanemail", password: "goodpassword1" } })).status === 400);

const normalEmail = `tester-${Date.now()}@example.com`;
const signup = await req("/api/auth/signup", { method: "POST", body: { email: normalEmail, password: "userpassword1" } });
check("일반 회원가입 -> 201 + 세션", signup.status === 201 && !!signup.session, `status=${signup.status}`);
const userCookie = signup.session;

const userAdmin = await req("/api/admin/evaluations", { cookie: userCookie });
check("일반 사용자 -> 관리자 API 403", userAdmin.status === 403, `status=${userAdmin.status}`);
const userDel = await req("/api/admin/evaluations?id=whatever", { method: "DELETE", cookie: userCookie });
check("일반 사용자 -> 관리자 삭제 403", userDel.status === 403, `status=${userDel.status}`);

console.log("\n[5] 데이터 격리");
const userHist = await req("/api/history", { cookie: userCookie });
check("신규 사용자 히스토리 -> 200 & 빈 목록", userHist.status === 200 && userHist.json?.evaluations?.length === 0, JSON.stringify(userHist.json).slice(0, 140));
check("히스토리 소유자 = 세션 이메일", userHist.json?.email === normalEmail, String(userHist.json?.email));

const adminHist = await req("/api/history", { cookie: adminCookie });
check("관리자 히스토리 -> 본인 것만", adminHist.status === 200 && adminHist.json?.email === "rome777@gmail.com", String(adminHist.json?.email));

console.log("\n[6] 공유 링크 (DB 실조회)");
const realId = adminGet.json?.evaluations?.[0]?.id;
const shared = await req(`/api/evaluations/${encodeURIComponent(realId)}`);
check("실제 ID 공개 조회 -> 200 (비로그인)", shared.status === 200, `id=${realId} status=${shared.status}`);
check("공개 응답에 소유자 이메일 없음", !JSON.stringify(shared.json).includes("@gitroast.dev") && !JSON.stringify(shared.json).includes("rome777@gmail.com"));
check("공개 응답 id 가 요청 id 와 일치", shared.json?.evaluation?.id === realId);
const missing = await req("/api/evaluations/does-not-exist-12345");
check("없는 ID -> 404 (목업 대체 없음)", missing.status === 404, `status=${missing.status}`);

console.log("\n[7] 로그아웃");
const logout = await req("/api/auth/logout", { method: "POST", cookie: userCookie });
check("로그아웃 -> 200", logout.status === 200);
check("로그아웃 응답이 세션 쿠키 만료", logout.setCookies.some((c) => c.startsWith("gitroast_session=;") || /gitroast_session=;/.test(c)), logout.setCookies.join(" | "));

console.log("\n[8] 요청량 제한");
{
  // 제한이 없으면 비밀번호를 무한히 추측할 수 있다.
  // 실제로 운영에서 10회 연속 시도가 전부 통과하는 것을 확인했었다 (2026-09-08).
  const attackIp = "192.0.2." + (Math.floor(Math.random() * 250) + 1);
  let blockedAt = 0;
  for (let i = 1; i <= 10; i++) {
    const r = await req("/api/auth/login", {
      method: "POST",
      body: { email: "rome777@gmail.com", password: "definitelywrong" + i },
      ip: attackIp,
    });
    if (r.status === 429) { blockedAt = i; break; }
  }
  check("로그인 무차별 대입이 차단된다 (429)", blockedAt > 0,
    blockedAt === 0 ? "10회 연속 시도가 전부 통과했다" : "");

  const analyzeIp = "192.0.2." + (Math.floor(Math.random() * 250) + 1);
  let analyzeBlocked = false;
  for (let i = 1; i <= 6; i++) {
    const r = await req("/api/analyze", {
      method: "POST",
      body: { username: "zzz-no-such-user-verify", mode: "roast" },
      ip: analyzeIp,
    });
    if (r.status === 429) { analyzeBlocked = true; break; }
  }
  check("비로그인 분석 요청량이 제한된다 (429)", analyzeBlocked);
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail === 0 ? 0 : 1);
