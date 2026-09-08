export type EvaluationMode = "roast" | "review";

export type TargetType = "user" | "repo";

export type TierLevel = "SSS" | "SS" | "S" | "A" | "B" | "C" | "D" | "F";

export interface RadarScores {
  commitActivity: number; // For User: 커밋 활동 / For Repo: 아키텍처 완성도
  documentation: number;  // README / SPEC 문서화
  stackDiversity: number; // For User: 기술 다양성 / For Repo: 커밋 품질
  codePopularity: number; // 스타/인지도
  consistency: number;    // For User: 지속성 / For Repo: 테스트 및 유지보수
}

export interface RepoMetaInfo {
  owner: string;
  name: string;
  fullName: string;
  htmlUrl: string;
  stars: number;
  forks: number;
  openIssues: number;
  primaryLanguage: string;
  license: string | null;
  defaultBranch: string;
  targetFile?: string;
  hasReadme: boolean;
  hasSpec: boolean;
  hasTests: boolean;
}

export interface EvaluationResult {
  id?: string;
  targetType?: TargetType;
  targetUsername: string; // for user: login, for repo: fullName (e.g. 'rome777/aiffel_test')
  mode: EvaluationMode;
  tier: TierLevel;
  score: number; // 0 ~ 100
  title: string; // 별명
  oneLiner: string; // 핵심 한줄평
  summary: string; // 종합 평가 단락
  radarScores: RadarScores;
  radarLabels?: Record<string, string>;
  highlights: string[]; // 3선
  recommendations: string[]; // 3선
  riskFactor?: string; // 위험도 / 개선 필요점
  repoMeta?: RepoMetaInfo;
  analyzedAt: string;
  isMock?: boolean;
}
