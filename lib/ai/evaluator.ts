import { GitHubAggregatedData, GitHubRepoDetailedData } from "../github/types";
import { EvaluationMode, EvaluationResult, TierLevel } from "./types";
import { generatePrompt, generateRepoPrompt } from "./prompts";
import { MOCK_EVALUATIONS } from "./mockEvaluations";

async function callGeminiApi(prompt: string, mode: EvaluationMode): Promise<any> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.includes("your-gemini")) {
    return null;
  }

  // Priority models: 2.5-flash for speed & deep reasoning, then gemini-flash-latest, then 2.5-pro
  const models = ["gemini-2.5-flash", "gemini-flash-latest", "gemini-2.5-pro"];

  for (const model of models) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: "application/json",
              temperature: mode === "roast" ? 0.85 : 0.35,
              topP: 0.95,
              maxOutputTokens: 8192,
              // 2.5 계열은 사고(thinking) 토큰도 출력 예산에서 가져간다.
              // 끄지 않으면 사고에 예산을 다 써 JSON 이 중간에 잘리고
              // "Unterminated string in JSON" 으로 실패한다.
              thinkingConfig: { thinkingBudget: 0 },
            },
          }),
        }
      );

      if (res.ok) {
        const json = await res.json();
        const candidate = json.candidates?.[0];
        const rawText = candidate?.content?.parts?.[0]?.text || "";
        if (!rawText) continue;

        // 응답이 잘렸으면 파싱은 반드시 실패한다. 원인을 남기고 다음 모델로 넘긴다.
        if (candidate?.finishReason && candidate.finishReason !== "STOP") {
          console.warn(`Gemini ${model} 응답이 ${candidate.finishReason} 로 중단됨 - 다음 모델로 전환`);
          continue;
        }

        try {
          return JSON.parse(rawText);
        } catch {
          const jsonMatch = rawText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try {
              return JSON.parse(jsonMatch[0]);
            } catch {}
          }
          const cleanedText = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();
          try {
            return JSON.parse(cleanedText);
          } catch {
            console.warn(`Gemini ${model} JSON 파싱 실패 (길이 ${rawText.length}) - 다음 모델로 전환`);
            continue;
          }
        }
      } else {
        console.warn(`Gemini ${model} returned status ${res.status}`);
      }
    } catch (err) {
      console.warn(`Gemini ${model} request error:`, err);
    }
  }

  return null;
}

export async function evaluateGitHub(
  data: GitHubAggregatedData,
  mode: EvaluationMode
): Promise<EvaluationResult> {
  const username = data.user.login.toLowerCase();

  // 1. If explicit mock user requested
  if (MOCK_EVALUATIONS[username]?.[mode]) {
    return {
      ...MOCK_EVALUATIONS[username][mode],
      targetType: "user",
      analyzedAt: new Date().toISOString(),
    };
  }

  // 2. Call Gemini API (gemini-2.5-flash priority)
  const parsed = await callGeminiApi(generatePrompt(data, mode), mode);
  if (parsed) {
    return {
      targetType: "user",
      targetUsername: data.user.login,
      mode,
      tier: (parsed.tier || "B") as TierLevel,
      score: typeof parsed.score === "number" ? parsed.score : 70,
      title: parsed.title || "실전 개발자",
      oneLiner: parsed.oneLiner || "성실한 커밋과 프로젝트 역량이 돋보입니다.",
      summary: parsed.summary || "깃허브 활동 이력을 종합 분석한 결과입니다.",
      radarScores: parsed.radarScores || {
        commitActivity: 65,
        documentation: 55,
        stackDiversity: 70,
        codePopularity: 45,
        consistency: 60,
      },
      highlights: Array.isArray(parsed.highlights)
        ? parsed.highlights
        : ["꾸준한 커밋 패턴", "다양한 리포지토리 구성", "실전 문제 해결"],
      recommendations: Array.isArray(parsed.recommendations)
        ? parsed.recommendations
        : ["상세한 README 작성 권장", "커밋 메시지 규칙 준수", "대표 프로젝트 배포"],
      riskFactor: parsed.riskFactor || "포트폴리오 고도화 필요",
      analyzedAt: new Date().toISOString(),
      isMock: false,
    };
  }

  // 3. Fallback Dynamic Generator
  return generateDynamicEvaluation(data, mode);
}

