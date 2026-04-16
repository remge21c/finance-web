import { createClient } from "@supabase/supabase-js";

/**
 * 서비스 롤 키를 사용하는 서버 전용 Supabase 클라이언트
 * API Route 등 서버 환경에서만 사용하세요 (클라이언트 번들에 포함되지 않음)
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다.");
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
