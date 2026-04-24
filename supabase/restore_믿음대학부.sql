-- 믿음대학부 그룹 복구
-- 실행 전: Supabase SQL Editor에서 실행

WITH new_group AS (
  INSERT INTO finance_groups (name, description, group_type, created_by, created_at, updated_at)
  VALUES ('믿음대학부', '', 'department', 'c2a4eaf2-94ce-4ef8-8c73-13cc6fb854f7', NOW(), NOW())
  RETURNING id
),
new_member AS (
  INSERT INTO finance_group_members (group_id, user_id, permission_level, joined_at)
  SELECT id, 'c2a4eaf2-94ce-4ef8-8c73-13cc6fb854f7', 'admin', NOW()
  FROM new_group
  RETURNING id
),
new_transactions AS (
  INSERT INTO finance_transactions (user_id, group_id, date, type, item, description, amount, memo, created_at, updated_at)
  SELECT
    'c2a4eaf2-94ce-4ef8-8c73-13cc6fb854f7',
    new_group.id,
    t.date::date,
    t.type,
    t.item,
    t.description,
    t.amount::int,
    '',
    NOW(),
    NOW()
  FROM new_group,
  (VALUES
    ('2026-03-28', '수입', '기타', '이자', 27),
    ('2026-03-31', '수입', '기타', '3월 재정 이월', 391173),
    ('2026-04-04', '수입', '기타', '담임목사 간식비 후원', 30000),
    ('2026-04-05', '수입', '바자회', '1째주 바자회 수입', 352700),
    ('2026-04-18', '수입', '바자회', '2째주 바자회 수입', 260000),
    ('2026-04-12', '지출', '다과비', '바자회 준비 다과비', 24400)
  ) AS t(date, type, item, description, amount)
  RETURNING id
),
new_settings AS (
  INSERT INTO finance_settings (user_id, group_id, app_title, income_items, expense_items, income_budgets, expense_budgets, author, manager, auditor, currency, memo, cash_amount, touch_amount, other_amount, account1_name, account2_name, account3_name, updated_at)
  SELECT
    'c2a4eaf2-94ce-4ef8-8c73-13cc6fb854f7',
    new_group.id,
    '대학부 재정',
    '["기타", "바자회"]'::jsonb,
    '["다과비"]'::jsonb,
    '[0, 0]'::jsonb,
    '[0]'::jsonb,
    '송나은',
    '김성자',
    '재정부장',
    '원',
    '',
    0, 0, 0,
    '현금', '대학부', '(주)브오',
    NOW()
  FROM new_group
  RETURNING id
)
SELECT
  (SELECT id FROM new_group) AS group_id,
  (SELECT COUNT(*) FROM new_transactions) AS transactions_inserted,
  (SELECT COUNT(*) FROM new_member) AS members_inserted,
  (SELECT COUNT(*) FROM new_settings) AS settings_inserted;