function generateDynamicEvaluation(
  data: GitHubAggregatedData,
  mode: EvaluationMode
): EvaluationResult {
  const stars = data.totalStars;
  const repos = data.user.public_repos;
  const followers = data.user.followers;

  let tier: TierLevel = "B";
  let score = 70;

  if (stars > 5000 || followers > 3000) {
    tier = "SSS";
    score = 98;
  } else if (stars > 1000 || followers > 1000) {
    tier = "SS";
    score = 93;
  } else if (stars > 300 || followers > 300) {
    tier = "S";
    score = 88;
  } else if (stars > 50 || repos > 20) {
    tier = "A";
    score = 82;
  } else if (repos > 8) {
    tier = "B";
    score = 72;
  } else if (repos > 3) {
    tier = "C";
    score = 58;
  } else {
    tier = "D";
    score = 44;
  }

  const primaryLang = Object.keys(data.languages)[0] || "코드";

  if (mode === "roast") {
    return {
      targetType: "user",
      targetUsername: data.user.login,
      mode: "roast",
      tier,
      score,
      title: `${primaryLang} 늪에 빠진 밤샘 코딩 러너`,
      oneLiner: `공개 리포지토리 ${repos}개 중 실제 돌아가는 프로젝트가 몇 개인지 본인도 모름.`,
      summary: `잔디밭에 푸른빛이 돌긴 하지만 'fix'와 'update'로 점철된 고난의 흔적이 역력합니다. 스타 ${stars}개로 스타 갈증에 시달리고 있으며, README는 언제나 '작성 중...' 상태로 영원히 박제되어 있습니다.`,
      radarScores: {
        commitActivity: Math.min(95, Math.max(25, repos * 6)),
        documentation: Math.min(85, Math.max(20, repos * 4)),
        stackDiversity: Math.min(90, Math.max(30, Object.keys(data.languages).length * 20)),
        codePopularity: Math.min(100, Math.max(10, stars * 2)),
        consistency: Math.min(90, Math.max(30, 50 + repos * 2)),
      },
      highlights: [
        `커밋 메시지의 절반이 'fix', 'test', '제발' 같은 참회록`,
        `주력 언어 ${primaryLang}로 시작했으나 끝맺지 못한 미완성 프로젝트 다수`,
        `README에 GIF 캡처 한 장 없이 텍스트 세 줄로 퉁치는 당당함`,
      ],
      recommendations: [
        `새 리포지토리 파지 말고 기존에 만들다 만 프로젝트 하나라도 끝까지 배포하기`,
        `커밋 메시지 쓸 때 최소한 어디를 고쳤는지 영어나 한국어로 명확히 적기`,
        `스타 구걸하지 말고 라이브 데모 URL을 리포지토리 'About'에 등록하기`,
      ],
      riskFactor: "주니어 개발자 서류 심사 시 광탈 위험도 74%",
      analyzedAt: new Date().toISOString(),
      isMock: true,
    };
  } else {
    return {
      targetType: "user",
      targetUsername: data.user.login,
      mode: "review",
      tier,
      score,
      title: `${primaryLang} 중심의 실무 지향적 엔지니어`,
      oneLiner: `${primaryLang} 기반의 꾸준한 기술 탐색과 프로젝트 실습 역량이 돋보이는 프로필.`,
      summary: `공개 리포지토리 ${repos}개와 ${stars}개의 스타를 기록하며 착실하게 소프트웨어 개발 경험을 축적하고 있습니다. 기술 스택의 깊이를 다지고 프로젝트 문서화(Architecture, Troubleshooting)를 보강한다면 더욱 매력적인 기술 포트폴리오가 될 것입니다.`,
      radarScores: {
        commitActivity: Math.min(95, Math.max(40, repos * 7)),
        documentation: Math.min(85, Math.max(35, repos * 5)),
        stackDiversity: Math.min(90, Math.max(40, Object.keys(data.languages).length * 22)),
        codePopularity: Math.min(100, Math.max(25, stars * 3)),
        consistency: Math.min(90, Math.max(45, 60 + repos * 2)),
      },
      highlights: [
        `${primaryLang} 생태계를 중심으로 한 일관성 있는 프로젝트 빌드업`,
        `적극적인 오픈소스 활동 및 다양한 실험적 리포지토리 운영`,
        `지속적인 커밋 주기와 성실한 학습 루틴`,
      ],
      recommendations: [
        `대표 프로젝트를 상단에 고정(Pin)하고 아키텍처 다이어그램 및 시연 GIF 추가`,
        `Git Conventional Commits 컨벤션을 표준화하여 전문성 강조`,
        `성능 최적화 또는 문제 해결 과정(Troubleshooting)을 기술 블로그나 README에 정리`,
      ],
      riskFactor: "포트폴리오 내 대표 킬러 프로젝트의 시각적 강조 필요",
      analyzedAt: new Date().toISOString(),
      isMock: true,
    };
  }
}

