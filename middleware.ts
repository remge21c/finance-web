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
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const pathname = request.nextUrl.pathname

    // 공개 페이지 (인증 불필요)
    const publicPages = ['/login', '/register', '/forgot-password', '/reset-password', '/auth/callback']
    const isPublicPage = publicPages.includes(pathname) || pathname.startsWith('/auth/')

    // 승인 대기/거절 페이지
    const isPendingPage = pathname === '/pending'

    // 관리자 페이지
    const isAdminPage = pathname.startsWith('/admin')

    // 로그인되지 않은 사용자
    if (!user) {
      // 루트 페이지 → 로그인으로
      if (pathname === '/') {
        const url = request.nextUrl.clone()
        url.pathname = '/login'
        return NextResponse.redirect(url)
      }
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
    let status = 'pending'
    let isSuperAdmin = false
    let isGroupAdmin = false

    try {
      const { data: userStatus, error: statusError } = await supabase
        .from('finance_user_status')
        .select('status, is_super_admin')
        .eq('user_id', user.id)
        .maybeSingle()

      if (!statusError && userStatus) {
        status = userStatus.status || 'pending'
        const isFinanceAdmin = (userStatus as any).is_finance_admin === true
        isSuperAdmin = userStatus.is_super_admin || false
        if (isFinanceAdmin) isGroupAdmin = true
      }

      if (!isGroupAdmin) {
        const { data: adminMembership } = await supabase
          .from('finance_group_members')
          .select('id')
          .eq('user_id', user.id)
          .eq('permission_level', 'admin')
          .limit(1)
          .maybeSingle()
        isGroupAdmin = !!adminMembership
      }
    } catch (e) {
      console.error('Middleware status check error:', e)
    }

    // 루트 페이지 - 상태에 따라 리다이렉트
    if (pathname === '/') {
      const url = request.nextUrl.clone()
      url.pathname = status === 'approved' ? '/dashboard' : '/pending'
      return NextResponse.redirect(url)
    }

    // 로그인된 사용자가 로그인/회원가입 페이지 접근 시
    if (pathname === '/login' || pathname === '/register') {
      const url = request.nextUrl.clone()
      url.pathname = status === 'approved' ? '/dashboard' : '/pending'
      return NextResponse.redirect(url)
    }

    // 승인되지 않은 사용자 (pending 또는 rejected)
    if (status !== 'approved') {
      if (isPendingPage || isPublicPage) {
        return supabaseResponse
      }
      const url = request.nextUrl.clone()
      url.pathname = '/pending'
      return NextResponse.redirect(url)
    }

    // 관리자 페이지 접근 제어
    if (isAdminPage) {
      const isGroupsPage = pathname.startsWith('/admin/groups')
      if (isGroupsPage && !isSuperAdmin) {
        const url = request.nextUrl.clone()
        url.pathname = '/dashboard'
        return NextResponse.redirect(url)
      } else if (!isSuperAdmin && !isGroupAdmin) {
        const url = request.nextUrl.clone()
        url.pathname = '/dashboard'
        return NextResponse.redirect(url)
      }
    }

    // 승인된 사용자가 /pending 페이지 접근 시 대시보드로 리다이렉트
    if (isPendingPage) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }

    supabaseResponse.headers.set("x-pathname", pathname)
    return supabaseResponse
  } catch (error) {
    console.error('Middleware unexpected error:', error)
    return supabaseResponse
  }
}

export const config = {
  matcher: [
    /*
     * _next/static, _next/image, favicon.ico, 이미지 파일,
     * PWA 파일(sw.js, offline.html, manifest.json, manifest.webmanifest, 아이콘)은 제외
     */
    '/((?!_next/static|_next/image|favicon\\.ico|sw\\.js|offline\\.html|manifest\\.(?:json|webmanifest)|icon-.*\\.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
