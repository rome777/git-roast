-- ==============================================================================
-- GitRoast - Supabase PostgreSQL Database Schema & Row Level Security (RLS)
-- ==============================================================================

-- 1. 사용자 프로필 테이블 (auth.users 연동)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    nickname TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 신규 회원가입 시 자동 프로필 생성 트리거
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, nickname)
    VALUES (new.id, new.email, COALESCE(new.raw_user_meta_data->>'nickname', split_part(new.email, '@', 1)));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. 평가 결과 저장 테이블
CREATE TABLE IF NOT EXISTS public.evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    target_type TEXT NOT NULL CHECK (target_type IN ('user', 'repo')),
    target_name TEXT NOT NULL,
    mode TEXT NOT NULL CHECK (mode IN ('roast', 'review')),
    tier TEXT NOT NULL,
    score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
    one_liner TEXT NOT NULL,
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    details JSONB NOT NULL,
    raw_github_summary JSONB,
    is_public BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 3. 즐겨찾기 테이블
CREATE TABLE IF NOT EXISTS public.favorites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    evaluation_id UUID NOT NULL REFERENCES public.evaluations(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(user_id, evaluation_id)
);

-- ==============================================================================
-- 4. 행 수준 보안 (Row Level Security - RLS) 활성화 및 정책
-- ==============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

-- profiles 정책
CREATE POLICY "본인 프로필만 조회 가능" 
    ON public.profiles FOR SELECT 
    USING (auth.uid() = id);

CREATE POLICY "본인 프로필만 수정 가능" 
    ON public.profiles FOR UPDATE 
    USING (auth.uid() = id);

-- evaluations 정책
CREATE POLICY "로그인 사용자 본인 평가 생성 가능" 
    ON public.evaluations FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "본인 소유 또는 공개 평가 조회 가능" 
    ON public.evaluations FOR SELECT 
    USING (auth.uid() = user_id OR is_public = true);

CREATE POLICY "작성자 본인만 평가 삭제 가능" 
    ON public.evaluations FOR DELETE 
    USING (auth.uid() = user_id);

-- favorites 정책
CREATE POLICY "본인 즐겨찾기만 조회 가능" 
    ON public.favorites FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "본인 즐겨찾기만 등록/삭제 가능" 
    ON public.favorites FOR ALL 
    USING (auth.uid() = user_id);
