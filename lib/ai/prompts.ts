import { GitHubAggregatedData, GitHubRepoDetailedData } from "../github/types";
import { EvaluationMode } from "./types";

export function generatePrompt(data: GitHubAggregatedData, mode: EvaluationMode): string {
  const repoSummary = data.recentRepos
    .map(
      (r) =>
        `- ${r.name} (${r.language || "Unknown"}, ⭐${r.stargazers_count}, 🍴${r.forks_count}): ${
          r.description || "설명 없음"
        } [README ${r.has_readme ? "있음" : "없음"}]`
    )
    .join("\n");

  const langSummary = Object.entries(data.languages)
    .map(([lang, pct]) => `${lang}: ${pct}%`)
    .join(", ");

  const commitSummary = data.commitPatterns.sampleCommitMessages.length
    ? data.commitPatterns.sampleCommitMessages.slice(0, 8).join(", ")
    : "커밋 메시지 정보 없음";

  if (mode === "roast") {
    return `
당신은 전 세계에서 가장 까칠하고 냉철하며 촌철살인의 유머 감각을 가진 20년 차 수석 개발자입니다.
다음 GitHub 계정 활동 데이터를 분석하고, 뼈를 때리는 유쾌한 [매운맛 팩폭(Roast)] 리뷰를 작성하세요.
절대 인격 모독이나 비속어를 쓰지 말고, 개발자 문화, 잔디밭, 커밋 메시지 패턴, README 방치, 튜토리얼 찌꺼기 등을 위트 있게 풍자하세요.

[GitHub 데이터]
- 사용자명: ${data.user.login} (${data.user.name || "이름 미등록"})
- 소개(Bio): ${data.user.bio || "소개 없음"}
- 공개 리포 수: ${data.user.public_repos}개 / 팔로워: ${data.user.followers}명
- 총 스타: ${data.totalStars}개 / 총 포크: ${data.totalForks}개
- 주요 사용 언어: ${langSummary || "미상"}
- 최근 커밋 메시지 샘플: ${commitSummary}
- 주요 리포지토리 목록:
${repoSummary}

[출력 형식 - 반드시 유효한 JSON 형식으로만 출력할 것]:
{
  "tier": "SSS" | "SS" | "S" | "A" | "B" | "C" | "D" | "F",
  "score": number (0~100 사이 정수),
  "title": "한 줄로 요약한 별명 (예: 사막화 진행 중인 튜토리얼 묘지기)",
  "oneLiner": "가장 뼈를 때리는 핵심 팩폭 한 줄 (50자 내외)",
  "summary": "깃허브 상태를 풍자하는 디테일한 팩폭 총평 (2~3문장)",
  "radarScores": {
    "commitActivity": number (0~100),
    "documentation": number (0~100),
    "stackDiversity": number (0~100),
    "codePopularity": number (0~100),
    "consistency": number (0~100)
  },
  "highlights": [
    "팩폭 포인트 1",
    "팩폭 포인트 2",
    "팩폭 포인트 3"
  ],
  "recommendations": [
    "현실적인 개선 조언 1",
    "현실적인 개선 조언 2",
    "현실적인 개선 조언 3"
  ],
  "riskFactor": "가상 위험도 문구 (예: 서류 탈락 광탈 위험도 88%)"
}
`;
  } else {
    return `
당신은 실리콘밸리 및 국내 탑티어 테크 기업의 시니어 테크 리드이자 기술 채용 면접관입니다.
다음 GitHub 계정 데이터를 분석하고, 채용 담당자 시선에서의 전문적이고 건설적인 [순한맛 커리어 피드백(Tech Review)]을 작성하세요.
지원자의 강점을 부각하고 실질적인 역량 향상 및 포트폴리오 차별화를 위한 팁을 제공하세요.

[GitHub 데이터]
- 사용자명: ${data.user.login} (${data.user.name || "이름 미등록"})
- 소개(Bio): ${data.user.bio || "소개 없음"}
- 공개 리포 수: ${data.user.public_repos}개 / 팔로워: ${data.user.followers}명
- 총 스타: ${data.totalStars}개 / 총 포크: ${data.totalForks}개
- 주요 사용 언어: ${langSummary || "미상"}
- 최근 커밋 메시지 샘플: ${commitSummary}
- 주요 리포지토리 목록:
${repoSummary}

[출력 형식 - 반드시 유효한 JSON 형식으로만 출력할 것]:
{
  "tier": "SSS" | "SS" | "S" | "A" | "B" | "C" | "D" | "F",
  "score": number (0~100 사이 정수),
  "title": "전문가 관점의 역량 타이틀 (예: 기본기가 탄탄한 차세대 풀스택 개발자)",
  "oneLiner": "핵심 역량 요약 한 줄 (50자 내외)",
  "summary": "기술적 강점과 성장 잠재력을 짚어주는 종합 의견 (2~3문장)",
  "radarScores": {
    "commitActivity": number (0~100),
    "documentation": number (0~100),
    "stackDiversity": number (0~100),
    "codePopularity": number (0~100),
    "consistency": number (0~100)
  },
  "highlights": [
    "핵심 기술 강점 1",
    "핵심 기술 강점 2",
    "핵심 기술 강점 3"
  ],
  "recommendations": [
    "포트폴리오 보완 추천 1",
    "포트폴리오 보완 추천 2",
    "포트폴리오 보완 추천 3"
  ],
  "riskFactor": "취업/이직 시 보완이 필요한 영역 (예: 대표 프로젝트 라이브 데모 배포 필요)"
}
`;
  }
}

