# 재정관리 앱 — TASKS.md
> 코드베이스 분석 기반 태스크 목록 (`/tasks-generator analyze`)  
> 생성일: 2026-04-16  
> 분석 대상: Next.js 15 App Router + Supabase + Tailwind CSS + ShadCN UI (그룹 기반 재정관리 앱)

---

## 앱 현황 요약 (2026-04-16 오케스트레이션 실행 후)

| 영역 | 상태 | 비고 |
|------|------|------|
| 인증/회원가입 | ✅ 완료 | login, register, pending |
| 재정출납부 (메인) | ✅ 완료 | CRUD, CSV import/export |
| 주간/전체 뷰 | ✅ 완료 | viewMode 전환 + 별도 페이지 |
| 설정 | ✅ 완료 | 항목/예산/앱정보/계좌현황 |
| 보고서 (주간/월간) | ✅ 완료 | 출력 기능 포함 |
| 프로필 수정 | ✅ 완료 | 이름, 그룹 요청, 비밀번호 |
| 재정관리자 그룹 관리 | ✅ 완료 | CRUD, 멤버/권한 관리 |
| 그룹 권한 설정 | ✅ 완료 | 읽기/쓰기 권한 |
| 슈퍼어드민 (사용자/그룹) | ✅ 완료 | 승인/거절/삭제/재정관리자 지정 |
| API Route (delete-user) | ✅ 완료 | /api/admin/delete-user |
| Context (Group/Data) | ✅ 완료 | 전역 캐싱 |
| **proxy.ts (미들웨어)** | ✅ 완료 | Next.js 16 proxy.ts 방식, 상태 확인 포함 |
| **Service Worker** | ✅ 완료 | sw.js + ServiceWorkerManager 이미 통합됨 |
| **에러/404 페이지** | ✅ 완료 | app/error.tsx, not-found.tsx 생성됨 |
| **읽기 전용 모드** | ✅ 완료 | hasWritePermission → TransactionForm readOnly |
| **NoGroupAvailable UX** | ✅ 완료 | 일반 사용자에 프로필 링크 추가 |
| **빌드** | ✅ 성공 | TypeScript 오류 3개 수정 |
| **SQL 마이그레이션 정리** | ⚠️ 수동 필요 | Supabase SQL Editor에서 직접 실행 |

---

## Phase 0: 프로젝트 셋업 확인

### P0-T0.1: 미적용 SQL 마이그레이션 확인 및 정리
- **담당:** 개발자 직접 실행
- **파일:**
  - `supabase/add_finance_permissions.sql`
  - `supabase/add_name_and_requested_group.sql`
  - `supabase/allow_public_group_list.sql`
  - `supabase/check_and_fix_rls.sql`
  - `supabase/finance_admin_system.sql`
  - `supabase/fix_group_rls.sql`
  - `supabase/fix_rls_finance_admin.sql`
  - `supabase/remove_personal_finance.sql`
- **작업:**
  1. 각 SQL 파일 내용 확인
  2. 실행 순서 결정 (의존성 파악)
  3. Supabase SQL Editor에서 순서대로 실행
  4. `supabase/schema.sql`에 최종 통합 정리
- **완료 기준:** Supabase에서 모든 테이블/컬럼/RLS가 코드와 일치

