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
  addWeeks,
  subWeeks,
  addMonths,
  subMonths,
} from "date-fns";

export default function AllListPage() {
  const { transactions, loading: txLoading } = useTransactions();
  const { settings, loading: settingsLoading } = useSettings();

  const today = new Date();
  // 기본값: 이번 주 (월요일 ~ 일요일)
  const [startDate, setStartDate] = useState(format(startOfWeek(today, { weekStartsOn: 1 }), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(endOfWeek(today, { weekStartsOn: 1 }), "yyyy-MM-dd"));
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [itemFilter, setItemFilter] = useState<string>("all");

  const loading = txLoading || settingsLoading;
  const currency = settings?.currency || "원";

  // 필터링된 거래 (최근 날짜가 위로 오도록 내림차순 정렬)
  const filteredTransactions = useMemo(() => {
    const filtered = transactions.filter((t) => {
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

    // 날짜 내림차순 정렬 (최근 날짜가 위로)
    return [...filtered].sort((a, b) => {
      const dateA = parseISO(a.date).getTime();
      const dateB = parseISO(b.date).getTime();
      return dateB - dateA; // 내림차순
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

  // 항목 필터 드롭다운 폭 계산
  const maxItemLength = useMemo(() => {
    if (items.length === 0) return 0;
    return Math.max(...items.map((item) => item.length));
  }, [items]);

  const itemFilterWidth = useMemo(() => {
    const calculated = Math.max(100, maxItemLength * 12 + 40);
    return Math.min(calculated, 200);
  }, [maxItemLength]);

  const formatAmount = (amount: number) => {
    return amount.toLocaleString("ko-KR", {
      minimumFractionDigits: amount % 1 === 0 ? 0 : 1,
      maximumFractionDigits: 1,
    });
  };

  const formatDate = (dateString: string) => {
    const date = parseISO(dateString);
    const year = format(date, "yyyy");
    const monthDay = format(date, "MM-dd");
    return { year, monthDay };
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

  // 주 단위 이동
  const moveWeek = (direction: "prev" | "next") => {
    const currentStart = parseISO(startDate);
    const currentEnd = parseISO(endDate);
    
    // 현재 범위가 주 단위인지 확인 (대략적으로)
    const daysDiff = Math.abs((currentEnd.getTime() - currentStart.getTime()) / (1000 * 60 * 60 * 24));
    
    let newStart: Date;
    let newEnd: Date;
    
    if (daysDiff <= 7) {
      // 주 단위로 이동
      if (direction === "prev") {
        newStart = subWeeks(currentStart, 1);
        newEnd = subWeeks(currentEnd, 1);
      } else {
        newStart = addWeeks(currentStart, 1);
        newEnd = addWeeks(currentEnd, 1);
      }
    } else {
      // 주 단위가 아니면 현재 시작일 기준으로 주 단위 설정
      const weekStart = startOfWeek(currentStart, { weekStartsOn: 1 });
      if (direction === "prev") {
        newStart = subWeeks(weekStart, 1);
        newEnd = endOfWeek(newStart, { weekStartsOn: 1 });
      } else {
        newStart = addWeeks(weekStart, 1);
        newEnd = endOfWeek(newStart, { weekStartsOn: 1 });
      }
    }
    
    setStartDate(format(newStart, "yyyy-MM-dd"));
    setEndDate(format(newEnd, "yyyy-MM-dd"));
  };

  // 월 단위 이동
  const moveMonth = (direction: "prev" | "next") => {
    const currentStart = parseISO(startDate);
    const currentEnd = parseISO(endDate);
    
    // 현재 범위가 월 단위인지 확인
    const startMonth = startOfMonth(currentStart);
    const endMonth = endOfMonth(currentStart);
    const isMonthRange = 
      format(currentStart, "yyyy-MM-dd") === format(startMonth, "yyyy-MM-dd") &&
      format(currentEnd, "yyyy-MM-dd") === format(endMonth, "yyyy-MM-dd");
    
    let newStart: Date;
    let newEnd: Date;
    
    if (isMonthRange) {
      // 월 단위로 이동
      if (direction === "prev") {
        newStart = subMonths(currentStart, 1);
        newEnd = endOfMonth(newStart);
      } else {
        newStart = addMonths(currentStart, 1);
        newEnd = endOfMonth(newStart);
      }
    } else {
      // 월 단위가 아니면 현재 시작일 기준으로 월 단위 설정
      const monthStart = startOfMonth(currentStart);
      if (direction === "prev") {
        newStart = subMonths(monthStart, 1);
        newEnd = endOfMonth(newStart);
      } else {
        newStart = addMonths(monthStart, 1);
        newEnd = endOfMonth(newStart);
      }
    }
    
    setStartDate(format(newStart, "yyyy-MM-dd"));
    setEndDate(format(newEnd, "yyyy-MM-dd"));
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
      {/* 데스크톱: 헤더와 필터 - 함께 고정 */}
      <div className="hidden sm:block sticky top-[56px] z-40 bg-slate-50 border-b border-slate-200 pt-5 pb-4">
        {/* 첫 번째 카드: 헤더 + 필터 */}
        <Card className="shadow-sm bg-white">
          <CardContent className="p-4">
            {/* 헤더 */}
            <div className="pb-3 border-b border-slate-100 mb-3">
              <h1 className="text-xl font-bold text-slate-800">전체 목록</h1>
            </div>

            {/* 필터 */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3 items-center">
            {/* 시작일 */}
            <div className="space-y-1 min-w-0">
              <Label htmlFor="startDate" className="text-xs">시작일</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-9 w-full"
              />
            </div>

            {/* 종료일 */}
            <div className="space-y-1 min-w-0">
              <Label htmlFor="endDate" className="text-xs">종료일</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-9 w-full"
              />
            </div>

            {/* 구분 */}
            <div className="space-y-1 min-w-0">
              <Label className="text-xs">구분</Label>
              <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setItemFilter("all"); }}>
                <SelectTrigger className="h-9 w-full">
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
            <div className="space-y-1 min-w-0" style={{ minWidth: `${itemFilterWidth}px` }}>
              <Label className="text-xs">항목</Label>
              <Select value={itemFilter} onValueChange={setItemFilter}>
                <SelectTrigger className="h-9 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent style={{ minWidth: `${itemFilterWidth}px` }}>
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
            <div className="col-span-2 flex items-center gap-1 md:gap-2 flex-wrap min-w-0">
              {/* 주 단위 네비게이션 */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => moveWeek("prev")}
                  className="h-8 w-7 p-0 text-xs flex-shrink-0"
                  title="한 주 앞으로"
                >
                  ◀
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={setThisWeek}
                  className="h-8 px-2 md:px-4 text-xs whitespace-nowrap flex-shrink-0"
                >
                  이번주
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => moveWeek("next")}
                  className="h-8 w-7 p-0 text-xs flex-shrink-0"
                  title="한 주 뒤로"
                >
                  ▶
                </Button>
              </div>
              {/* 월 단위 네비게이션 */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => moveMonth("prev")}
                  className="h-8 w-7 p-0 text-xs flex-shrink-0"
                  title="한 달 앞으로"
                >
                  ◀
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={setThisMonth}
                  className="h-8 px-2 md:px-4 text-xs whitespace-nowrap flex-shrink-0"
                >
                  이번달
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => moveMonth("next")}
                  className="h-8 w-7 p-0 text-xs flex-shrink-0"
                  title="한 달 뒤로"
                >
                  ▶
                </Button>
              </div>
              {/* 올해 버튼 */}
              <Button
                variant="outline"
                size="sm"
                onClick={setThisYear}
                className="h-8 px-2 md:px-4 text-xs whitespace-nowrap flex-shrink-0"
              >
                올해
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      </div>

      {/* 모바일: 헤더와 필터 - 일반 스크롤 */}
      <div className="sm:hidden space-y-4">
        {/* 모바일 헤더 */}
        <div className="bg-slate-50 border-b border-slate-200 pt-4 pb-3">
          <h1 className="text-lg font-bold text-slate-800 px-1">전체 목록</h1>
        </div>

        {/* 모바일 필터 */}
        <Card className="shadow-sm bg-white">
          <CardContent className="p-3">
            {/* 필터 */}
            <div className="space-y-3">
              {/* 날짜와 구분 필터 */}
              <div className="grid grid-cols-2 gap-2">
                {/* 시작일 */}
                <div className="space-y-1">
                  <Label htmlFor="startDate-mobile" className="text-xs">시작일</Label>
                  <Input
                    id="startDate-mobile"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="h-9 w-full text-sm"
                  />
                </div>

                {/* 종료일 */}
                <div className="space-y-1">
                  <Label htmlFor="endDate-mobile" className="text-xs">종료일</Label>
                  <Input
                    id="endDate-mobile"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="h-9 w-full text-sm"
                  />
                </div>
              </div>

              {/* 구분과 항목 필터 */}
              <div className="grid grid-cols-2 gap-2">
                {/* 구분 */}
                <div className="space-y-1">
                  <Label className="text-xs">구분</Label>
                  <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setItemFilter("all"); }}>
                    <SelectTrigger className="h-9 w-full text-sm">
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
                    <SelectTrigger className="h-9 w-full text-sm">
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
              </div>

              {/* 빠른 선택 버튼 */}
              <div className="flex flex-wrap items-center gap-1.5">
                {/* 주 단위 네비게이션 */}
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => moveWeek("prev")}
                    className="h-7 w-6 p-0 text-xs"
                    title="한 주 앞으로"
                  >
                    ◀
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={setThisWeek}
                    className="h-7 px-2 text-xs"
                  >
                    이번주
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => moveWeek("next")}
                    className="h-7 w-6 p-0 text-xs"
                    title="한 주 뒤로"
                  >
                    ▶
                  </Button>
                </div>
                {/* 월 단위 네비게이션 */}
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => moveMonth("prev")}
                    className="h-7 w-6 p-0 text-xs"
                    title="한 달 앞으로"
                  >
                    ◀
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={setThisMonth}
                    className="h-7 px-2 text-xs"
                  >
                    이번달
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => moveMonth("next")}
                    className="h-7 w-6 p-0 text-xs"
                    title="한 달 뒤로"
                  >
                    ▶
                  </Button>
                </div>
                {/* 올해 버튼 */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={setThisYear}
                  className="h-7 px-2 text-xs"
                >
                  올해
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 결과 테이블 - 엑셀 스타일 */}
      <Card className="shadow-sm">
        <CardContent className="p-2 sm:p-4">
          <div className="-mx-2 sm:mx-0 overflow-x-auto rounded-lg border border-gray-300">
            <Table className="w-full border-collapse text-xs sm:text-sm min-w-[600px]">
              <TableHeader>
                <TableRow className="bg-gray-100 border-b-2 border-gray-300">
                  <TableHead className="min-w-[60px] sm:w-[100px] border border-gray-300 px-1.5 sm:px-3 py-2 text-center font-semibold text-xs sm:text-sm">날짜</TableHead>
                  <TableHead className="min-w-[45px] sm:w-[60px] border border-gray-300 px-1.5 sm:px-3 py-2 text-center font-semibold text-xs sm:text-sm">구분</TableHead>
                  <TableHead className="min-w-[60px] sm:w-[100px] border border-gray-300 px-1.5 sm:px-3 py-2 text-center font-semibold text-xs sm:text-sm">항목</TableHead>
                  <TableHead className="min-w-[70px] sm:w-[180px] border border-gray-300 px-1.5 sm:px-3 py-2 text-center font-semibold text-xs sm:text-sm">내용</TableHead>
                  <TableHead className="min-w-[60px] sm:w-[100px] border border-gray-300 px-1.5 sm:px-3 py-2 text-right font-semibold text-xs sm:text-sm">금액 ({currency})</TableHead>
                  <TableHead className="hidden sm:table-cell w-[118px] border border-gray-300 px-3 py-2 text-center font-semibold">메모</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-gray-500 border border-gray-300 text-xs sm:text-sm">
                      조회 결과가 없습니다.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTransactions.map((t, index) => (
                    <TableRow
                      key={t.id}
                      className={`border-b border-gray-300 ${
                        index % 2 === 0 ? "bg-white" : "bg-gray-50"
                      } hover:bg-blue-50`}
                    >
                      <TableCell className="border border-gray-300 px-1.5 sm:px-3 py-1.5 sm:py-2 text-center text-xs sm:text-sm">
                        <span className="sm:hidden">{formatDate(t.date).monthDay}</span>
                        <span className="hidden sm:inline">{t.date}</span>
                      </TableCell>
                      <TableCell className="border border-gray-300 px-1.5 sm:px-3 py-1.5 sm:py-2">
                        <span
                          className={`px-1 sm:px-2 py-0.5 sm:py-1 rounded text-xs font-medium ${
                            t.type === "수입"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {t.type}
                        </span>
                      </TableCell>
                      <TableCell className="border border-gray-300 px-1.5 sm:px-3 py-1.5 sm:py-2 truncate text-xs sm:text-sm">{t.item}</TableCell>
                      <TableCell className="border border-gray-300 px-1.5 sm:px-3 py-1.5 sm:py-2 truncate text-xs sm:text-sm">{t.description}</TableCell>
                      <TableCell className="border border-gray-300 px-1.5 sm:px-3 py-1.5 sm:py-2 text-right font-medium text-xs sm:text-sm">
                        {formatAmount(Number(t.amount))}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell border border-gray-300 px-3 py-2 text-gray-500 text-sm truncate">
                        {t.memo}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* 총액 표시 */}
          <div className="mt-4 p-3 sm:p-4 border-t-2 border-gray-300 bg-emerald-50 rounded-lg">
            <div className="flex flex-col sm:flex-row items-center justify-center sm:justify-end gap-1 sm:gap-2 text-center sm:text-right">
              <div className="text-xs sm:text-sm text-gray-600">
                조회된 총액:{" "}
                <span className="font-bold text-emerald-700 text-sm sm:text-base">
                  {formatAmount(totalAmount)} {currency}
                </span>
              </div>
              <span className="text-gray-500 text-xs">
                ({filteredTransactions.length}건)
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}





