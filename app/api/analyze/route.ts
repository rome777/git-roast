import { NextRequest, NextResponse } from "next/server";
import { parseGitHubTarget } from "@/lib/github/parser";
import { fetchGitHubData, fetchGitHubRepoData } from "@/lib/github/api";
import { evaluateGitHub, evaluateGitHubRepo } from "@/lib/ai/evaluator";
import { EvaluationMode, EvaluationResult } from "@/lib/ai/types";
import { createClient } from "@/lib/supabase/server";
import { saveEvaluationToDb } from "@/lib/db/database";
import { getSession } from "@/lib/auth/session";
import { enforceAnalyzeRateLimit } from "@/lib/ratelimit";

/**
 * 이 라우트는 GitHub API 를 여러 번 치고 Gemini 추론을 기다린다.
 * 실측(2026-09-08, 로컬): 리포 분석 6.8초, 사용자 분석 4.9초.
 * 서버리스 콜드스타트와 DB 웨이크업을 얹어도 여유가 있지만, 호스팅의 기본
 * 타임아웃(Vercel Hobby 는 기본값이 상한보다 낮을 수 있다)에 기대지 않도록
 * 상한을 명시한다.
 */
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { username, mode = "roast" } = body;

    if (!username || typeof username !== "string" || !username.trim()) {
      return NextResponse.json(
        { error: "GitHub 사용자명 또는 리포지토리 URL을 입력해 주세요." },
        { status: 400 }
      );
    }

    // 1. 요청자 세션 (서명 검증된 쿠키만 신뢰. 없으면 게스트로 기록)
    const session = getSession(req);

    // 2. 요청량 제한. GitHub 호출과 Gemini 추론 "앞"에 있어야 의미가 있다 —
    //    한 건마다 추론 비용이 발생하므로, 일을 끝낸 뒤 거절하면 이미 늦었다.
    const verdict = await enforceAnalyzeRateLimit(req, session);
    if (!verdict.ok) return verdict.response;

    const evaluationMode: EvaluationMode = mode === "review" ? "review" : "roast";

    // 3. Smart Target Parsing (User vs Repository with optional file path)
    const parsed = parseGitHubTarget(username);

    let evaluation: EvaluationResult;
    let rawSummary: any = {};
    let targetName = parsed.fullName;

    if (parsed.type === "repo" && parsed.repo) {
      // 3-A. Fetch single repository data
      const repoData = await fetchGitHubRepoData(parsed.owner, parsed.repo, parsed.subPath);
      evaluation = await evaluateGitHubRepo(repoData, evaluationMode);
      rawSummary = {
        stars: repoData.stargazers_count,
        forks: repoData.forks_count,
        language: repoData.language,
        languages: repoData.languages,
        targetFile: repoData.targetFile?.name,
      };
    } else {
      // 3-B. Fetch user profile and repos data
      const githubData = await fetchGitHubData(parsed.owner);
      evaluation = await evaluateGitHub(githubData, evaluationMode);
      targetName = githubData.user.login;
      rawSummary = {
        totalStars: githubData.totalStars,
        totalForks: githubData.totalForks,
        publicRepos: githubData.user.public_repos,
        languages: githubData.languages,
      };
    }

    const userEmail = session?.email ?? "guest@gitroast.dev";
    const userId = session?.id ?? "guest";

    // 4. Save to Persistent Database (PostgreSQL, 미설정 시 SQLite)
    const dbSavedId = await saveEvaluationToDb(userId, userEmail, evaluation);
    let savedId = dbSavedId;

    // 5. Optional Supabase cloud synchronization if configured
    const supabase = createClient();
    if (supabase) {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          const { data: inserted, error: dbError } = await supabase
            .from("evaluations")
            .insert({
              user_id: user.id,
              target_type: parsed.type,
              target_name: targetName,
              mode: evaluationMode,
              tier: evaluation.tier,
              score: evaluation.score,
              title: evaluation.title,
              one_liner: evaluation.oneLiner,
              summary: evaluation.summary,
              details: {
                radarScores: evaluation.radarScores,
                radarLabels: evaluation.radarLabels,
                highlights: evaluation.highlights,
                recommendations: evaluation.recommendations,
                riskFactor: evaluation.riskFactor,
                repoMeta: evaluation.repoMeta,
              },
              raw_github_summary: rawSummary,
              is_public: true,
            })
            .select("id")
            .single();

          if (inserted?.id) {
            savedId = inserted.id;
          }
          if (dbError) {
            console.warn("Could not save to Supabase:", dbError.message);
          }
        }
      } catch (authErr) {
        console.warn("Auth check failed during save:", authErr);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        ...evaluation,
        id: savedId,
      },
      savedBy: userEmail,
    });
  } catch (error: any) {
    console.error("API /api/analyze error:", error);
    return NextResponse.json(
      { error: error.message || "분석 중 알 수 없는 오류가 발생했습니다." },
      { status: error.message?.includes("찾을 수 없습니다") ? 404 : 500 }
    );
  }
}
