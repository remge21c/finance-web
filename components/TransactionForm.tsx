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

interface TransactionFormProps {
  settings: Settings | null;
  selectedTransaction: Transaction | null;
  onSubmit: (data: TransactionInput) => Promise<void>;
  onUpdate: (id: string, data: TransactionInput) => Promise<void>;
  onClear: () => void;
}

export default function TransactionForm({
  settings,
  selectedTransaction,
  onSubmit,
  onUpdate,
  onClear,
}: TransactionFormProps) {
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [type, setType] = useState<"수입" | "지출">("지출");
  const [item, setItem] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [loading, setLoading] = useState(false);

  // 선택된 거래가 있으면 폼에 채우기
  useEffect(() => {
    if (selectedTransaction) {
      setDate(selectedTransaction.date);
      setType(selectedTransaction.type as "수입" | "지출");
      setItem(selectedTransaction.item);
      setDescription(selectedTransaction.description || "");
      setAmount(selectedTransaction.amount.toString());
      setMemo(selectedTransaction.memo || "");
    }
  }, [selectedTransaction]);

  const items = type === "수입" 
    ? (settings?.income_items || []) 
    : (settings?.expense_items || []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!item || !amount) {
      return;
    }

    setLoading(true);
    
    const data: TransactionInput = {
      date,
      type,
      item,
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

  const handleClear = () => {
    setDate(new Date().toISOString().split("T")[0]);
    setType("지출");
    setItem("");
    setDescription("");
    setAmount("");
    setMemo("");
    onClear();
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white p-4 rounded-lg shadow mb-4">
      <div className="grid grid-cols-2 md:grid-cols-7 gap-3 items-end">
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

        {/* 구분 */}
        <div className="space-y-1">
          <Label htmlFor="type" className="text-xs">구분</Label>
          <Select value={type} onValueChange={(v) => { setType(v as "수입" | "지출"); setItem(""); }}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="수입">수입</SelectItem>
              <SelectItem value="지출">지출</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* 항목 */}
        <div className="space-y-1">
          <Label htmlFor="item" className="text-xs">항목</Label>
          <Select value={item} onValueChange={setItem}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="선택" />
            </SelectTrigger>
            <SelectContent>
              {items.map((i) => (
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
          <Label htmlFor="amount" className="text-xs">금액 ({settings?.currency || "원"})</Label>
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

        {/* 메모 */}
        <div className="space-y-1">
          <Label htmlFor="memo" className="text-xs">메모</Label>
          <Input
            id="memo"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="메모"
            className="h-9"
          />
        </div>

        {/* 버튼들 */}
        <div className="flex space-x-2">
          <Button
            type="submit"
            disabled={loading || !item || !amount}
            className="h-9 bg-emerald-600 hover:bg-emerald-700"
          >
            {selectedTransaction ? "수정" : "추가"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleClear}
            className="h-9"
          >
            새입력
          </Button>
        </div>
      </div>
    </form>
  );
}

