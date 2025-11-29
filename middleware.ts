import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // 세션 새로고침
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // 공개 페이지 (인증 불필요)
  const publicPages = ['/', '/login', '/register']
  const isPublicPage = publicPages.includes(pathname)
  
  // 승인 대기/거절 페이지
  const isPendingPage = pathname === '/pending'
  
  // 관리자 페이지
  const isAdminPage = pathname.startsWith('/admin')
  
  // 대시보드 페이지
  const isDashboardPage = pathname.startsWith('/dashboard')

  // 로그인되지 않은 사용자
  if (!user) {
    // 공개 페이지는 접근 허용
    if (isPublicPage) {
      return supabaseResponse
    }
    // 그 외 페이지는 로그인 페이지로 리다이렉트
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // 로그인된 사용자 - 상태 확인
  const { data: userStatus } = await supabase
    .from('finance_user_status')
    .select('status, is_super_admin')
    .eq('user_id', user.id)
    .single()

  const status = userStatus?.status || 'pending'
  const isSuperAdmin = userStatus?.is_super_admin || false

  // 로그인된 사용자가 로그인/회원가입 페이지 접근 시
  if (pathname === '/login' || pathname === '/register') {
    const url = request.nextUrl.clone()
    if (status === 'approved') {
      url.pathname = '/dashboard'
    } else {
      url.pathname = '/pending'
    }
    return NextResponse.redirect(url)
  }

  // 승인되지 않은 사용자 (pending 또는 rejected)
  if (status !== 'approved') {
    // /pending 페이지만 접근 허용
    if (isPendingPage || pathname === '/') {
      return supabaseResponse
    }
    // 대시보드나 관리자 페이지 접근 시 /pending으로 리다이렉트
    const url = request.nextUrl.clone()
    url.pathname = '/pending'
    return NextResponse.redirect(url)
  }

  // 승인된 사용자
  // 관리자 페이지는 Super Admin만 접근 가능
  if (isAdminPage && !isSuperAdmin) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  // 승인된 사용자가 /pending 페이지 접근 시 대시보드로 리다이렉트
  if (isPendingPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
