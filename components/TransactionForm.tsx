"use client";

import { useState, useEffect, useMemo, useRef } from "react";
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
import type { Transaction, TransactionInput, Settings } from "@/types/database";

// CSV 한 줄을 안전하게 파싱하는 유틸 (쉼표/따옴표/공백 모두 대응)
const parseCsvLine = (line: string) => {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // 이스케이프된 따옴표 건너뛰기
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current);
  return result.map((value) => value.replace(/\r/g, ""));
};

interface TransactionFormProps {
  settings: Settings | null;
  selectedTransaction: Transaction | null;
  selectedCount: number; // 선택된 항목 개수
  transactions?: Transaction[]; // 메모 빈도 계산용
  onSubmit: (data: TransactionInput) => Promise<void>;
  onUpdate: (id: string, data: TransactionInput) => Promise<void>;
  onDelete?: () => Promise<void>; // 삭제 버튼 클릭 시 부모 로직 실행
  onClear: () => void;
  onCsvExport?: () => void; // CSV 저장
  onCsvImport?: (data: TransactionInput[]) => Promise<void>; // CSV 불러오기
}

export default function TransactionForm({
  settings,
  selectedTransaction,
  selectedCount = 0,
  transactions = [],
  onSubmit,
  onUpdate,
  onDelete,
  onClear,
  onCsvExport,
  onCsvImport,
}: TransactionFormProps) {
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [type, setType] = useState<"수입" | "지출">("지출");
  const [incomeItem, setIncomeItem] = useState("");
  const [expenseItem, setExpenseItem] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [loading, setLoading] = useState(false);
  const [showMemoDropdown, setShowMemoDropdown] = useState(false);
  const memoInputRef = useRef<HTMLInputElement>(null);
  const memoDropdownRef = useRef<HTMLDivElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  // CSV 파일 불러오기 핸들러
  const handleCsvFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onCsvImport) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = (event.target?.result as string) || "";
      const lines = text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
      
      // 첫 번째 줄은 헤더로 가정
      const dataLines = lines.slice(1);
      const importedData: TransactionInput[] = [];

      dataLines.forEach((line) => {
        const values = parseCsvLine(line).map((value) =>
          value.replace(/^"|"$/g, "").trim()
        );

        if (values.length >= 5) {
          const [
            csvDate,
            csvType,
            csvItem,
            csvDescription = "",
            csvAmount = "",
            csvMemo = "",
          ] = values;

          const normalizedType = csvType === "수입" ? "수입" : csvType === "지출" ? "지출" : null;
          const normalizedAmount = Number(csvAmount.replace(/,/g, ""));

          if (csvDate && normalizedType && csvItem && !Number.isNaN(normalizedAmount)) {
            importedData.push({
              date: csvDate,
              type: normalizedType,
              item: csvItem,
              description: csvDescription,
              amount: normalizedAmount,
              memo: csvMemo,
            });
          }
        }
      });

      if (importedData.length > 0) {
        await onCsvImport(importedData);
      }
    };
    reader.readAsText(file, "UTF-8");
    
    // 파일 입력 초기화 (같은 파일 다시 선택 가능하도록)
    e.target.value = "";
  };

  // 기존 거래에서 메모 빈도 계산 (사용 횟수 순으로 정렬)
  const memoSuggestions = useMemo(() => {
    const memoCount: Record<string, number> = {};
    
    transactions.forEach((tx) => {
      if (tx.memo && tx.memo.trim()) {
        const memoText = tx.memo.trim();
        memoCount[memoText] = (memoCount[memoText] || 0) + 1;
      }
    });

    // 사용 횟수 순으로 정렬
    return Object.entries(memoCount)
      .sort((a, b) => b[1] - a[1])
      .map(([text, count]) => ({ text, count }));
  }, [transactions]);

  // 현재 입력값과 일치하는 메모 필터링
  const filteredMemos = useMemo(() => {
    if (!memo.trim()) return memoSuggestions;
    return memoSuggestions.filter((m) =>
      m.text.toLowerCase().includes(memo.toLowerCase())
    );
  }, [memo, memoSuggestions]);

  // 메모 입력 필드 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        memoInputRef.current &&
        !memoInputRef.current.contains(event.target as Node) &&
        memoDropdownRef.current &&
        !memoDropdownRef.current.contains(event.target as Node)
      ) {
        setShowMemoDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 선택된 거래가 있으면 폼에 채우기
  useEffect(() => {
    if (selectedTransaction) {
      setDate(selectedTransaction.date);
      setType(selectedTransaction.type as "수입" | "지출");
      if (selectedTransaction.type === "수입") {
        setIncomeItem(selectedTransaction.item);
        setExpenseItem("");
      } else {
        setExpenseItem(selectedTransaction.item);
        setIncomeItem("");
      }
      setDescription(selectedTransaction.description || "");
      setAmount(selectedTransaction.amount.toString());
      setMemo(selectedTransaction.memo || "");
    }
  }, [selectedTransaction]);

  // 현재 선택된 항목 (수입항목 또는 지출항목 중 값이 있는 것)
  const currentItem = incomeItem || expenseItem;
  const currentType = incomeItem ? "수입" : expenseItem ? "지출" : type;

  const handleIncomeItemChange = (value: string) => {
    setIncomeItem(value);
    setExpenseItem(""); // 수입항목 선택 시 지출항목 초기화
    setType("수입");
  };

  const handleExpenseItemChange = (value: string) => {
    setExpenseItem(value);
    setIncomeItem(""); // 지출항목 선택 시 수입항목 초기화
    setType("지출");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // form submit은 추가 버튼에서만 호출됨
    await handleAdd();
  };
    
  // 추가 버튼 핸들러 - 항상 새 거래 추가
  const handleAdd = async () => {
    if (!currentItem || !amount) {
      return;
    }

    setLoading(true);
    
    const data: TransactionInput = {
      date,
      type: currentType,
      item: currentItem,
      description,
      amount: parseFloat(amount),
      memo,
    };

    try {
      await onSubmit(data); // 항상 추가
      handleClear();
    } finally {
      setLoading(false);
    }
  };

  // 수정 버튼 핸들러 (폼 제출과 동일)
  const handleUpdate = async () => {
    if (!selectedTransaction || !currentItem || !amount) return;
    
    setLoading(true);
    const data: TransactionInput = {
      date,
      type: currentType,
      item: currentItem,
      description,
      amount: parseFloat(amount),
      memo,
    };

    try {
        await onUpdate(selectedTransaction.id, data);
      handleClear();
    } finally {
      setLoading(false);
    }
  };

  // 삭제 버튼 핸들러 - 부모 컴포넌트 로직 실행 후 폼 초기화
  const handleDeleteClick = async () => {
    if (!onDelete) return;
    await onDelete();
    handleClear();
  };

  const handleClear = () => {
    setDate(new Date().toISOString().split("T")[0]);
    setType("지출");
    setIncomeItem("");
    setExpenseItem("");
    setDescription("");
    setAmount("");
    setMemo("");
    onClear();
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white p-4 rounded-lg shadow mb-4">
      <div className="flex flex-wrap items-end gap-2">
        {/* 날짜 */}
        <div className="space-y-1 w-[130px]">
          <Label htmlFor="date" className="text-xs">날짜</Label>
          <Input
            id="date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-9"
          />
        </div>

        {/* 수입항목 */}
        <div className="space-y-1 w-[100px]">
          <Label htmlFor="income-item" className="text-xs">수입항목</Label>
          <Select value={incomeItem} onValueChange={handleIncomeItemChange}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="수입" />
            </SelectTrigger>
            <SelectContent>
              {(settings?.income_items || []).map((i) => (
                <SelectItem key={i} value={i}>
                  {i}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 지출항목 */}
        <div className="space-y-1 w-[100px]">
          <Label htmlFor="expense-item" className="text-xs">지출항목</Label>
          <Select value={expenseItem} onValueChange={handleExpenseItemChange}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="지출" />
            </SelectTrigger>
            <SelectContent>
              {(settings?.expense_items || []).map((i) => (
                <SelectItem key={i} value={i}>
                  {i}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 내용 */}
        <div className="space-y-1 flex-1 min-w-[150px]">
          <Label htmlFor="description" className="text-xs">내용</Label>
          <Input
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="내용 입력"
            className="h-9"
          />
        </div>

        {/* 금액 */}
        <div className="space-y-1 w-[90px]">
          <Label htmlFor="amount" className="text-xs">금액({settings?.currency || "RM"})</Label>
          <Input
            id="amount"
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            className="h-9 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
        </div>

        {/* 메모 (텍스트 입력 + 드롭다운) */}
        <div className="space-y-1 relative w-[180px]">
          <Label htmlFor="memo" className="text-xs">메모</Label>
          <Input
            ref={memoInputRef}
            id="memo"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            onFocus={() => setShowMemoDropdown(true)}
            placeholder="메모 입력"
            className="h-9"
            autoComplete="off"
          />
          {/* 메모 드롭다운 */}
          {showMemoDropdown && filteredMemos.length > 0 && (
            <div
              ref={memoDropdownRef}
              className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto"
            >
              {filteredMemos.map((item) => (
                <button
                  key={item.text}
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex justify-between items-center"
                  onClick={() => {
                    setMemo(item.text);
                    setShowMemoDropdown(false);
                  }}
                >
                  <span>{item.text}</span>
                  <span className="text-xs text-gray-400">({item.count}회)</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 버튼들 - 추가, 수정, 삭제, 새입력, CSV저장, CSV불러오기 */}
        <div className="flex space-x-1 flex-wrap gap-1 items-end">
          <Button
            type="submit"
            disabled={loading || !currentItem || !amount}
            className="h-9 px-3 bg-emerald-600 hover:bg-emerald-700"
          >
            추가
          </Button>
          <Button
            type="button"
            disabled={loading || !selectedTransaction || !currentItem || !amount}
            onClick={handleUpdate}
            className="h-9 px-3 bg-blue-600 hover:bg-blue-700"
          >
            수정
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={loading || (selectedCount === 0 && !selectedTransaction)}
            onClick={handleDeleteClick}
            className="h-9 px-3"
          >
            삭제
            {selectedCount > 0
              ? ` (${selectedCount})`
              : selectedTransaction
                ? " (1)"
                : ""}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleClear}
            className="h-9 px-3"
          >
            새입력
          </Button>
        </div>
        {/* CSV 파일 입력 (숨김) */}
        {onCsvImport && (
          <input
            ref={csvInputRef}
            type="file"
            accept=".csv"
            onChange={handleCsvFileChange}
            className="hidden"
          />
        )}
      </div>
    </form>
  );
}









