import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { parseISO } from "date-fns";
import type { Transaction } from "@/types/database";
import {
  aggregateByItem,
  formatPercent,
  formatReportAmount,
  type ReportViewMode,
} from "@/lib/reports/reportView";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export interface ReportPrintParams {
  viewMode: ReportViewMode;
  reportKindLabel: string; // 주간보고서 | 월간보고서 | 일정선택 보고서
  appTitle: string;
  reportPeriod: string;
  currency: string;
  incomeTransactions: Transaction[];
  expenseTransactions: Transaction[];
  incomeItemOrder?: string[];
  expenseItemOrder?: string[];
  summaryTitle: string;
  prevBalanceLabel: string;
  prevBalance: number;
  incomeTotal: number;
  expenseTotal: number;
  currentBalanceLabel: string;
  currentBalance: number;
  account1Name: string;
  account2Name: string;
  account3Name: string;
  cashAmount: number;
  touchAmount: number;
  otherAmount: number;
  sign1Label: string;
  sign2Label: string;
  sign3Label: string;
  author: string;
  manager: string;
  auditor: string;
  maxRows?: number;
}

function buildDetailRows(
  transactions: Transaction[],
  amountClass: "income" | "expense",
  maxRows: number,
): string {
  const dataRows = transactions
    .map((t) => {
      const date = format(parseISO(t.date), "MM/dd");
      return `<tr>
        <td>${date}</td>
        <td>${escapeHtml(t.item || "")}</td>
        <td>${escapeHtml(t.description || "")}</td>
        <td class="amount ${amountClass}">${formatReportAmount(Number(t.amount))}</td>
      </tr>`;
    })
    .join("");

  const emptyRows = Array.from({ length: Math.max(0, maxRows - transactions.length) })
    .map(() => `<tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>`)
    .join("");

  return dataRows + emptyRows;
}

function buildSummaryRows(
  transactions: Transaction[],
  preferredOrder: string[],
  amountClass: "income" | "expense",
  maxRows: number,
): string {
  const rows = aggregateByItem(transactions, preferredOrder);
  const dataRows = rows
    .map(
      (r) => `<tr>
        <td>${escapeHtml(r.item)}</td>
        <td class="amount">${r.count}</td>
        <td class="amount ${amountClass}">${formatReportAmount(r.total)}</td>
        <td class="amount">${formatPercent(r.percent)}</td>
      </tr>`,
    )
    .join("");

  const emptyRows = Array.from({ length: Math.max(0, maxRows - rows.length) })
    .map(() => `<tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>`)
    .join("");

  return dataRows + emptyRows;
}