### P0-T0.2: 환경변수 및 .env.local 확인
- **작업:**
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY` (admin delete-user API용)
- **완료 기준:** `.env.local` 존재, 빌드 에러 없음

---

## Phase 1: 보안 강화 (공통 기반)

### P1-R1-T1: middleware.ts 재도입
- **파일:** `middleware.ts` (삭제됨 → 재생성)
- **이유:** 현재 layout.tsx server-side redirect만으로는 일부 경로에서 인증 우회 가능
- **작업:**
  ```ts
  // 보호할 경로: /dashboard/**, /admin/**
  // 미인증 → /login
  // /admin/** → super_admin 확인 (DB 조회는 layout에서)
  ```
- **완료 기준:** 비인증 상태에서 `/dashboard` 직접 접근 시 `/login`으로 리다이렉트

### P1-S0-T1: app/not-found.tsx 생성
- **파일:** `app/not-found.tsx`
- **작업:** 404 페이지 UI (홈으로 돌아가기 버튼 포함)
- **완료 기준:** 존재하지 않는 경로 접근 시 커스텀 404 표시

### P1-S0-T2: app/error.tsx 생성
- **파일:** `app/error.tsx`
- **작업:** 전역 에러 바운더리 (새로고침 버튼 포함)
- **완료 기준:** 런타임 에러 발생 시 앱이 전체 크래시 대신 에러 UI 표시

---

## Phase 2: 기능 완성 및 버그 수정

### P2-R1-T1: Service Worker 통합 확인
- **파일:** `public/sw.js`, `components/ServiceWorkerManager.tsx`
- **작업:**
  1. `ServiceWorkerManager.tsx`가 실제 레이아웃에 마운트되는지 확인
  2. `app/layout.tsx`에 `ServiceWorkerManager` 추가 (없다면)
  3. sw.js 캐싱 전략 검토
- **완료 기준:** 브라우저 DevTools > Application > Service Workers에서 등록 확인

### P2-S1-T1: `/dashboard/weekly/page.tsx` 역할 명확화
- **파일:** `app/dashboard/weekly/page.tsx`, `app/dashboard/reports/weekly/WeeklyReport.tsx`
- **작업:** 두 파일의 용도 중복 여부 확인
  - `/dashboard/weekly` → 독립 주간 뷰 (네비게이션에서 사용 안 함, 레거시 가능)
  - `/dashboard/reports/weekly` → 보고서 탭에서 사용하는 WeeklyReport 컴포넌트
  - 레거시라면 `/dashboard/weekly/page.tsx` 제거 또는 `/dashboard/reports`로 리다이렉트
- **완료 기준:** 중복 없이 단일 역할로 정리

### P2-S2-T1: 재정출납부 - 읽기 권한 사용자 입력 폼 비활성화
- **파일:** `app/dashboard/page.tsx`, `components/TransactionForm.tsx`
- **작업:** 그룹 권한이 `can_read`(읽기만)인 사용자는 거래 추가/수정/삭제 버튼 비활성화
- **완료 기준:** 읽기 권한 사용자 로그인 시 폼 비활성화 확인

### P2-S3-T1: 모바일 반응형 개선
- **파일:** `app/dashboard/page.tsx`, `components/TransactionTable.tsx`
- **작업:**
  - 재정출납부 입력 폼 모바일 레이아웃 최적화
  - TransactionTable 모바일에서 스크롤 처리
  - 설정 페이지 모바일 그리드 확인
- **완료 기준:** iPhone 375px 기준 주요 기능 사용 가능

### P2-S4-T1: 그룹 없는 일반 사용자 UX 개선
- **파일:** `components/NoGroupAvailable.tsx`
- **작업:** 그룹이 없을 때 안내 메시지에 "프로필에서 그룹 요청" 링크 추가
- **완료 기준:** NoGroupAvailable 컴포넌트에서 `/dashboard/profile`로 이동 가능

---

## Phase 3: 데이터 완성도

### P3-R1-T1: DataContext - 그룹 전환 시 데이터 리프레시
- **파일:** `lib/contexts/DataContext.tsx`
- **작업:** `currentGroup` 변경 시 transactions와 settings를 자동으로 다시 패치
- **완료 기준:** Navbar 그룹 선택기에서 다른 그룹 선택 시 데이터 즉시 갱신

### P3-R2-T1: 월간 보고서 - 이월금 계산 로직 검증
- **파일:** `app/dashboard/reports/monthly/MonthlyReport.tsx`
- **작업:** `lastMonthBalance` 계산이 그룹 필터와 함께 올바르게 동작하는지 확인
  - 현재 `transactions` 전체에서 계산 → 현재 그룹 데이터만 반영되는지 확인
- **완료 기준:** 그룹 전환 후 월간 보고서 이월금이 올바르게 표시됨

### P3-R3-T1: 예산 대비 실적 표시 (선택적 개선)
- **파일:** `app/dashboard/settings/page.tsx`, 또는 새 컴포넌트
- **작업:** 설정에서 입력한 수입/지출 예산 vs 실제 거래 합계 비교 차트/표 추가
- **완료 기준:** 항목별 예산 달성률 시각적으로 확인 가능

---

## Phase 4: 배포 준비

### P4-T1: 빌드 에러 확인 및 수정
- **작업:**
  ```bash
  npm run build
  ```
  - TypeScript 타입 에러 수정
  - ESLint 에러 수정
- **완료 기준:** `npm run build` 성공 (0 errors)

### P4-T2: Vercel 배포 설정 확인
- **파일:** `next.config.ts`
- **작업:**
  - Supabase 도메인 이미지 허용 확인
  - 환경변수 Vercel 대시보드 등록 확인
  - `dynamic = "force-dynamic"` 경로들 Edge Runtime 호환성 확인
- **완료 기준:** Vercel 프리뷰 배포 성공

### P4-T3: Supabase RLS 최종 검증
- **작업:**
  - 일반 사용자: 자신의 그룹 데이터만 조회/수정 가능
  - 재정관리자: 자신이 생성한 그룹만 관리 가능
  - 슈퍼어드민: 모든 데이터 접근 가능
  - 비인증 사용자: 아무 데이터도 접근 불가
- **완료 기준:** Supabase 테이블 에디터에서 각 역할로 테스트 통과

### P4-T4: git 정리 및 커밋
- **작업:**
  - 미추적(untracked) 파일 모두 스테이징
  - 의미 있는 단위로 커밋 분리
  - `supabase/` SQL 파일들 커밋
- **완료 기준:** `git status` 에서 clean working tree

---

## Phase 5: Verification

### P5-V1: 주요 플로우 E2E 체크리스트

| 시나리오 | 담당 | 완료 |
|---------|------|------|
| 회원가입 → 승인 대기 → 슈퍼어드민 승인 → 로그인 | - | ☐ |
| 재정관리자가 그룹 생성 → 멤버 추가 → 권한 설정 | - | ☐ |
| 일반 사용자 로그인 → 그룹 선택 → 거래 추가/수정/삭제 | - | ☐ |
| 읽기 권한 사용자: 거래 조회만 가능, 입력 불가 확인 | - | ☐ |
| CSV 내보내기 → 다운로드 확인 | - | ☐ |
| CSV 가져오기 → 데이터 반영 확인 | - | ☐ |
| 주간 보고서 출력 → 팝업 정상 열림 | - | ☐ |
| 월간 보고서 출력 → 팝업 정상 열림 | - | ☐ |
| 슈퍼어드민: 사용자 삭제 → 계정 완전 삭제 확인 | - | ☐ |
| 그룹 전환 시 데이터 올바르게 갱신 | - | ☐ |

---

## 병렬 실행 가능 태스크

```
P1-S0-T1 (not-found.tsx)  ─┐
P1-S0-T2 (error.tsx)       ├─ 병렬 가능 (독립적)
P2-S1-T1 (weekly 정리)    ─┘

