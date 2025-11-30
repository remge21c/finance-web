"use client";

import { useState, useEffect } from "react";
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

// 메모 옵션 (결제 방법)
const MEMO_OPTIONS = [
  "터치앤고결제",
  "우건결제",
  "카드결제",
  "현금결제",
  "계좌이체",
  "기타",
];

interface TransactionFormProps {
  settings: Settings | null;
  selectedTransaction: Transaction | null;
  onSubmit: (data: TransactionInput) => Promise<void>;
  onUpdate: (id: string, data: TransactionInput) => Promise<void>;
  onDelete?: (ids: string[]) => Promise<void>;
  onClear: () => void;
}

export default function TransactionForm({
  settings,
  selectedTransaction,
  onSubmit,
  onUpdate,
  onDelete,
  onClear,
}: TransactionFormProps) {
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [type, setType] = useState<"수입" | "지출">("지출");
  const [incomeItem, setIncomeItem] = useState("");
  const [expenseItem, setExpenseItem] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [loading, setLoading] = useState(false);

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
      if (selectedTransaction) {
        await onUpdate(selectedTransaction.id, data);
      } else {
        await onSubmit(data);
      }
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

  // 삭제 버튼 핸들러
  const handleDelete = async () => {
    if (!selectedTransaction || !onDelete) return;
    await onDelete([selectedTransaction.id]);
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
      <div className="grid grid-cols-2 md:grid-cols-8 gap-2 items-end">
        {/* 날짜 */}
        <div className="space-y-1">
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
        <div className="space-y-1">
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
        <div className="space-y-1">
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
        <div className="space-y-1">
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
        <div className="space-y-1">
          <Label htmlFor="amount" className="text-xs">금액({settings?.currency || "RM"})</Label>
          <Input
            id="amount"
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            className="h-9"
          />
        </div>

        {/* 메모 (드롭다운) */}
        <div className="space-y-1">
          <Label htmlFor="memo" className="text-xs">메모</Label>
          <Select value={memo} onValueChange={setMemo}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="선택" />
            </SelectTrigger>
            <SelectContent>
              {MEMO_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 버튼들 - 추가, 수정, 삭제, 새입력 */}
        <div className="col-span-2 flex space-x-1">
          <Button
            type="submit"
            disabled={loading || !currentItem || !amount || !!selectedTransaction}
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
            disabled={loading || !selectedTransaction}
            onClick={handleDelete}
            className="h-9 px-3"
          >
            삭제
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
      </div>
    </form>
  );
}



