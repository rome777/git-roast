import fs from "node:fs";
import path from "node:path";
import { marked } from "marked";

const DOCS_DIR = path.join(process.cwd(), "docs");

/**
 * 공개 대상 문서 목록.
 *
 * 화이트리스트로 관리한다 — docs/ 에 새 파일이 생겼다고 자동으로 공개되면
 * 내부용 메모가 실수로 웹에 노출된다. 공개할 문서는 여기에 명시적으로 추가한다.
 * (저장소 루트의 HANDOVER.md 는 관리자 계정 로그인 정보를 담고 있어 제외한다.)
 */
export const PUBLIC_DOCS = [
  {
    slug: "readme",
    file: "README.md",
    label: "문서 인덱스",
    description: "문서 구성과 작업 상황별 참조 가이드",
    emoji: "🧭",
  },
  {
    slug: "prd",
    file: "PRD.md",
    label: "제품 요구사항 정의서",
    description: "기획 배경, 타깃 사용자, MVP 핵심 기능, 사용자 여정",
    emoji: "📌",
  },
  {
    slug: "tech-spec",
    file: "TECH_SPEC.md",
    label: "기술 명세서",
    description: "기술 스택 선정 근거, 시스템 아키텍처, DB 스키마",
    emoji: "🏗️",
  },
  {
    slug: "work-units",
    file: "WORK_UNITS.md",
    label: "단위 작업 명세서",
    description: "5단계 모듈 분할, 구현 파일 목록, 모듈별 체크리스트",
    emoji: "🧩",
  },
] as const;

/**
 * 의도적으로 공개하지 않는 문서.
 *
 * - FINAL_CHECKLIST.md: 보안 점검 결과를 "미결" 항목까지 그대로 담고 있다.
 *   공개 서비스에서 아직 막지 못한 곳의 목록을 스스로 게시하는 셈이 된다.
 *   설계 근거를 보여 주는 목적이라면 TECH_SPEC.md 로 충분하다.
 * - HANDOVER.md: 운영 계정과 인프라 상태를 담고 있다.
 */

export type PublicDoc = (typeof PUBLIC_DOCS)[number];

export function getDocBySlug(slug: string): PublicDoc | undefined {
  return PUBLIC_DOCS.find((d) => d.slug === slug);
}

/** 문서 원문을 읽어 HTML 로 변환한다. 내용은 저장소 소유 파일이므로 신뢰한다. */
export async function renderDoc(doc: PublicDoc): Promise<{ html: string; raw: string }> {
  const raw = fs.readFileSync(path.join(DOCS_DIR, doc.file), "utf8");
  const html = await marked.parse(raw, { gfm: true, breaks: false });
  return { html, raw };
}

/** 목록 카드에 쓸 짧은 미리보기 (첫 문단). */
export function getExcerpt(doc: PublicDoc, maxLen = 110): string {
  try {
    const raw = fs.readFileSync(path.join(DOCS_DIR, doc.file), "utf8");
    const firstPara = raw
      .split("\n")
      .find((l) => l.trim() && !l.startsWith("#") && !l.startsWith(">") && !l.startsWith("|"));
    if (!firstPara) return doc.description;
    const clean = firstPara.replace(/[*`_[\]()]/g, "").trim();
    return clean.length > maxLen ? clean.slice(0, maxLen) + "…" : clean;
  } catch {
    return doc.description;
  }
}
