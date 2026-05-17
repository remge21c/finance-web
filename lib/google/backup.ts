import type { drive_v3 } from "googleapis";
import { createAdminClient } from "@/lib/supabase/admin-client";
import {
  DriveBackupError,
  clearStoredToken,
  ensureGroupBackupFolder,
  getDriveClient,
  isInvalidGrant,
  isStorageQuotaExceeded,
  loadBackupConfig,
  uploadXlsxAndRotate,
} from "@/lib/google/drive";
import { buildBackupFilename, buildBackupWorkbook } from "@/lib/google/excel";
import type { BackupTriggerType, Group, Settings, Transaction } from "@/types/database";

export interface BackupGroupResult {
  group_id: string;
  group_name: string;
  ok: boolean;
  file_id?: string;
  file_name?: string;
  web_view_link?: string;
  rotated_deleted?: number;
  error_code?: string;
  error_message?: string;
}

function mapError(err: unknown): { code: string; message: string; isFatal: boolean } {
  if (err instanceof DriveBackupError) {
    return { code: err.code, message: err.message, isFatal: err.code === "NO_TOKEN" };
  }
  if (isInvalidGrant(err)) {
    return {
      code: "INVALID_GRANT",
      message: "Google 인증이 만료되었습니다. 재연결이 필요합니다.",
      isFatal: true,
    };
  }
  if (isStorageQuotaExceeded(err)) {
    return {
      code: "STORAGE_QUOTA_EXCEEDED",
      message: "Google Drive 용량이 부족합니다.",
      isFatal: true,
    };
  }
  const message = err instanceof Error ? err.message : String(err);
  return { code: "UNKNOWN", message, isFatal: false };
}

/** 한 그룹 백업 */
async function backupSingleGroup(
  drive: drive_v3.Drive,
  group: Pick<Group, "id" | "name">,
  trigger: BackupTriggerType,
  triggeredBy: string | null,
  targetFolderId: string,
): Promise<BackupGroupResult> {
  const admin = createAdminClient();
  const backupAt = new Date();

  try {
    // 데이터 로드 (service_role 사용 — 슈퍼관리자 정당 사용)
    const [{ data: transactions }, { data: settings }] = await Promise.all([
      admin
        .from("finance_transactions")
        .select("*")
        .eq("group_id", group.id)
        .order("date", { ascending: true }),
      admin
        .from("finance_settings")
        .select("*")
        .eq("group_id", group.id)
        .maybeSingle(),
    ]);

    // 폴더 보장 + Excel 빌드 + 업로드
    const folderId = await ensureGroupBackupFolder(drive, group.name, group.id, targetFolderId);
    const buffer = await buildBackupWorkbook({
      transactions: (transactions ?? []) as Transaction[],
      settings: (settings ?? null) as Settings | null,
      group,
      backupAt,
    });
    const filename = buildBackupFilename(group.name, backupAt);

    const upload = await uploadXlsxAndRotate(drive, folderId, filename, buffer, 3);

    // 로그 기록
    await admin.from("finance_backup_log").insert({
      group_id: group.id,
      triggered_by: triggeredBy,
      trigger_type: trigger,
      status: "success",
      file_id: upload.fileId,
      file_name: upload.fileName,
      web_view_link: upload.webViewLink,
      rotated_deleted: upload.rotatedDeleted,
      error_message: null,
    });

    return {
      group_id: group.id,
      group_name: group.name,
      ok: true,
      file_id: upload.fileId,
      file_name: upload.fileName,
      web_view_link: upload.webViewLink,
      rotated_deleted: upload.rotatedDeleted,
    };
  } catch (err) {
    const mapped = mapError(err);

    await admin.from("finance_backup_log").insert({
      group_id: group.id,
      triggered_by: triggeredBy,
      trigger_type: trigger,
      status: "failure",
      file_id: null,
      file_name: null,
      web_view_link: null,
      rotated_deleted: 0,
      error_message: mapped.message,
    });

    if (mapped.code === "INVALID_GRANT") {
      await clearStoredToken().catch(() => {});
    }

    return {
      group_id: group.id,
      group_name: group.name,
      ok: false,
      error_code: mapped.code,
      error_message: mapped.message,
    };
  }
}

export interface RunBackupOptions {
  groupId?: string; // 미지정 시 전체 department 그룹
  trigger: BackupTriggerType;
  triggeredBy: string | null;
}

export interface RunBackupSummary {
  results: BackupGroupResult[];
  total: number;
  succeeded: number;
  failed: number;
  fatalError?: { code: string; message: string };
}

export async function runBackup(opts: RunBackupOptions): Promise<RunBackupSummary> {
  const admin = createAdminClient();

  // Drive 클라이언트 (토큰 없으면 NO_TOKEN 에러)
  let drive: drive_v3.Drive;
  try {
    drive = await getDriveClient();
  } catch (err) {
    const mapped = mapError(err);
    return {
      results: [],
      total: 0,
      succeeded: 0,
      failed: 0,
      fatalError: { code: mapped.code, message: mapped.message },
    };
  }

  // 대상 폴더 ID 로드 (Picker 로 선택되어 있어야 함)
  const config = await loadBackupConfig();
  const targetFolderId = config?.target_folder_id;
  if (!targetFolderId) {
    return {
      results: [],
      total: 0,
      succeeded: 0,
      failed: 0,
      fatalError: {
        code: "NO_TARGET_FOLDER",
        message: "백업 폴더가 선택되지 않았습니다. 백업 설정에서 폴더를 선택하세요.",
      },
    };
  }

  // 대상 그룹 목록
  let groups: Pick<Group, "id" | "name">[] = [];
  if (opts.groupId) {
    const { data } = await admin
      .from("finance_groups")
      .select("id, name")
      .eq("id", opts.groupId)
      .maybeSingle();
    if (data) groups = [data as Pick<Group, "id" | "name">];
  } else {
    const { data } = await admin
      .from("finance_groups")
      .select("id, name")
      .eq("group_type", "department")
      .order("name");
    groups = (data ?? []) as Pick<Group, "id" | "name">[];
  }

  const results: BackupGroupResult[] = [];
  let succeeded = 0;
  let failed = 0;

  for (const g of groups) {
    const result = await backupSingleGroup(drive, g, opts.trigger, opts.triggeredBy, targetFolderId);
    results.push(result);
    if (result.ok) succeeded += 1;
    else failed += 1;

    // 토큰 무효화된 경우 추가 그룹 시도 무의미 — 중단
    if (result.error_code === "INVALID_GRANT") break;
  }

  // last_backup_at / last_backup_error 갱신
  const lastErr = results.find((r) => !r.ok);
  await admin
    .from("finance_backup_config")
    .update({
      last_backup_at: new Date().toISOString(),
      last_backup_error: lastErr ? `${lastErr.error_code}: ${lastErr.error_message}` : null,
    })
    .eq("id", "singleton");

  return {
    results,
    total: groups.length,
    succeeded,
    failed,
  };
}
