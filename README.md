# 재정 관리 프로그램 (개인용 웹앱)

Next.js + Supabase 기반 **개인용** 재정 관리 웹 애플리케이션입니다.

## ✨ 주요 기능

- **재정출납부**: 수입/지출 데이터 입력, 수정, 삭제
- **주간 보고서**: 주간 수입/지출 요약 및 인쇄
- **전체 목록**: 날짜, 구분, 항목별 필터링
- **설정**: 수입/지출 항목, 예산, 작성자 정보 관리
- **승인 시스템**: 관리자 승인 후 사용 가능 (첫 가입자가 관리자)

## 🔐 사용자 관리

| 기능 | 설명 |
|------|------|
| **첫 번째 가입자** | 자동으로 Super Admin + 승인됨 |
| **이후 가입자** | 승인 대기 상태 → 관리자 승인 필요 |
| **거절된 사용자** | 재신청 가능 |

## 🛠 기술 스택

| 영역 | 기술 |
|------|------|
| **프레임워크** | Next.js 16 (App Router) |
| **런타임** | React 19 |
| **데이터베이스** | Supabase (PostgreSQL) |
| **스타일링** | Tailwind CSS v4 |
| **UI 컴포넌트** | shadcn/ui (Radix UI 기반) |
| **폼 관리** | react-hook-form + Zod |
| **날짜 처리** | date-fns |
| **언어** | TypeScript |
| **배포** | Vercel |

## 📁 프로젝트 구조

```
finance-web/
├── app/
│   ├── page.tsx              # 랜딩 페이지
│   ├── layout.tsx            # 루트 레이아웃
│   ├── globals.css           # 전역 스타일
│   ├── login/page.tsx        # 로그인
│   ├── register/page.tsx     # 회원가입
│   ├── pending/page.tsx      # 승인 대기 페이지
│   ├── admin/
│   │   ├── layout.tsx        # 관리자 레이아웃
│   │   └── users/page.tsx    # 사용자 관리
│   └── dashboard/
│       ├── layout.tsx        # 대시보드 레이아웃
│       ├── page.tsx          # 재정출납부
│       ├── weekly/page.tsx   # 주간보고서
│       ├── all/page.tsx      # 전체목록
│       └── settings/page.tsx # 설정
├── components/
│   ├── ui/                   # shadcn/ui 컴포넌트
│   ├── Navbar.tsx            # 네비게이션
│   ├── TransactionForm.tsx   # 거래 입력 폼
│   └── TransactionTable.tsx  # 거래 테이블
├── lib/
│   ├── hooks/                # React 커스텀 훅
│   │   ├── useTransactions.ts # 거래 CRUD 훅
│   │   ├── useSettings.ts    # 설정 훅
│   │   └── useUserStatus.ts  # 사용자 상태 훅
│   ├── supabase/             # Supabase 클라이언트
│   └── utils.ts              # 유틸리티 함수
├── types/
│   └── database.ts           # TypeScript 타입
├── supabase/
│   └── schema.sql            # 데이터베이스 스키마
└── middleware.ts             # 인증/승인 미들웨어
```

## 🚀 시작하기

### 1. 의존성 설치

```bash
npm install
```

### 2. Supabase 설정

1. [Supabase](https://supabase.com)에서 새 프로젝트 생성
2. **SQL Editor**에서 `supabase/schema.sql` 전체 실행
3. **Authentication > Providers > Email** 활성화
4. **Project Settings > API**에서 URL과 anon key 복사

### 3. 환경 변수 설정

프로젝트 루트에 `.env.local` 파일 생성:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### 4. 개발 서버 실행

```bash
npm run dev
```

http://localhost:3000 에서 확인

---

## 🌐 Vercel 배포 가이드

### GitHub → Vercel 배포 (권장)

#### 1. GitHub에 Push

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/your-username/finance-web.git
git push -u origin main
```

#### 2. Vercel에서 Import

1. [Vercel](https://vercel.com)에 로그인
2. **"Add New..."** → **"Project"** 클릭
3. GitHub 저장소 선택

#### 3. 환경 변수 설정

| Name | Value |
|------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://your-project.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `your-anon-key` |

#### 4. Deploy 클릭

배포 완료 후 Supabase **Authentication > URL Configuration**에서:
- **Site URL**: `https://your-project.vercel.app`
- **Redirect URLs**: `https://your-project.vercel.app/**`

---

## 📊 데이터베이스 구조

> **참고**: 이 프로젝트는 Malaysia MH 프로젝트의 Supabase와 통합됩니다.  
> 테이블 충돌 방지를 위해 `finance_` 접두사를 사용합니다.

| 테이블 | 설명 |
|--------|------|
| `finance_user_status` | 재정관리 사용자 승인 상태 (pending/approved/rejected) |
| `finance_transactions` | 수입/지출 거래 내역 (user_id 기반) |
| `finance_settings` | 사용자별 설정 (항목, 예산, 작성자 등) |

**RLS(Row Level Security)** 정책이 적용되어 각 사용자는 자신의 데이터만 접근할 수 있습니다.

### 기존 Malaysia MH 테이블 (참고)

| 테이블 | 설명 |
|--------|------|
| `scores` | 악보 데이터 |
| `admin_users` | 관리자 정보 |
| `app_settings` | 앱 설정 |

---

## 📝 사용 방법

### 1. 회원가입
- 첫 번째 가입자: 자동으로 관리자 + 승인됨
- 이후 가입자: 관리자 승인 필요

### 2. 관리자 기능 (Super Admin)
- 우측 상단 메뉴 → **🔧 사용자 관리**
- 대기 중인 사용자 승인/거절

### 3. 설정
- **수입/지출 항목**: 최대 10개씩 등록 가능
- **예산**: 항목별 예산 설정
- **작성자 정보**: 주간보고서 서명란에 표시

### 4. 재정출납부
- 날짜, 구분(수입/지출), 항목, 내용, 금액, 메모 입력
- 체크박스로 선택 후 일괄 삭제 가능

### 5. 주간보고서
- 주간 수입/지출 자동 집계
- 이월금 자동 계산
- 인쇄 버튼으로 출력 가능

---

## 🐛 트러블슈팅

### "Invalid API key" 에러
- 환경 변수가 올바르게 설정되었는지 확인
- Vercel 대시보드에서 환경 변수 재확인

### 회원가입 실패
- Supabase SQL Editor에서 `schema.sql` 전체 실행 확인
- RLS 정책이 올바르게 설정되었는지 확인

### 승인 후에도 대시보드 접근 불가
- 브라우저 쿠키 삭제 후 다시 로그인
- Supabase에서 `finance_user_status` 테이블의 status 값 확인

---

## 📄 라이선스

MIT

---

## 🔄 업데이트 내역

### v0.2.0 (2024-11)
- 개인용 앱으로 전환 (팀 기능 제거)
- 사용자 승인 시스템 추가
- 첫 가입자 자동 관리자 설정

### v0.1.0 (2024-11)
- 초기 버전 릴리스
- 재정출납부, 주간보고서, 전체목록, 설정 기능 구현
