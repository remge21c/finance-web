import ExcelJS from "exceljs";
import type { Group, Settings, Transaction } from "@/types/database";

const HEADER_FILL = "FFE8F0FE";
const INCOME_FILL = "FFE3F2FD";
const EXPENSE_FILL = "FFFCE8E6";

export interface BuildWorkbookInput {
  transactions: Transaction[];
  settings: Settings | null;
  group: Pick<Group, "id" | "name">;
  backupAt: Date;
}

function currencyFormat(currency: string | undefined) {
  const cur = currency || "원";
  return `#,##0"${cur}"`;
}

function applyHeaderStyle(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.font = { bold: true };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: HEADER_FILL },
    };
    cell.border = {
      top: { style: "thin", color: { argb: "FFB0BEC5" } },
      bottom: { style: "thin", color: { argb: "FFB0BEC5" } },
      left: { style: "thin", color: { argb: "FFB0BEC5" } },
      right: { style: "thin", color: { argb: "FFB0BEC5" } },
    };
  });
}

function buildTransactionsSheet(
  workbook: ExcelJS.Workbook,
  transactions: Transaction[],
  currencyFmt: string,
) {
  const sheet = workbook.addWorksheet("거래내역", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  sheet.columns = [
    { header: "날짜", key: "date", width: 12 },
    { header: "구분", key: "type", width: 8 },
    { header: "항목", key: "item", width: 16 },
    { header: "내용", key: "description", width: 32 },
    { header: "금액", key: "amount", width: 14, style: { numFmt: currencyFmt } },
    { header: "메모", key: "memo", width: 24 },
  ];

  applyHeaderStyle(sheet.getRow(1));

  for (const tx of transactions) {
    const row = sheet.addRow({
      date: tx.date,
      type: tx.type,
      item: tx.item,
      description: tx.description,
      amount: Number(tx.amount) || 0,
      memo: tx.memo,
    });
    const fill = tx.type === "수입" ? INCOME_FILL : EXPENSE_FILL;
    row.getCell("type").fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: fill },
    };
    row.getCell("description").alignment = { wrapText: true, vertical: "top" };
    row.getCell("memo").alignment = { wrapText: true, vertical: "top" };
  }

  // 합계 행
  const total = transactions.reduce(
    (acc, t) => {
      const amt = Number(t.amount) || 0;
      if (t.type === "수입") acc.income += amt;
      else acc.expense += amt;
      return acc;
    },
    { income: 0, expense: 0 },
  );
  sheet.addRow([]);
  const summary = sheet.addRow(["합계", "수입", "", "", total.income, ""]);
  summary.font = { bold: true };
  summary.getCell(5).numFmt = currencyFmt;
  const summary2 = sheet.addRow(["", "지출", "", "", total.expense, ""]);
  summary2.font = { bold: true };
  summary2.getCell(5).numFmt = currencyFmt;
  const summary3 = sheet.addRow(["", "잔액", "", "", total.income - total.expense, ""]);
  summary3.font = { bold: true };
  summary3.getCell(5).numFmt = currencyFmt;
}

function buildMonthlySheet(
  workbook: ExcelJS.Workbook,
  transactions: Transaction[],
  currencyFmt: string,
) {
  const sheet = workbook.addWorksheet("월별 요약", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  sheet.columns = [
    { header: "월", key: "month", width: 12 },
    { header: "수입", key: "income", width: 14, style: { numFmt: currencyFmt } },
    { header: "지출", key: "expense", width: 14, style: { numFmt: currencyFmt } },
    { header: "잔액", key: "balance", width: 14, style: { numFmt: currencyFmt } },
  ];
  applyHeaderStyle(sheet.getRow(1));

  const byMonth = new Map<string, { income: number; expense: number }>();
  for (const tx of transactions) {
    const month = (tx.date || "").slice(0, 7); // YYYY-MM
    if (!month) continue;
    const cur = byMonth.get(month) ?? { income: 0, expense: 0 };
    const amt = Number(tx.amount) || 0;
    if (tx.type === "수입") cur.income += amt;
    else cur.expense += amt;
    byMonth.set(month, cur);
  }

  const months = Array.from(byMonth.keys()).sort();
  for (const m of months) {
    const v = byMonth.get(m)!;
    sheet.addRow({
      month: m,
      income: v.income,
      expense: v.expense,
      balance: v.income - v.expense,
    });
  }
}

function buildInfoSheet(
  workbook: ExcelJS.Workbook,
  group: Pick<Group, "id" | "name">,
  settings: Settings | null,
  backupAt: Date,
) {
  const sheet = workbook.addWorksheet("그룹 정보");
  sheet.columns = [
    { header: "항목", key: "label", width: 16 },
    { header: "값", key: "value", width: 50 },
  ];
  applyHeaderStyle(sheet.getRow(1));

  const rows: Array<[string, string]> = [
    ["그룹명", group.name],
    ["그룹 ID", group.id],
    ["작성자", settings?.author || ""],
    ["책임자", settings?.manager || ""],
    ["감사자", settings?.auditor || ""],
    ["통화", settings?.currency || "원"],
    ["백업 일시", backupAt.toISOString()],
  ];
  for (const [label, value] of rows) {
    sheet.addRow({ label, value });
  }
}

export async function buildBackupWorkbook(input: BuildWorkbookInput): Promise<Buffer> {
  const { transactions, settings, group, backupAt } = input;
  const wb = new ExcelJS.Workbook();
  wb.creator = "finance-web";
  wb.created = backupAt;

  const currencyFmt = currencyFormat(settings?.currency);

  buildTransactionsSheet(wb, transactions, currencyFmt);
  buildMonthlySheet(wb, transactions, currencyFmt);
  buildInfoSheet(wb, group, settings, backupAt);

  const arrayBuffer = await wb.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer as ArrayBuffer);
}

/** 백업 파일명: {그룹명}_{YYYY-MM-DD_HHmm}.xlsx */
export function buildBackupFilename(groupName: string, when: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  const stamp =
    `${when.getFullYear()}-${pad(when.getMonth() + 1)}-${pad(when.getDate())}` +
    `_${pad(when.getHours())}${pad(when.getMinutes())}`;
  const safe = groupName.replace(/[\\/:*?"<>|]/g, "_").trim() || "group";
  return `${safe}_${stamp}.xlsx`;
}