export async function evaluateGitHubRepo(
  data: GitHubRepoDetailedData,
  mode: EvaluationMode
): Promise<EvaluationResult> {
  const repoMeta = {
    owner: data.owner.login,
    name: data.name,
    fullName: data.full_name,
    htmlUrl: data.html_url,
    stars: data.stargazers_count,
    forks: data.forks_count,
    openIssues: data.open_issues_count,
    primaryLanguage: data.language || "Unknown",
    license: data.license,
    defaultBranch: data.default_branch,
    targetFile: data.targetFile?.name,
    hasReadme: data.hasReadme,
    hasSpec: data.hasSpecOrDocs,
    hasTests: data.hasTests,
  };

  const radarLabels = {
    commitActivity: "아키텍처",
    documentation: "문서화(SPEC)",
    stackDiversity: "커밋 관리",
    codePopularity: "스타/인지도",
    consistency: "테스트/유지보수",
  };

  // Call Gemini API (gemini-2.5-flash priority)
  const parsed = await callGeminiApi(generateRepoPrompt(data, mode), mode);
  if (parsed) {
    return {
      targetType: "repo",
      targetUsername: data.full_name,
      mode,
      tier: (parsed.tier || "B") as TierLevel,
      score: typeof parsed.score === "number" ? parsed.score : 75,
      title: parsed.title || "실무형 오픈소스 리포지토리",
      oneLiner: parsed.oneLiner || "프로젝트 아키텍처와 구현 완성도가 반영된 분석 결과입니다.",
      summary: parsed.summary || "리포지토리 구조, 패키지 의존성, 커밋 이력을 종합한 심층 기술 진단 결과입니다.",
      radarScores: parsed.radarScores || {
        commitActivity: 65,
        documentation: 80,
        stackDiversity: 70,
        codePopularity: 40,
        consistency: 60,
      },
      radarLabels,
      highlights: Array.isArray(parsed.highlights)
        ? parsed.highlights
        : ["체계적인 디렉토리 구조", "적절한 기술 스택 선정", "문서화 구성"],
      recommendations: Array.isArray(parsed.recommendations)
        ? parsed.recommendations
        : ["단위 테스트 작성", "CI/CD 자동 빌드 구축", "라이브 데모 링크 등록"],
      riskFactor: parsed.riskFactor || "프로덕션 배포 전 보완 필요",
      repoMeta,
      analyzedAt: new Date().toISOString(),
      isMock: false,
    };
  }

  // Fallback dynamic repo evaluation
  return generateDynamicRepoEvaluation(data, mode, repoMeta, radarLabels);
}

