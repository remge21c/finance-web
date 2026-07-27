"use client";

import { format, parseISO } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Transaction } from "@/types/database";
import {
  aggregateByItem,
  formatPercent,
  formatReportAmount,
  type ReportViewMode,
} from "@/lib/reports/reportView";

interface ReportBodyTablesProps {
  viewMode: ReportViewMode;
  incomeTransactions: Transaction[];
  expenseTransactions: Transaction[];
  incomeItemOrder?: string[];
  expenseItemOrder?: string[];
  compact?: boolean;
}

/** 보고서 본문 테이블 (상세목록 / 항목별 합산) */
export default function ReportBodyTables({
  viewMode,
  incomeTransactions,
  expenseTransactions,
  incomeItemOrder = [],
  expenseItemOrder = [],
  compact = false,
}: ReportBodyTablesProps) {
  const cell = compact ? "text-xs sm:text-sm" : "text-sm";
  const headPad = compact ? "py-2 sm:py-3 px-3" : "py-3 px-4";

  if (viewMode === "summary") {
    const incomeRows = aggregateByItem(incomeTransactions, incomeItemOrder);
    const expenseRows = aggregateByItem(expenseTransactions, expenseItemOrder);

    return (
      <div className={`grid grid-cols-1 lg:grid-cols-2 ${compact ? "gap-3 sm:gap-4" : "gap-4"}`}>
        <Card>
          <CardHeader className={`bg-blue-50 ${headPad}`}>
            <CardTitle className="text-base sm:text-lg text-blue-700">수입 (항목별 합산)</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className={cell}>항목</TableHead>
                  <TableHead className={`text-right w-16 ${cell}`}>건수</TableHead>
                  <TableHead className={`text-right w-24 sm:w-28 ${cell}`}>합계</TableHead>
                  <TableHead className={`text-right w-16 sm:w-20 ${cell}`}>구성비</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {incomeRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className={`text-center py-4 text-gray-400 ${cell}`}>
                      수입 내역 없음
                    </TableCell>
                  </TableRow>
                ) : (
                  incomeRows.map((r, i) => (
                    <TableRow key={r.item} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <TableCell className={cell}>{r.item}</TableCell>
                      <TableCell className={`text-right ${cell}`}>{r.count}</TableCell>
                      <TableCell className={`text-right ${cell}`}>{formatReportAmount(r.total)}</TableCell>
                      <TableCell className={`text-right ${cell}`}>{formatPercent(r.percent)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className={`bg-red-50 ${headPad}`}>
            <CardTitle className="text-base sm:text-lg text-red-700">지출 (항목별 합산)</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className={cell}>항목</TableHead>
                  <TableHead className={`text-right w-16 ${cell}`}>건수</TableHead>
                  <TableHead className={`text-right w-24 sm:w-28 ${cell}`}>합계</TableHead>
                  <TableHead className={`text-right w-16 sm:w-20 ${cell}`}>구성비</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenseRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className={`text-center py-4 text-gray-400 ${cell}`}>
                      지출 내역 없음
                    </TableCell>
                  </TableRow>
                ) : (
                  expenseRows.map((r, i) => (
                    <TableRow key={r.item} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <TableCell className={cell}>{r.item}</TableCell>
                      <TableCell className={`text-right ${cell}`}>{r.count}</TableCell>
                      <TableCell className={`text-right ${cell}`}>{formatReportAmount(r.total)}</TableCell>
                      <TableCell className={`text-right ${cell}`}>{formatPercent(r.percent)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-1 lg:grid-cols-2 ${compact ? "gap-3 sm:gap-4" : "gap-4"}`}>
      <Card>
        <CardHeader className={`bg-blue-50 ${headPad}`}>
          <CardTitle className="text-base sm:text-lg text-blue-700">수입</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className={`w-16 sm:w-24 ${cell}`}>날짜</TableHead>
                <TableHead className={`w-20 sm:w-28 ${cell}`}>항목</TableHead>
                <TableHead className={cell}>내용</TableHead>
                <TableHead className={`text-right w-20 sm:w-28 ${cell}`}>금액</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {incomeTransactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className={`text-center py-4 text-gray-400 ${cell}`}>
                    수입 내역 없음
                  </TableCell>
                </TableRow>
              ) : (
                incomeTransactions.map((t, i) => (
                  <TableRow key={t.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <TableCell className={cell}>{format(parseISO(t.date), "MM-dd")}</TableCell>
                    <TableCell className={cell}>{t.item}</TableCell>
                    <TableCell className={cell}>{t.description}</TableCell>
                    <TableCell className={`text-right ${cell}`}>
                      {formatReportAmount(Number(t.amount))}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className={`bg-red-50 ${headPad}`}>
          <CardTitle className="text-base sm:text-lg text-red-700">지출</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className={`w-16 sm:w-24 ${cell}`}>날짜</TableHead>
                <TableHead className={`w-20 sm:w-28 ${cell}`}>항목</TableHead>
                <TableHead className={cell}>내용</TableHead>
                <TableHead className={`text-right w-20 sm:w-28 ${cell}`}>금액</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenseTransactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className={`text-center py-4 text-gray-400 ${cell}`}>
                    지출 내역 없음
                  </TableCell>
                </TableRow>
              ) : (
                expenseTransactions.map((t, i) => (
                  <TableRow key={t.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <TableCell className={cell}>{format(parseISO(t.date), "MM-dd")}</TableCell>
                    <TableCell className={cell}>{t.item}</TableCell>
                    <TableCell className={cell}>{t.description}</TableCell>
                    <TableCell className={`text-right ${cell}`}>
                      {formatReportAmount(Number(t.amount))}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