/** 보고서 출력용 HTML 생성 (상세목록 / 항목별 합산) */
export function buildReportPrintHtml(params: ReportPrintParams): string {
  const maxRows = params.maxRows ?? 30;
  const viewSuffix = params.viewMode === "summary" ? " · 항목별 합산" : " · 상세목록";
  const reportTitle = `${params.appTitle} ${params.reportKindLabel}${viewSuffix}`;
  const createdDate = format(new Date(), "yyyy년 MM월 dd일 HH:mm", { locale: ko });
  const totalAccount = params.cashAmount + params.touchAmount + params.otherAmount;

  const incomeTableRows =
    params.viewMode === "summary"
      ? buildSummaryRows(params.incomeTransactions, params.incomeItemOrder || [], "income", maxRows)
      : buildDetailRows(params.incomeTransactions, "income", maxRows);

  const expenseTableRows =
    params.viewMode === "summary"
      ? buildSummaryRows(params.expenseTransactions, params.expenseItemOrder || [], "expense", maxRows)
      : buildDetailRows(params.expenseTransactions, "expense", maxRows);

  const incomeHead =
    params.viewMode === "summary"
      ? `<tr><th style="width: 40%;">항목</th><th style="width: 15%;">건수</th><th style="width: 25%;">합계</th><th style="width: 20%;">구성비</th></tr>`
      : `<tr><th style="width: 15%;">날짜</th><th style="width: 20%;">항목</th><th style="width: 50%;">내용</th><th style="width: 15%;">금액</th></tr>`;

  const expenseHead = incomeHead;

  return `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(reportTitle)}</title>
    <style>
        * { box-sizing: border-box; }
        @page { size: A4; margin: 10mm; }
        body {
            font-family: 'Malgun Gothic', '맑은 고딕', Arial, sans-serif;
            margin: 0;
            padding: 0;
            background-color: white;
            font-size: 12px;
            line-height: 1.4;
        }
        .report-container {
            width: 100%;
            max-width: 190mm;
            margin: 0 auto;
            padding: 5mm;
        }
        .header {
            text-align: center;
            margin-bottom: 8mm;
            border-bottom: 2px solid #2E7D32;
            padding-bottom: 5mm;
        }
        .header h1 {
            color: #2E7D32;
            margin: 0 0 5px 0;
            font-size: 20px;
        }
        .header p {
            color: #666;
            margin: 2px 0 0 0;
            font-size: 11px;
        }
        .content {
            display: flex;
            gap: 5mm;
            margin-bottom: 5mm;
        }
        .section {
            flex: 1;
            min-width: 0;
        }
        .section h3 {
            background-color: #2E7D32;
            color: white;
            padding: 6px 10px;
            margin: 0 0 5px 0;
            border-radius: 3px;
            text-align: center;
            font-size: 13px;
        }
        .data-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 3mm;
            font-size: 10px;
        }
        .data-table th, .data-table td {
            border: 1px solid #ddd;
            padding: 4px 6px;
            text-align: left;
            font-size: 10px;
            line-height: 1.3;
        }
        /* 상세: 금액만 우측 / 합산: 건수·합계·구성비 우측 */
        .data-table.detail th:last-child,
        .data-table.detail td:last-child,
        .data-table.summary th:nth-child(n+2),
        .data-table.summary td:nth-child(n+2) {
            text-align: right;
        }
        .data-table th {
            background-color: #f2f2f2;
            font-weight: bold;
        }
        .data-table tr:nth-child(even) {
            background-color: #f9f9f9;
        }
        .summary-section {
            display: flex;
            gap: 5mm;
            margin-bottom: 3mm;
        }
        .summary, .account-info {
            flex: 1;
            background-color: #f8f9fa;
            padding: 8px;
            border-radius: 3px;
            border: 1px solid #ddd;
        }
        .summary h4, .account-info h4 {
            color: #2E7D32;
            margin: 0 0 8px 0;
            font-size: 12px;
            font-weight: bold;
        }
        .summary-row, .account-row {
            display: flex;
            justify-content: space-between;
            margin: 3px 0;
            padding: 2px 0;
            border-bottom: 1px solid #eee;
            font-size: 10px;
        }
        .summary-row:last-child, .account-row:last-child {
            border-bottom: none;
            font-weight: bold;
            font-size: 11px;
            color: #2E7D32;
            margin-top: 5px;
        }
        .amount {
            text-align: right;
            font-weight: bold;
        }
        .income { color: #1976D2; }
        .expense { color: #D32F2F; }
        .signature-section {
            margin-top: auto;
            padding-top: 5mm;
        }
        .signature-label {
            font-weight: bold;
            color: #2E7D32;
            font-size: 11px;
            text-align: center;
            margin-bottom: 5px;
        }
        .signature-row {
            display: flex;
            justify-content: space-between;
            gap: 20px;
        }
        .signature-box {
            flex: 1;
            text-align: center;
            border: 1px solid #2E7D32;
            border-radius: 5px;
            padding: 8px;
            background-color: #f9f9f9;
            min-height: 50px;
        }
        .signature-line {
            border: 1px solid #ccc;
            width: 100%;
            height: 35px;
            background-color: white;
            border-radius: 3px;
            margin-top: 5px;
        }

        @media print {
            @page { margin: 10mm; }
            body { font-size: 11px; }
            .header h1 { font-size: 18px; }
            .header p { font-size: 10px; }
            .section h3 { font-size: 12px; padding: 5px 8px; }
            .data-table { font-size: 9px; }
            .data-table th, .data-table td { padding: 3px 4px; font-size: 9px; }
            .summary h4, .account-info h4 { font-size: 11px; }
            .summary-row, .account-row { font-size: 9px; }
            .summary-row:last-child, .account-row:last-child { font-size: 10px; }
            .signature-label { font-size: 10px; }
            .signature-box { min-height: 45px; padding: 6px; }
            .signature-line { height: 30px; }
        }
    </style>
</head>
<body>
    <div class="report-container">
        <div class="header">
            <h1>${escapeHtml(reportTitle)}</h1>
            <p>보고 기간: ${escapeHtml(params.reportPeriod)}</p>
            <p>생성일: ${createdDate}</p>
        </div>
        <div class="content">
            <div class="section">
                <h3>수입 내역</h3>
                <table class="data-table ${params.viewMode === "summary" ? "summary" : "detail"}">
                    <thead>${incomeHead}</thead>
                    <tbody>${incomeTableRows}</tbody>
                </table>
            </div>
            <div class="section">
                <h3>지출 내역</h3>
                <table class="data-table ${params.viewMode === "summary" ? "summary" : "detail"}">
                    <thead>${expenseHead}</thead>
                    <tbody>${expenseTableRows}</tbody>
                </table>
            </div>
        </div>
        <div class="summary-section">
            <div class="summary">
                <h4>${escapeHtml(params.summaryTitle)}</h4>
                <div class="summary-row"><span>${escapeHtml(params.prevBalanceLabel)}:</span><span class="amount">${formatReportAmount(params.prevBalance)} ${escapeHtml(params.currency)}</span></div>
                <div class="summary-row"><span>총 수입:</span><span class="amount income">${formatReportAmount(params.incomeTotal)} ${escapeHtml(params.currency)}</span></div>
                <div class="summary-row"><span>총 지출:</span><span class="amount expense">${formatReportAmount(params.expenseTotal)} ${escapeHtml(params.currency)}</span></div>
                <div class="summary-row"><span>${escapeHtml(params.currentBalanceLabel)}:</span><span class="amount">${formatReportAmount(params.currentBalance)} ${escapeHtml(params.currency)}</span></div>
            </div>
            <div class="account-info">
                <h4>계좌 현황</h4>
                <div class="account-row"><span>${escapeHtml(params.account1Name)}:</span><span class="amount">${formatReportAmount(params.cashAmount)} ${escapeHtml(params.currency)}</span></div>
                <div class="account-row"><span>${escapeHtml(params.account2Name)}:</span><span class="amount">${formatReportAmount(params.touchAmount)} ${escapeHtml(params.currency)}</span></div>
                <div class="account-row"><span>${escapeHtml(params.account3Name)}:</span><span class="amount">${formatReportAmount(params.otherAmount)} ${escapeHtml(params.currency)}</span></div>
                <div class="account-row"><span>총 계좌:</span><span class="amount">${formatReportAmount(totalAccount)} ${escapeHtml(params.currency)}</span></div>
            </div>
        </div>
        <div class="signature-section">
            <div class="signature-row">
                <div class="signature-box"><div class="signature-label">${escapeHtml(params.sign1Label)}: ${escapeHtml(params.author)}</div><div class="signature-line"></div></div>
                <div class="signature-box"><div class="signature-label">${escapeHtml(params.sign2Label)}: ${escapeHtml(params.manager)}</div><div class="signature-line"></div></div>
                <div class="signature-box"><div class="signature-label">${escapeHtml(params.sign3Label)}: ${escapeHtml(params.auditor)}</div><div class="signature-line"></div></div>
            </div>
        </div>
    </div>
</body>
</html>`;
}

export function openReportPrintWindow(html: string): boolean {
  const printWindow = window.open("", "_blank", "width=800,height=600");
  if (!printWindow) return false;
  printWindow.document.write(html);
  printWindow.document.close();
  return true;
}
