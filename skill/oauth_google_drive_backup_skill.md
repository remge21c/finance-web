# Google Drive OAuth 2.0 자동 백업 (Service Account 대체)

이 가이드는 서버에 종속된 서비스 계정(Service Account) 대신, **사용자 본인의 구글 계정(OAuth 2.0)을 연동하여 Google Drive에 파일을 백업**하는 기능의 전체 구현 패턴입니다. 
다른 프로젝트에서도 이 패턴을 그대로 활용하여 쉽게 백업 시스템을 구축할 수 있습니다.

## 1. 개요 및 장점
*   **할당량 문제 해결**: 서비스 계정 용량 대신 실제 사용자의 개인 Drive 용량(기본 15GB)을 사용합니다.
*   **보안 및 편의성 강화**: JSON 키 파일을 서버에 저장할 필요 없이, 브라우저에서 '구글 로그인' 한 번으로 영구적인 `refresh_token`을 발급받아 사용합니다.
*   **유연한 폴더 지정**: 사용자가 원하는 폴더 URL이나 ID를 설정하면 해당 위치로 안전하게 파일을 업로드합니다.

---

## 2. 환경 변수 설정 (`.env.local`)
Google Cloud Console에서 [OAuth 2.0 클라이언트 ID]를 발급받아 환경 변수에 등록합니다. (리디렉션 URI는 `http://localhost:3000/api/auth/google-drive/callback` 등으로 설정)

```env
GOOGLE_OAUTH_CLIENT_ID="발급받은_클라이언트_ID.apps.googleusercontent.com"
GOOGLE_OAUTH_CLIENT_SECRET="발급받은_클라이언트_보안_비밀번호"
```

---

## 3. 백엔드: OAuth 인증 라우트 설정

### 1) Auth Start (`app/api/auth/google-drive/start/route.ts`)
사용자를 구글 로그인/동의 화면으로 리다이렉트시키는 엔드포인트입니다.
```typescript
import { NextResponse } from 'next/server'
import { google } from 'googleapis'

export async function GET(request: Request) {
  const { origin } = new URL(request.url)
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    `${origin}/api/auth/google-drive/callback`
  )

  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline', // refresh_token 발급을 위해 필수
    prompt: 'consent',      // 매번 권한을 묻도록 강제하여 refresh_token 보장
    scope: ['https://www.googleapis.com/auth/drive.file'], // 파일 쓰기 전용 스코프
  })

  return NextResponse.redirect(url)
}
```

### 2) Auth Callback (`app/api/auth/google-drive/callback/route.ts`)
구글에서 인증을 마치고 돌아왔을 때 코드를 받아 `refresh_token`을 DB에 영구 저장합니다.
```typescript
import { NextResponse } from 'next/server'
import { google } from 'googleapis'
// import DB저장함수 from '...'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (!code) return NextResponse.redirect(`${origin}/settings?error=NoCode`)

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    `${origin}/api/auth/google-drive/callback`
  )

  try {
    const { tokens } = await oauth2Client.getToken(code)
    
    // 중요: tokens.refresh_token을 DB(예: app_settings 테이블)에 저장합니다.
    if (tokens.refresh_token) {
      await saveRefreshTokenToDB(tokens.refresh_token)
    }

    return NextResponse.redirect(`${origin}/settings?success=google_connected`)
  } catch (error) {
    return NextResponse.redirect(`${origin}/settings?error=AuthFailed`)
  }
}
```

---

## 4. 백엔드: Google Drive 클라이언트 (`lib/google/drive.ts`)
저장된 `refresh_token`을 불러와 Drive API에 접근하고, 파일을 업로드하거나 폴더 권한을 검증합니다.

```typescript
import { google } from 'googleapis'
import { Readable } from 'stream'

async function getDriveClient() {
  const refreshToken = await getRefreshTokenFromDB()
  
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET
  )
  oauth2Client.setCredentials({ refresh_token: refreshToken })

  return google.drive({ version: 'v3', auth: oauth2Client })
}

// 파일 업로드 함수
export async function uploadBackupToDrive(folderId: string, filename: string, data: object) {
  const drive = await getDriveClient()

  // 기존 파일 삭제 처리 (선택사항)
  const existing = await drive.files.list({
    q: `name='${filename}' and '${folderId}' in parents and trashed=false`,
  })
  for (const file of existing.data.files ?? []) {
    if (file.id) await drive.files.delete({ fileId: file.id })
  }

  // 새 파일 생성
  const result = await drive.files.create({
    requestBody: { name: filename, parents: [folderId] },
    media: {
      mimeType: 'application/json',
      body: Readable.from(JSON.stringify(data, null, 2)),
    },
  })
  return result.data
}

// 폴더 ID 파싱 유틸리티
export function extractFolderId(input: string): string {
  const match = input.match(/\/folders\/([a-zA-Z0-9_-]+)/)
  return match ? match[1] : input.trim()
}
```

---

## 5. 프론트엔드 UI: 계정 연동 및 폴더 지정
다음 요소들이 UI(설정 페이지)에 포함되어야 합니다.

1. **연동 상태 표시**: DB에 `refresh_token`이 존재하는지 여부 확인
2. **연결 버튼**: `<a href="/api/auth/google-drive/start">Google 계정 연결하기</a>`
3. **폴더 입력창**: 연동 완료 후 활성화되어, 구글 드라이브 폴더의 URL이나 ID를 저장
4. **백업 실행 버튼**: 저장된 폴더 ID를 기반으로 백업을 실행 (`uploadBackupToDrive` 호출)

## 6. 적용 시 주의사항
* 서버 측의 도메인이 변경되면 구글 클라우드 콘솔의 **승인된 리디렉션 URI**도 반드시 업데이트해야 합니다.
* 앱이 외부에 공개될 경우, Google 승인 화면의 **프로덕션 전환 및 앱 심사**가 필요할 수 있습니다. (개인용이나 사내용이라면 테스트 모드 상태에서 테스트 사용자만 추가하여 사용 가능)
