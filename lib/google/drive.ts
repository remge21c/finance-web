import { google, drive_v3 } from "googleapis";
import { Readable } from "stream";
import { createAdminClient } from "@/lib/supabase/admin-client";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const FOLDER_MIME = "application/vnd.google-apps.folder";

export class DriveBackupError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

function createOAuth2Client(refreshToken: string) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET,
  );
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  return oauth2Client;
}

export function buildOAuth2ClientWithRedirect(redirectUri: string) {
  return new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    redirectUri,
  );
}

export async function loadBackupConfig() {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("finance_backup_config")
    .select("refresh_token, google_email, connected_at, target_folder_id, target_folder_name")
    .eq("id", "singleton")
    .maybeSingle();
  if (error) throw new DriveBackupError("CONFIG_READ_FAILED", error.message);
  return data;
}

export async function getDriveClient(): Promise<drive_v3.Drive> {
  const config = await loadBackupConfig();
  if (!config?.refresh_token) {
    throw new DriveBackupError("NO_TOKEN", "Google Drive 가 연결되어 있지 않습니다.");
  }
  const auth = createOAuth2Client(config.refresh_token);
  return google.drive({ version: "v3", auth });
}

/** Drive q 쿼리에서 따옴표 escape */
function escapeForQ(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

/** Drive / OS 금지문자 제거 */
export function sanitizeFolderName(name: string) {
  return name.replace(/[\\/:*?"<>|]/g, "_").trim() || "untitled";
}

/** 폴더 검색 — 없으면 생성. parentId=null 이면 My Drive 루트 */
export async function ensureFolder(
  drive: drive_v3.Drive,
  name: string,
  parentId: string | null,
): Promise<string> {
  const safeName = escapeForQ(name);
  const parentClause = parentId
    ? `'${escapeForQ(parentId)}' in parents`
    : `'root' in parents`;
  const list = await drive.files.list({
    q: `name='${safeName}' and mimeType='${FOLDER_MIME}' and trashed=false and ${parentClause}`,
    fields: "files(id,name)",
    spaces: "drive",
    pageSize: 1,
  });
  const found = list.data.files?.[0];
  if (found?.id) return found.id;

  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: FOLDER_MIME,
      parents: parentId ? [parentId] : undefined,
    },
    fields: "id",
  });
  if (!created.data.id) {
    throw new DriveBackupError("FOLDER_CREATE_FAILED", `폴더 생성 실패: ${name}`);
  }
  return created.data.id;
}

/** 사용자가 Picker 로 선택한 폴더(targetParentId) 안에 {그룹명}_{group_id} 폴더 보장 */
export async function ensureGroupBackupFolder(
  drive: drive_v3.Drive,
  groupName: string,
  groupId: string,
  targetParentId: string | null | undefined,
): Promise<string> {
  if (!targetParentId) {
    throw new DriveBackupError(
      "NO_TARGET_FOLDER",
      "백업 폴더가 선택되지 않았습니다. 백업 설정에서 폴더를 선택하세요.",
    );
  }
  const folderName = sanitizeFolderName(`${groupName}_${groupId}`);
  return ensureFolder(drive, folderName, targetParentId);
}

export interface UploadResult {
  fileId: string;
  fileName: string;
  webViewLink: string;
  rotatedDeleted: number;
}

/** xlsx 업로드 후 동일 폴더 내 .xlsx 가 keep 개를 넘으면 가장 오래된 것부터 삭제 */
export async function uploadXlsxAndRotate(
  drive: drive_v3.Drive,
  folderId: string,
  filename: string,
  buffer: Buffer,
  keep = 3,
): Promise<UploadResult> {
  const created = await drive.files.create({
    requestBody: {
      name: filename,
      parents: [folderId],
      mimeType: XLSX_MIME,
    },
    media: {
      mimeType: XLSX_MIME,
      body: Readable.from(buffer),
    },
    fields: "id,name,webViewLink",
  });

  const fileId = created.data.id;
  if (!fileId) throw new DriveBackupError("UPLOAD_FAILED", "파일 업로드 실패");

  // 같은 폴더의 xlsx 목록 (오래된 순)
  const all = await drive.files.list({
    q: `'${escapeForQ(folderId)}' in parents and mimeType='${XLSX_MIME}' and trashed=false`,
    orderBy: "createdTime",
    fields: "files(id,name,createdTime)",
    spaces: "drive",
    pageSize: 100,
  });
  const files = all.data.files ?? [];

  let rotatedDeleted = 0;
  if (files.length > keep) {
    const toDelete = files.slice(0, files.length - keep);
    for (const f of toDelete) {
      if (!f.id || f.id === fileId) continue;
      try {
        await drive.files.delete({ fileId: f.id });
        rotatedDeleted += 1;
      } catch {
        // 개별 삭제 실패는 무시 (다음 백업 때 정리됨)
      }
    }
  }

  return {
    fileId,
    fileName: created.data.name ?? filename,
    webViewLink: created.data.webViewLink ?? `https://drive.google.com/file/d/${fileId}/view`,
    rotatedDeleted,
  };
}

/** 에러 분류 헬퍼 */
export function isInvalidGrant(err: unknown): boolean {
  const e = err as { message?: string; response?: { data?: { error?: string } } };
  return (
    e?.response?.data?.error === "invalid_grant" ||
    e?.message?.includes("invalid_grant") === true
  );
}

export function isStorageQuotaExceeded(err: unknown): boolean {
  const e = err as { errors?: { reason?: string }[]; message?: string };
  return (
    e?.errors?.some((x) => x.reason === "storageQuotaExceeded") === true ||
    e?.message?.includes("storageQuotaExceeded") === true
  );
}

/** invalid_grant 일 때 DB 토큰 제거 */
export async function clearStoredToken(): Promise<void> {
  const admin = createAdminClient();
  await admin.from("finance_backup_config").delete().eq("id", "singleton");
}
