-- ================================================
-- finance_backup_config: 백업 대상 폴더 컬럼 추가
-- Supabase Dashboard → SQL Editor 에서 실행
-- ================================================
--
-- 배경:
--   OAuth scope 는 drive.file 로 유지하면서 사용자가 Google Picker 로
--   직접 선택한 특정 폴더만 백업 대상으로 사용. 선택된 폴더 ID 와
--   표시 이름을 finance_backup_config 싱글톤 row 에 저장한다.
--
-- 이 SQL:
--   target_folder_id   — Google Drive 폴더 ID (Picker 응답값)
--   target_folder_name — 표시용 폴더 이름
--   target_picked_at   — 마지막 선택 시각
--
-- 모두 IF NOT EXISTS — 재실행 안전
-- ================================================

ALTER TABLE finance_backup_config
  ADD COLUMN IF NOT EXISTS target_folder_id   TEXT,
  ADD COLUMN IF NOT EXISTS target_folder_name TEXT,
  ADD COLUMN IF NOT EXISTS target_picked_at   TIMESTAMPTZ;

-- ================================================
-- 검증
-- ================================================
-- SELECT id, google_email, target_folder_id, target_folder_name, target_picked_at
-- FROM finance_backup_config
-- WHERE id = 'singleton';
