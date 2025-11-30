"use client";

import { useState, useMemo } from "react";
import { useTransactions } from "@/lib/hooks/useTransactions";
import { useSettings } from "@/lib/hooks/useSettings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  format,
  parseISO,
  isWithinInterval,
} from "date-fns";

export default function AllListPage() {
  const { transactions, loading: txLoading } = useTransactions();
  const { settings, loading: settingsLoading } = useSettings();

  const today = new Date();
  const [startDate, setStartDate] = useState(format(startOfMonth(today), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(endOfMonth(today), "yyyy-MM-dd"));
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [itemFilter, setItemFilter] = useState<string>("all");

  const loading = txLoading || settingsLoading;
  const currency = settings?.currency || "원";

  // 필터링된 거래
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const date = parseISO(t.date);
      const start = parseISO(startDate);
      const end = parseISO(endDate);
      
      // 날짜 필터
      if (!isWithinInterval(date, { start, end })) return false;
      
      // 구분 필터
      if (typeFilter !== "all" && t.type !== typeFilter) return false;
      
      // 항목 필터
      if (itemFilter !== "all" && t.item !== itemFilter) return false;
      
      return true;
    });
  }, [transactions, startDate, endDate, typeFilter, itemFilter]);

  // 총액 계산
  const totalAmount = useMemo(() => {
    return filteredTransactions.reduce((sum, t) => sum + Number(t.amount), 0);
  }, [filteredTransactions]);

  // 항목 목록
  const items = useMemo(() => {
    if (typeFilter === "수입") return settings?.income_items || [];
    if (typeFilter === "지출") return settings?.expense_items || [];
    return [...(settings?.income_items || []), ...(settings?.expense_items || [])];
  }, [typeFilter, settings]);

  const formatAmount = (amount: number) => {
    return amount.toLocaleString("ko-KR", {
      minimumFractionDigits: amount % 1 === 0 ? 0 : 1,
      maximumFractionDigits: 1,
    });
  };

  // 빠른 날짜 선택
  const setThisWeek = () => {
    const start = startOfWeek(today, { weekStartsOn: 1 });
    const end = endOfWeek(today, { weekStartsOn: 1 });
    setStartDate(format(start, "yyyy-MM-dd"));
    setEndDate(format(end, "yyyy-MM-dd"));
  };

  const setThisMonth = () => {
    setStartDate(format(startOfMonth(today), "yyyy-MM-dd"));
    setEndDate(format(endOfMonth(today), "yyyy-MM-dd"));
  };

  const setThisYear = () => {
    setStartDate(format(startOfYear(today), "yyyy-MM-dd"));
    setEndDate(format(endOfYear(today), "yyyy-MM-dd"));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <h1 className="text-2xl font-bold text-gray-800">전체 목록 보기</h1>

      {/* 필터 */}
      <Card>
        <CardContent className="py-4">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3 items-end">
            {/* 시작일 */}
            <div className="space-y-1">
              <Label htmlFor="startDate" className="text-xs">시작일</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-9"
              />
            </div>

            {/* 종료일 */}
            <div className="space-y-1">
              <Label htmlFor="endDate" className="text-xs">종료일</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-9"
              />
            </div>

            {/* 구분 */}
            <div className="space-y-1">
              <Label className="text-xs">구분</Label>
              <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setItemFilter("all"); }}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  <SelectItem value="수입">수입</SelectItem>
                  <SelectItem value="지출">지출</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 항목 */}
            <div className="space-y-1">
              <Label className="text-xs">항목</Label>
              <Select value={itemFilter} onValueChange={setItemFilter}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  {items.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 빠른 선택 버튼 */}
            <div className="col-span-2 flex space-x-2">
              <Button variant="outline" size="sm" onClick={setThisWeek} className="flex-1 h-9">
                이번주
              </Button>
              <Button variant="outline" size="sm" onClick={setThisMonth} className="flex-1 h-9">
                이번달
              </Button>
              <Button variant="outline" size="sm" onClick={setThisYear} className="flex-1 h-9">
                올해
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 결과 테이블 */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="table-fixed w-full">
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="w-[100px]">날짜</TableHead>
                  <TableHead className="w-[60px]">구분</TableHead>
                  <TableHead className="w-[100px]">항목</TableHead>
                  <TableHead className="w-[180px]">내용</TableHead>
                  <TableHead className="w-[100px] text-right">금액 ({currency})</TableHead>
                  <TableHead className="w-[140px]">메모</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                      조회 결과가 없습니다.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTransactions.map((t, index) => (
                    <TableRow
                      key={t.id}
                      className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}
                    >
                      <TableCell className="truncate">{t.date}</TableCell>
                      <TableCell>
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            t.type === "수입"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {t.type}
                        </span>
                      </TableCell>
                      <TableCell className="truncate">{t.item}</TableCell>
                      <TableCell className="truncate">{t.description}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatAmount(Number(t.amount))}
                      </TableCell>
                      <TableCell className="text-gray-500 text-sm truncate">
                        {t.memo}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* 총액 표시 */}
          <div className="flex justify-end p-4 border-t bg-emerald-50">
            <div className="text-lg">
              <span className="text-gray-600">조회된 총액: </span>
              <span className="font-bold text-emerald-700">
                {formatAmount(totalAmount)} {currency}
              </span>
              <span className="text-gray-500 text-sm ml-2">
                ({filteredTransactions.length}건)
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}




