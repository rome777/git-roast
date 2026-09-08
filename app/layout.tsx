import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

export const metadata: Metadata = {
  title: "GitRoast - 깃허브 계정 & 리포지토리 AI 팩폭·평가기",
  description:
    "GitHub 아이디나 리포지토리를 입력하면 뼈를 때리는 매운맛 팩폭(Roast)과 실용적인 커리어 피드백(Review) 카드를 즉시 생성해 드립니다.",
  openGraph: {
    title: "GitRoast - 깃허브 AI 팩폭기",
    description: "내 깃허브 잔디 상태, 티어로 환산하면 몇 등급일까?",
    siteName: "GitRoast",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="dark">
      <body className="min-h-screen flex flex-col bg-slate-950 text-slate-100 antialiased selection:bg-orange-500 selection:text-white">
        <Navbar />
        <main className="flex-1 flex flex-col">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
