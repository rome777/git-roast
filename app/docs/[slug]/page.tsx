import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText } from "lucide-react";
import { PUBLIC_DOCS, getDocBySlug, renderDoc } from "@/lib/docs";

export function generateStaticParams() {
  return PUBLIC_DOCS.map((d) => ({ slug: d.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }) {
  const doc = getDocBySlug(params.slug);
  if (!doc) return { title: "문서를 찾을 수 없습니다 | GitRoast" };
  return { title: `${doc.label} | GitRoast 개발 문서`, description: doc.description };
}

export default async function DocPage({ params }: { params: { slug: string } }) {
  const doc = getDocBySlug(params.slug);
  if (!doc) notFound();

  const { html } = await renderDoc(doc);

  return (
    <div className="flex-1 flex flex-col max-w-3xl xl:max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10 xl:py-14">
      <Link
        href="/docs"
        className="flex items-center gap-1.5 text-xs xl:text-sm font-bold text-slate-400 hover:text-white transition-colors mb-6 w-fit"
      >
        <ArrowLeft className="w-4 h-4" /> 문서 목록으로
      </Link>

      <div className="border-b border-slate-800 pb-5 mb-8">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xl">{doc.emoji}</span>
          <h1 className="text-2xl xl:text-3xl font-black text-white">{doc.label}</h1>
        </div>
        <p className="flex items-center gap-1.5 text-[11px] xl:text-xs text-slate-500 font-mono mt-2">
          <FileText className="w-3.5 h-3.5" /> docs/{doc.file}
        </p>
      </div>

      {/* 저장소의 마크다운 원문을 그대로 변환해 보여 준다 */}
      <article className="markdown-body" dangerouslySetInnerHTML={{ __html: html }} />

      <div className="mt-12 pt-6 border-t border-slate-800 flex flex-wrap gap-2">
        {PUBLIC_DOCS.filter((d) => d.slug !== doc.slug).map((d) => (
          <Link
            key={d.slug}
            href={`/docs/${d.slug}`}
            className="px-3 py-1.5 rounded-xl text-xs xl:text-sm font-semibold bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-600 transition-all"
          >
            {d.emoji} {d.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