P1-R1-T1 (middleware)     ─ 단독 (보안 핵심, 먼저 완료 권장)

P2-R1-T1 (ServiceWorker)  ─┐
P2-S2-T1 (읽기권한 폼)     ├─ 병렬 가능
P2-S3-T1 (모바일 반응형)  ─┘

P4-T1 (빌드 확인)         ─ P4-T2, T3, T4 이전에 필수
```

---

## 우선순위 요약

| 우선순위 | 태스크 | 이유 |
|---------|-------|------|
| 🔴 긴급 | P0-T0.1 SQL 마이그레이션 | DB와 코드 불일치 가능 |
| 🔴 긴급 | P1-R1-T1 middleware 재도입 | 인증 보안 취약점 |
| 🟡 높음 | P3-R1-T1 그룹 전환 시 데이터 리프레시 | 핵심 UX |
| 🟡 높음 | P2-S2-T1 읽기 권한 폼 비활성화 | 권한 로직 완성 |
| 🟢 보통 | P1-S0-T1,T2 에러/404 페이지 | UX 마무리 |
| 🟢 보통 | P4-T1 빌드 확인 | 배포 전 필수 |
| 🔵 낮음 | P2-S3-T1 모바일 반응형 | 개선사항 |
| 🔵 낮음 | P3-R3-T1 예산 대비 실적 | 선택적 기능 |
