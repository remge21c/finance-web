"use client";

import { useState } from "react";
import { useTransactions } from "@/lib/hooks/useTransactions";
import { useSettings } from "@/lib/hooks/useSettings";
import TransactionForm from "@/components/TransactionForm";
import TransactionTable from "@/components/TransactionTable";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { Transaction, TransactionInput } from "@/types/database";

export default function DashboardPage() {
  const { transactions, loading: txLoading, addTransaction, updateTransaction, deleteMultipleTransactions } = useTransactions();
  const { settings, loading: settingsLoading } = useSettings();
  
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<"weekly" | "all">("weekly");

  const loading = txLoading || settingsLoading;

  const handleSubmit = async (data: TransactionInput) => {
    const result = await addTransaction(data);
    if (result.error) {
      toast.error("추가 실패: " + result.error);
    } else {
      toast.success("거래가 추가되었습니다.");
    }
  };

  const handleUpdate = async (id: string, data: TransactionInput) => {
    const result = await updateTransaction(id, data);
    if (result.error) {
      toast.error("수정 실패: " + result.error);
    } else {
      toast.success("거래가 수정되었습니다.");
    }
  };

  // 선택 상태에 따라 폼의 단일 선택 정보를 동기화
  const syncSelectedTransaction = (nextIds: string[], lastSelected?: Transaction | null) => {
    if (nextIds.length === 0) {
      setSelectedTransaction(null);
      return;
    }

    if (nextIds.length === 1) {
      if (lastSelected && lastSelected.id === nextIds[0]) {
        setSelectedTransaction(lastSelected);
        return;
      }
      const target = transactions.find((t) => t.id === nextIds[0]) || null;
      setSelectedTransaction(target);
      return;
    }

    if (lastSelected) {
      setSelectedTransaction(lastSelected);
    }
  };

  // 개별 항목 체크 토글
  const handleToggleSelect = (transaction: Transaction, checked: boolean) => {
    setSelectedIds((prev) => {
      let next: string[];

      if (checked) {
        if (prev.includes(transaction.id)) {
          return prev;
        }
        next = [...prev, transaction.id];
      } else {
        if (!prev.includes(transaction.id)) {
          return prev;
        }
        next = prev.filter((id) => id !== transaction.id);
      }

      syncSelectedTransaction(next, checked ? transaction : undefined);
      return next;
    });
  };

  // 화면에 보이는 항목 전체 선택/해제
  const handleToggleSelectAll = (ids: string[], checked: boolean) => {
    if (ids.length === 0) {
      if (!checked) {
        setSelectedIds([]);
        setSelectedTransaction(null);
      }
      return;
    }

    const removeSet = new Set(ids);

    setSelectedIds((prev) => {
      let next: string[];

      if (checked) {
        const merged = new Set(prev);
        ids.forEach((id) => merged.add(id));
        next = Array.from(merged);
      } else {
        let changed = false;
        next = prev.filter((id) => {
          if (removeSet.has(id)) {
            changed = true;
            return false;
          }
          return true;
        });
        if (!changed) {
          return prev;
        }
      }

      syncSelectedTransaction(next);
      return next;
    });
  };

  // 현재 선택 상태 기준 삭제
  const handleDeleteSelected = async () => {
    const ids =
      selectedIds.length > 0
        ? selectedIds
        : selectedTransaction
          ? [selectedTransaction.id]
          : [];

    if (ids.length === 0) {
      toast.error("삭제할 항목을 선택하세요.");
      return;
    }

    if (!confirm(`${ids.length}개 항목을 삭제하시겠습니까?`)) {
      return;
    }
    
    const result = await deleteMultipleTransactions(ids);
    if (result.error) {
      toast.error("삭제 실패: " + result.error);
      return;
    }

      toast.success(`${ids.length}개 항목이 삭제되었습니다.`);
      setSelectedIds([]);
    setSelectedTransaction(null);
  };

  const handleEdit = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setSelectedIds([transaction.id]); // 수정 시 해당 항목도 체크
  };

  const handleClear = () => {
    setSelectedTransaction(null);
    setSelectedIds([]); // 새입력 시 선택 해제
  };

  // CSV 저장 함수
  const handleCsvExport = () => {
    if (transactions.length === 0) {
      toast.error("저장할 데이터가 없습니다.");
      return;
    }

    // CSV 헤더
    const headers = ["날짜", "구분", "항목", "내용", "금액", "메모"];
    
    // CSV 데이터 생성
    const csvRows = [
      headers.join(","),
      ...transactions.map((tx) => {
        const row = [
          tx.date,
          tx.type,
          `"${tx.item}"`,
          `"${tx.description || ""}"`,
          tx.amount.toString(),
          `"${tx.memo || ""}"`,
        ];
        return row.join(",");
      }),
    ];

    const csvContent = "\uFEFF" + csvRows.join("\n"); // BOM 추가 (한글 지원)
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    
    // 파일 다운로드
    const link = document.createElement("a");
    link.href = url;
    link.download = `재정출납부_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    
    URL.revokeObjectURL(url);
    toast.success("CSV 파일이 저장되었습니다.");
  };

  // CSV 불러오기 트리거 (파일 선택 대화상자 열기)
  const handleCsvImportClick = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

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

        // CSV 파싱 유틸
        const parseCsvLine = (line: string) => {
          const result: string[] = [];
          let current = "";
          let inQuotes = false;

          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
              if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
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

        if (importedData.length === 0) {
          toast.error("불러올 데이터가 없습니다.");
          return;
        }

        let successCount = 0;
        let errorCount = 0;

        for (const item of importedData) {
          const result = await addTransaction(item);
          if (result.error) {
            errorCount++;
          } else {
            successCount++;
          }
        }

        if (errorCount > 0) {
          toast.warning(`${successCount}개 성공, ${errorCount}개 실패`);
        } else {
          toast.success(`${successCount}개 항목을 불러왔습니다.`);
        }
      };
      reader.readAsText(file, "UTF-8");
    };
    input.click();
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
      {/* 헤더와 입력 폼 - 함께 고정 */}
      <div className="sticky top-[56px] z-40 bg-white border-b shadow-sm">
        {/* 헤더 */}
        <div className="pb-4 pt-2 border-b">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-800">재정출납부</h1>
            <div className="flex items-center space-x-2">
              <Button
                variant={viewMode === "weekly" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("weekly")}
                className={viewMode === "weekly" ? "bg-emerald-600 hover:bg-emerald-700" : ""}
              >
                주간보기
              </Button>
              <Button
                variant={viewMode === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("all")}
                className={viewMode === "all" ? "bg-emerald-600 hover:bg-emerald-700" : ""}
              >
                전체보기
              </Button>
            </div>
          </div>
        </div>

        {/* 입력 폼 */}
        <div className="pb-4 pt-4">
          <TransactionForm
            settings={settings}
            selectedTransaction={selectedTransaction}
            selectedCount={selectedIds.length}
            transactions={transactions}
            onSubmit={handleSubmit}
            onUpdate={handleUpdate}
            onDelete={handleDeleteSelected}
            onClear={handleClear}
          />
        </div>
      </div>

      {/* 거래 테이블 */}
      <TransactionTable
        transactions={transactions}
        settings={settings}
        selectedIds={selectedIds}
        onToggleSelect={handleToggleSelect}
        onToggleSelectAll={handleToggleSelectAll}
        onDeleteSelected={handleDeleteSelected}
        onCsvExport={handleCsvExport}
        onCsvImport={handleCsvImportClick}
        viewMode={viewMode}
      />
    </div>
  );
}