export function generateRepoPrompt(
  data: GitHubRepoDetailedData,
  mode: EvaluationMode
): string {
  const fileNames = data.files.map((f) => f.name).join(", ");
  const langSummary = Object.entries(data.languages)
    .map(([lang, pct]) => `${lang}: ${pct}%`)
    .join(", ");
  const commitSummary = data.recentCommits
    .map((c) => {
      const co = c.hasCoAuthor ? ` [Co-Author: ${c.coAuthorNames.join(", ")}]` : "";
      return `- "${c.message}" (${c.author})${co}`;
    })
    .join("\n");

  const targetFileSnippet = data.targetFile
    ? `\n- 특정 분석 요청 파일: ${data.targetFile.path} (크기: ${data.targetFile.size || 0} bytes)\n- 파일 미리보기:\n${data.targetFile.contentPreview || "미리보기 없음"}\n`
    : "";

  const readmeSnippet = data.readmeContent
    ? `\n[README.md 내용]\n${data.readmeContent}\n`
    : "";

  const depSnippet = data.dependencyContent
    ? `\n[프로젝트 의존성 및 패키지 설정]\n${data.dependencyContent}\n`
    : "";

  if (mode === "roast") {
    return `
당신은 냉철하고 독설 가득하지만 기술적 통찰력이 뛰어난 20년 차 수석 소프트웨어 아키텍트입니다.
사용자가 제출한 단일 GitHub 리포지토리 [${data.full_name}]의 기술 완성도, 파일 구성, README, 의존성 패키지, 커밋 이력을 철저히 해부하여,
겉핥기가 아닌 실제 프로젝트 내용을 바탕으로 뼈를 때리고 빵 터지는 [매운맛 리포지토리 팩폭(Repo Roast)]을 작성해 주세요.
절대 인격 모독이나 비속어는 쓰지 말고, 코드 아키텍처, 사용된 패키지의 적절성, 기획/문서와 실제 코드의 괴리, AI 페어 프로그래밍(Claude/Copilot Co-Author) 흔적, 테스트 코드 부재, 프로덕션 배포 시 터질 시한폭탄들을 위트 있게 풍자하세요.

[리포지토리 정보]
- 저장소명: ${data.full_name}
- 설명: ${data.description || "설명 없음"}
- 스타: ${data.stargazers_count}개 / 포크: ${data.forks_count}개 / 오픈 이슈: ${data.open_issues_count}개
- 주요 언어 및 구성: ${langSummary || data.language || "미상"}
- 루트 파일 목록: ${fileNames || "파일 없음"}
- README 존재: ${data.hasReadme ? "있음" : "없음"}
- SPEC/기획문서 존재: ${data.hasSpecOrDocs ? "있음" : "없음"}
- 테스트 코드: ${data.hasTests ? "있음" : "테스트 코드 없음 (0줄)"}
- CI/CD 자동화: ${data.hasCiCd ? "구성됨" : "없음"}
${targetFileSnippet}
${readmeSnippet}
${depSnippet}
- 최근 커밋 이력:
${commitSummary || "커밋 정보 없음"}

[출력 형식 - 반드시 유효한 JSON 형식으로만 출력할 것]:
{
  "tier": "SSS" | "SS" | "S" | "A" | "B" | "C" | "D" | "F",
  "score": number (0~100 사이 정수),
  "title": "리포지토리 풍자 별명 (예: SPEC.md만 NASA급인 AI 외주형 프로토타입)",
  "oneLiner": "핵심 팩폭 한 줄 (50자 내외)",
  "summary": "저장소의 실제 기술 상태와 문서/코드를 꼬집는 촌철살인 총평 (2~3문장)",
  "radarScores": {
    "commitActivity": number (0~100, 코드 아키텍처 및 구현 완성도),
    "documentation": number (0~100, README 및 SPEC.md 문서화 수준),
    "stackDiversity": number (0~100, 의존성 라이브러리 및 커밋 관리),
    "codePopularity": number (0~100, 스타 및 인지도),
    "consistency": number (0~100, 테스트 및 유지보수성)
  },
  "highlights": [
    "실제 프로젝트 내용에 기반한 팩폭 포인트 1",
    "실제 프로젝트 내용에 기반한 팩폭 포인트 2",
    "실제 프로젝트 내용에 기반한 팩폭 포인트 3"
  ],
  "recommendations": [
    "프로젝트를 살리기 위한 실질적인 기술적 개선 조언 1",
    "실질적인 기술적 개선 조언 2",
    "실질적인 기술적 개선 조언 3"
  ],
  "riskFactor": "프로덕션 배포 시 터질 위험도 (예: 테스트 없는 배포로 인한 야근 위험도 95%)"
}
`;
  } else {
    return `
당신은 빅테크 기업의 시니어 소프트웨어 아키텍트이자 오픈소스 테크 리드입니다.
사용자가 제출한 GitHub 리포지토리 [${data.full_name}]의 README, 디렉토리 구조, 의존성 파일, 커밋 이력을 정밀 분석하고,
채용 포트폴리오 관점 및 프로덕션 상용화 관점의 최고급 [전문 기술 진단 및 아키텍처 리뷰(Repo Review)]를 작성해 주세요.
실제 사용된 기술 스택과 아키텍처의 장점을 논리적으로 칭찬하고, 실무 프로덕션 레벨 개선점(모듈화, 성능 최적화, 보안, 테스트 자동화)을 구체적인 기술명과 함께 제시하세요.

[리포지토리 정보]
- 저장소명: ${data.full_name}
- 설명: ${data.description || "설명 없음"}
- 스타: ${data.stargazers_count}개 / 포크: ${data.forks_count}개 / 오픈 이슈: ${data.open_issues_count}개
- 주요 언어 및 구성: ${langSummary || data.language || "미상"}
- 루트 파일 목록: ${fileNames || "파일 없음"}
- README 존재: ${data.hasReadme ? "있음" : "없음"}
- SPEC/기획문서 존재: ${data.hasSpecOrDocs ? "있음" : "없음"}
- 테스트 코드: ${data.hasTests ? "있음" : "테스트 코드 보완 필요"}
- CI/CD 자동화: ${data.hasCiCd ? "구성됨" : "미구성"}
${targetFileSnippet}
${readmeSnippet}
${depSnippet}
- 최근 커밋 이력:
${commitSummary || "커밋 정보 없음"}

[출력 형식 - 반드시 유효한 JSON 형식으로만 출력할 것]:
{
  "tier": "SSS" | "SS" | "S" | "A" | "B" | "C" | "D" | "F",
  "score": number (0~100 사이 정수),
  "title": "기술적 강점을 살린 프로젝트 타이틀 (예: Next.js & Supabase 기반의 실무형 풀스택 아키텍처)",
  "oneLiner": "프로젝트의 핵심 기술 가치 한 줄 (50자 내외)",
  "summary": "아키텍처 완성도, 의존성 설계, 성장 잠재력을 짚어주는 심층 기술 의견 (2~3문장)",
  "radarScores": {
    "commitActivity": number (0~100, 코드 아키텍처 및 구현 완성도),
    "documentation": number (0~100, README 및 SPEC.md 문서화 수준),
    "stackDiversity": number (0~100, 의존성 라이브러리 및 커밋 관리),
    "codePopularity": number (0~100, 스타 및 인지도),
    "consistency": number (0~100, 테스트 및 유지보수성)
  },
  "highlights": [
    "실제 프로젝트 구조와 스택에 근거한 기술 강점 1",
    "실제 프로젝트 구조와 스택에 근거한 기술 강점 2",
    "실제 프로젝트 구조와 스택에 근거한 기술 강점 3"
  ],
  "recommendations": [
    "프로덕션 완성도를 위한 구체적 개선점 1 (기술명, 디자인 패턴 명시)",
    "구체적 개선점 2",
    "구체적 개선점 3"
  ],
  "riskFactor": "포트폴리오 제출 시 면접관 예상 질문 영역 (예: 상태 관리 및 네트워크 장애 시의 Fallback 전략 보완 필요)"
}
`;
  }
}
