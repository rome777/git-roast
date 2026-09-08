/**
 * 앱의 기준 절대 주소.
 *
 * NEXT_PUBLIC_SITE_URL 이 정석이지만 **빌드 시점에 값이 코드에 박힌다.**
 * 배포 후 대시보드에서 넣어도 재배포 전에는 반영되지 않으므로,
 * 비어 있을 때를 대비해 서버 전용 SITE_URL 과 Vercel 이 자동 주입하는
 * 도메인까지 순서대로 본다.
 *
 * 메일 링크(이메일 확인)와 OG 메타태그가 같은 값을 써야 하므로 한 곳에 둔다.
 * 여기가 틀리면 인증 메일의 링크가 localhost 를 가리켜 아무도 확인할 수 없다.
 */
export function resolveSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL;
  if (explicit) return explicit.replace(/\/+$/, "");

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`;

  return "http://localhost:3000";
}
