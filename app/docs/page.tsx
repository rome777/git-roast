import React from "react";
import Link from "next/link";
import { FileText, ArrowRight, BookOpen } from "lucide-react";
import { PUBLIC_DOCS, getExcerpt } from "@/lib/docs";

export const metadata = {
  title: "개발 문서 | GitRoast",
  description: "GitRoast 기획·기술·검증 문서 모음",
};

export default function DocsIndexPage() {
  return (
    <div className="flex-1 flex flex-col max-w-4xl xl:max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10 xl:py-14">
      <div className="border-b border-slate-800 pb-6 mb-8">
        <div className="flex items-center gap-2 text-xs xl:text-sm font-bold text-cyan-400 uppercase tracking-wider mb-1">
          <BookOpen className="w-4 h-4" /> Documentation
        </div>
        <h1 className="text-2xl sm:text-3xl xl:text-4xl font-black text-white">개발 문서</h1>
        <p className="text-xs xl:text-sm text-slate-400 mt-1.5">
          GitRoast 를 만들면서 작성한 기획·기술·검증 문서입니다. 저장소의 원문 마크다운을 그대로 보여 줍니다.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {PUBLIC_DOCS.map((doc) => (
          <Link
            key={doc.slug}
            href={`/docs/${doc.slug}`}
            className="group p-5 xl:p-6 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-cyan-500/50 transition-all hover:scale-[1.01] flex flex-col"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">{doc.emoji}</span>
              <h2 className="font-extrabold text-white text-base xl:text-lg">{doc.label}</h2>
            </div>
            <p className="text-xs xl:text-sm text-slate-400 leading-relaxed mb-3">{doc.description}</p>
            <p className="text-[11px] xl:text-xs text-slate-500 italic line-clamp-2 mb-4">
              {getExcerpt(doc)}
            </p>
            <div className="mt-auto flex items-center justify-between pt-3 border-t border-slate-800/60">
              <span className="flex items-center gap-1.5 text-[11px] xl:text-xs text-slate-500 font-mono">
                <FileText className="w-3.5 h-3.5" /> docs/{doc.file}
              </span>
              <span className="flex items-center gap-1 text-xs xl:text-sm font-bold text-cyan-400 group-hover:text-cyan-300">
                읽기
                <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