function generateDynamicRepoEvaluation(
  data: GitHubRepoDetailedData,
  mode: EvaluationMode,
  repoMeta: any,
  radarLabels: any
): EvaluationResult {
  const stars = data.stargazers_count;
  const hasSpec = data.hasSpecOrDocs;
  const hasTests = data.hasTests;
  const targetFileName = data.targetFile?.name || (hasSpec ? "SPEC.md" : "README.md");

  let tier: TierLevel = "B";
  let score = 75;

  if (stars > 10000) {
    tier = "SSS";
    score = 98;
  } else if (stars > 2000) {
    tier = "SS";
    score = 92;
  } else if (stars > 500) {
    tier = "S";
    score = 86;
  } else if (stars > 50 || (hasSpec && hasTests)) {
    tier = "A";
    score = 80;
  } else if (hasSpec || data.files.length > 5) {
    tier = "B";
    score = 74;
  } else if (stars > 0) {
    tier = "C";
    score = 62;
  } else {
    tier = "D";
    score = 52;
  }

  // Check Co-Author
  const aiCoAuthor = data.recentCommits.some((c) =>
    c.coAuthorNames.some((name) => /claude|copilot|chatgpt|openai/i.test(name))
  );

  if (mode === "roast") {
    const aiRoastHighlight = aiCoAuthor
      ? "커밋마다 Co-Authored-By: Claude Opus가 박혀 있어 사실상 AI가 멱살 잡고 끌고 가는 프로젝트"
      : "테스트 코드는 0줄이지만 로컬에서 '잘 돌아가니 OK'라는 기적의 낙관주의";

    return {
      targetType: "repo",
      targetUsername: data.full_name,
      mode: "roast",
      tier,
      score,
      title: hasSpec
        ? `${targetFileName}만 NASA급인 AI 외주형 프로토타입`
        : "스타 0개의 쓸쓸함을 간직한 비밀 연구소",
      oneLiner: `${targetFileName} 기획서는 우주선 발사할 기세인데, 정작 테스트 코드는 한 줄도 없는 기적의 밸런스!`,
      summary: `루트 디렉토리에 ${data.files.map((f) => f.name).slice(0, 5).join(", ")} 등 온갖 파일이 즐비하지만, 프로덕션 배포 시 터질 시한폭탄들이 곳곳에 도사리고 있습니다. 스타 수는 ${stars}개로 본인조차 북마크 안 누른 듯한 외로운 저장소입니다.`,
      radarScores: {
        commitActivity: 68,
        documentation: hasSpec ? 92 : 45,
        stackDiversity: 74,
        codePopularity: Math.min(100, Math.max(10, stars * 5)),
        consistency: hasTests ? 85 : 30,
      },
      radarLabels,
      highlights: [
        aiRoastHighlight,
        `${targetFileName} 문서는 대기업 기획서 수준이나, 자동화 테스트(CI/CD)는 외면`,
        `커밋 메시지가 '배포 버튼 캐시버스팅', '제발 돼라' 등 참회록에 가까움`,
      ],
      recommendations: [
        "기획서만 늘리지 말고 Jest나 Pytest 단위 테스트 코드 딱 5개만 짜보기",
        "README에 실제 배포된 라이브 서비스 링크(데모 URL)와 동작 GIF 첨부하기",
        "Claude에게 코드 다 짜달라고 하지 말고 본인 손으로 에러 로그 분석해 보기",
      ],
      riskFactor: "테스트 코드 0줄로 인한 금요일 퇴근 전 배포 시 폭발 위험도 94%",
      repoMeta,
      analyzedAt: new Date().toISOString(),
      isMock: true,
    };
  } else {
    return {
      targetType: "repo",
      targetUsername: data.full_name,
      mode: "review",
      tier,
      score,
      title: "기획과 기술 명세가 탄탄하게 구조화된 풀스택 프로토타입",
      oneLiner: `${targetFileName} 기반의 명확한 요구사항 정의와 경량 아키텍처가 돋보이는 실무형 리포지토리.`,
      summary: `주력 언어 ${data.language || "HTML/JS"}를 바탕으로 ${data.files.length}개의 핵심 모듈을 빠르게 조립하여 동작 가능한 MVP를 구축했습니다. 상세한 명세서(${targetFileName})를 갖춘 점이 매우 우수하며, 테스트 자동화와 에러 핸들링을 보완한다면 상용 수준의 프로젝트로 거듭날 것입니다.`,
      radarScores: {
        commitActivity: 75,
        documentation: hasSpec ? 95 : 60,
        stackDiversity: 80,
        codePopularity: Math.min(100, Math.max(20, stars * 8)),
        consistency: hasTests ? 88 : 55,
      },
      radarLabels,
      highlights: [
        `${targetFileName} 등 체계적인 기능 명세 및 시스템 아키텍처 문서화`,
        `AI 도구(Claude 등)와 협업하여 빠른 프로토타이핑 및 기능 구현 달성`,
        `모듈형 스크립트 구성 및 가벼운 번들링 전략 채택`,
      ],
      recommendations: [
        "GitHub Actions 워크플로우를 추가하여 PR 시 자동 린트 및 단위 테스트 파이프라인 구축",
        "API 실패 및 네트워크 타임아웃 시의 클라이언트 예외 처리 UX 보강",
        "아키텍처 다이어그램 및 시연 캡처를 README.md에 포함하여 포트폴리오 가치 극대화",
      ],
      riskFactor: "프로덕션 전환 시 E2E 테스트 및 배포 자동화 파이프라인 필요",
      repoMeta,
      analyzedAt: new Date().toISOString(),
      isMock: true,
    };
  }
}
