"use client";

import { useState, useEffect, useMemo } from "react";
import { useSettings } from "@/lib/hooks/useSettings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

export default function SettingsPage() {
  const { settings, loading, updateSettings } = useSettings();

  // 수입/지출 항목
  const [incomeItems, setIncomeItems] = useState<string[]>(Array(10).fill(""));
  const [expenseItems, setExpenseItems] = useState<string[]>(Array(10).fill(""));
  
  // 예산
  const [incomeBudgets, setIncomeBudgets] = useState<string[]>(Array(10).fill(""));
  const [expenseBudgets, setExpenseBudgets] = useState<string[]>(Array(10).fill(""));
  
  // 작성자 정보
  const [author, setAuthor] = useState("");
  const [manager, setManager] = useState("");
  const [currency, setCurrency] = useState("원");
  const [memo, setMemo] = useState("");

  // 원본값 저장 (변경사항 비교용)
  const [originalValues, setOriginalValues] = useState({
    incomeItems: Array(10).fill(""),
    expenseItems: Array(10).fill(""),
    incomeBudgets: Array(10).fill(""),
    expenseBudgets: Array(10).fill(""),
    author: "",
    manager: "",
    currency: "원",
    memo: "",
  });

  // 설정 로드
  useEffect(() => {
    if (settings) {
      const loadedIncomeItems = [...(settings.income_items || [])];
      const loadedExpenseItems = [...(settings.expense_items || [])];
      const loadedIncomeBudgets = [...(settings.income_budgets || [])];
      const loadedExpenseBudgets = [...(settings.expense_budgets || [])];
      
      // 10개로 맞추기
      while (loadedIncomeItems.length < 10) loadedIncomeItems.push("");
      while (loadedExpenseItems.length < 10) loadedExpenseItems.push("");
      while (loadedIncomeBudgets.length < 10) loadedIncomeBudgets.push(0);
      while (loadedExpenseBudgets.length < 10) loadedExpenseBudgets.push(0);
      
      const incomeItemsStr = loadedIncomeItems as string[];
      const expenseItemsStr = loadedExpenseItems as string[];
      const incomeBudgetsStr = loadedIncomeBudgets.map(String);
      const expenseBudgetsStr = loadedExpenseBudgets.map(String);
      
      setIncomeItems(incomeItemsStr);
      setExpenseItems(expenseItemsStr);
      setIncomeBudgets(incomeBudgetsStr);
      setExpenseBudgets(expenseBudgetsStr);
      setAuthor(settings.author || "");
      setManager(settings.manager || "");
      setCurrency(settings.currency || "원");
      setMemo(settings.memo || "");
      
      // 원본값 저장
      setOriginalValues({
        incomeItems: [...incomeItemsStr],
        expenseItems: [...expenseItemsStr],
        incomeBudgets: [...incomeBudgetsStr],
        expenseBudgets: [...expenseBudgetsStr],
        author: settings.author || "",
        manager: settings.manager || "",
        currency: settings.currency || "원",
        memo: settings.memo || "",
      });
    }
  }, [settings]);

  // 변경사항 확인
  const hasIncomeBudgetsChanged = useMemo(() => 
    JSON.stringify(incomeBudgets) !== JSON.stringify(originalValues.incomeBudgets), 
    [incomeBudgets, originalValues.incomeBudgets]
  );
  
  const hasExpenseBudgetsChanged = useMemo(() => 
    JSON.stringify(expenseBudgets) !== JSON.stringify(originalValues.expenseBudgets), 
    [expenseBudgets, originalValues.expenseBudgets]
  );
  
  const hasIncomeItemsChanged = useMemo(() => 
    JSON.stringify(incomeItems) !== JSON.stringify(originalValues.incomeItems), 
    [incomeItems, originalValues.incomeItems]
  );
  
  const hasExpenseItemsChanged = useMemo(() => 
    JSON.stringify(expenseItems) !== JSON.stringify(originalValues.expenseItems), 
    [expenseItems, originalValues.expenseItems]
  );
  
  const hasAuthorInfoChanged = useMemo(() => 
    author !== originalValues.author || 
    manager !== originalValues.manager || 
    currency !== originalValues.currency, 
    [author, manager, currency, originalValues]
  );
  
  const hasMemoChanged = useMemo(() => 
    memo !== originalValues.memo, 
    [memo, originalValues.memo]
  );
  
  const hasAnyChanged = useMemo(() => 
    hasIncomeBudgetsChanged || hasExpenseBudgetsChanged || 
    hasIncomeItemsChanged || hasExpenseItemsChanged || 
    hasAuthorInfoChanged || hasMemoChanged,
    [hasIncomeBudgetsChanged, hasExpenseBudgetsChanged, hasIncomeItemsChanged, hasExpenseItemsChanged, hasAuthorInfoChanged, hasMemoChanged]
  );

  // 전체 저장
  const handleSave = async () => {
    const result = await updateSettings({
      income_items: incomeItems.filter((i) => i.trim() !== ""),
      expense_items: expenseItems.filter((i) => i.trim() !== ""),
      income_budgets: incomeBudgets.map((b) => parseFloat(b) || 0),
      expense_budgets: expenseBudgets.map((b) => parseFloat(b) || 0),
      author,
      manager,
      currency,
      memo,
    });

    if (result.error) {
      toast.error("저장 실패: " + result.error);
    } else {
      toast.success("설정이 저장되었습니다.");
      // 원본값 업데이트
      setOriginalValues({
        incomeItems: [...incomeItems],
        expenseItems: [...expenseItems],
        incomeBudgets: [...incomeBudgets],
        expenseBudgets: [...expenseBudgets],
        author,
        manager,
        currency,
        memo,
      });
    }
  };

  // 수입예산 저장
  const handleSaveIncomeBudgets = async () => {
    const result = await updateSettings({
      income_budgets: incomeBudgets.map((b) => parseFloat(b) || 0),
    });
    if (result.error) {
      toast.error("수입예산 저장 실패: " + result.error);
    } else {
      toast.success("수입예산이 저장되었습니다.");
      setOriginalValues(prev => ({ ...prev, incomeBudgets: [...incomeBudgets] }));
    }
  };

  // 지출예산 저장
  const handleSaveExpenseBudgets = async () => {
    const result = await updateSettings({
      expense_budgets: expenseBudgets.map((b) => parseFloat(b) || 0),
    });
    if (result.error) {
      toast.error("지출예산 저장 실패: " + result.error);
    } else {
      toast.success("지출예산이 저장되었습니다.");
      setOriginalValues(prev => ({ ...prev, expenseBudgets: [...expenseBudgets] }));
    }
  };

  // 수입항목 저장
  const handleSaveIncomeItems = async () => {
    const result = await updateSettings({
      income_items: incomeItems.filter((i) => i.trim() !== ""),
    });
    if (result.error) {
      toast.error("수입항목 저장 실패: " + result.error);
    } else {
      toast.success("수입항목이 저장되었습니다.");
      setOriginalValues(prev => ({ ...prev, incomeItems: [...incomeItems] }));
    }
  };

  // 지출항목 저장
  const handleSaveExpenseItems = async () => {
    const result = await updateSettings({
      expense_items: expenseItems.filter((i) => i.trim() !== ""),
    });
    if (result.error) {
      toast.error("지출항목 저장 실패: " + result.error);
    } else {
      toast.success("지출항목이 저장되었습니다.");
      setOriginalValues(prev => ({ ...prev, expenseItems: [...expenseItems] }));
    }
  };

  // 작성자 정보 저장
  const handleSaveAuthorInfo = async () => {
    const result = await updateSettings({
      author,
      manager,
      currency,
    });
    if (result.error) {
      toast.error("작성자 정보 저장 실패: " + result.error);
    } else {
      toast.success("작성자 정보가 저장되었습니다.");
      setOriginalValues(prev => ({ ...prev, author, manager, currency }));
    }
  };

  // 설정 메모 저장
  const handleSaveMemo = async () => {
    const result = await updateSettings({ memo });
    if (result.error) {
      toast.error("메모 저장 실패: " + result.error);
    } else {
      toast.success("메모가 저장되었습니다.");
      setOriginalValues(prev => ({ ...prev, memo }));
    }
  };

  const handleReset = () => {
    if (!confirm("모든 설정을 초기화하시겠습니까?")) return;
    
    setIncomeItems(Array(10).fill(""));
    setExpenseItems(Array(10).fill(""));
    setIncomeBudgets(Array(10).fill(""));
    setExpenseBudgets(Array(10).fill(""));
    setAuthor("");
    setManager("");
    setCurrency("원");
    setMemo("");
    
    toast.info("설정이 초기화되었습니다. 저장 버튼을 눌러 적용하세요.");
  };

  // 예산 합계 계산
  const incomeBudgetTotal = incomeBudgets.reduce((sum, b) => sum + (parseFloat(b) || 0), 0);
  const expenseBudgetTotal = expenseBudgets.reduce((sum, b) => sum + (parseFloat(b) || 0), 0);

  const formatAmount = (amount: number) => {
    return amount.toLocaleString("ko-KR", {
      minimumFractionDigits: amount % 1 === 0 ? 0 : 1,
      maximumFractionDigits: 1,
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">설정</h1>
          <p className="text-gray-500 text-sm">수입/지출 항목 및 예산을 관리합니다</p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={handleReset}>
            초기화
          </Button>
          <Button 
            onClick={handleSave} 
            className={hasAnyChanged 
              ? "bg-emerald-600 hover:bg-emerald-700" 
              : "bg-gray-400 hover:bg-gray-500"
            }
          >
            저장
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 왼쪽 영역: 2x2 그리드 (예산 위, 항목 아래) */}
        <div className="lg:col-span-2 space-y-4">
          {/* 상단: 수입예산 / 지출예산 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 수입 예산 */}
            <Card className="border-2 border-blue-200">
              <CardHeader className="py-3 bg-blue-50 flex flex-row items-center justify-between">
                <CardTitle className="text-lg text-blue-700">수입예산</CardTitle>
                <Button 
                  size="sm" 
                  onClick={handleSaveIncomeBudgets} 
                  className={`h-7 px-2 text-xs ${hasIncomeBudgetsChanged ? "bg-blue-600 hover:bg-blue-700" : "bg-gray-400 hover:bg-gray-500"}`}
                >
                  저장
                </Button>
              </CardHeader>
              <CardContent className="space-y-2 pt-3">
                {incomeBudgets.map((budget, index) => (
                  <div key={`income-budget-${index}`} className="flex items-center space-x-2">
                    <span className="text-xs text-gray-500 w-20 truncate">
                      {incomeItems[index] || `항목 ${index + 1}`}
                    </span>
                    <Input
                      type="number"
                      value={budget}
                      onChange={(e) => {
                        const newBudgets = [...incomeBudgets];
                        newBudgets[index] = e.target.value;
                        setIncomeBudgets(newBudgets);
                      }}
                      className="h-8 flex-1"
                    />
                  </div>
                ))}
                <Separator />
                <div className="flex justify-between font-medium">
                  <span>총수입 예산:</span>
                  <span className="text-blue-600">{formatAmount(incomeBudgetTotal)} {currency}</span>
                </div>
              </CardContent>
            </Card>

            {/* 지출 예산 */}
            <Card className="border-2 border-red-200">
              <CardHeader className="py-3 bg-red-50 flex flex-row items-center justify-between">
                <CardTitle className="text-lg text-red-700">지출예산</CardTitle>
                <Button 
                  size="sm" 
                  onClick={handleSaveExpenseBudgets} 
                  className={`h-7 px-2 text-xs ${hasExpenseBudgetsChanged ? "bg-red-600 hover:bg-red-700" : "bg-gray-400 hover:bg-gray-500"}`}
                >
                  저장
                </Button>
              </CardHeader>
              <CardContent className="space-y-2 pt-3">
                {expenseBudgets.map((budget, index) => (
                  <div key={`expense-budget-${index}`} className="flex items-center space-x-2">
                    <span className="text-xs text-gray-500 w-20 truncate">
                      {expenseItems[index] || `항목 ${index + 1}`}
                    </span>
                    <Input
                      type="number"
                      value={budget}
                      onChange={(e) => {
                        const newBudgets = [...expenseBudgets];
                        newBudgets[index] = e.target.value;
                        setExpenseBudgets(newBudgets);
                      }}
                      className="h-8 flex-1"
                    />
                  </div>
                ))}
                <Separator />
                <div className="flex justify-between font-medium">
                  <span>총지출 예산:</span>
                  <span className="text-red-600">{formatAmount(expenseBudgetTotal)} {currency}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 하단: 수입항목 / 지출항목 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 수입 항목 */}
            <Card className="border-2 border-blue-200">
              <CardHeader className="py-3 bg-blue-50 flex flex-row items-center justify-between">
                <CardTitle className="text-lg text-blue-700">수입항목</CardTitle>
                <Button 
                  size="sm" 
                  onClick={handleSaveIncomeItems} 
                  className={`h-7 px-2 text-xs ${hasIncomeItemsChanged ? "bg-blue-600 hover:bg-blue-700" : "bg-gray-400 hover:bg-gray-500"}`}
                >
                  저장
                </Button>
              </CardHeader>
              <CardContent className="space-y-2 pt-3">
                {incomeItems.map((item, index) => (
                  <Input
                    key={`income-${index}`}
                    value={item}
                    onChange={(e) => {
                      const newItems = [...incomeItems];
                      newItems[index] = e.target.value;
                      setIncomeItems(newItems);
                    }}
                    placeholder={`항목 ${index + 1}`}
                    className="h-8"
                  />
                ))}
              </CardContent>
            </Card>

            {/* 지출 항목 */}
            <Card className="border-2 border-red-200">
              <CardHeader className="py-3 bg-red-50 flex flex-row items-center justify-between">
                <CardTitle className="text-lg text-red-700">지출항목</CardTitle>
                <Button 
                  size="sm" 
                  onClick={handleSaveExpenseItems} 
                  className={`h-7 px-2 text-xs ${hasExpenseItemsChanged ? "bg-red-600 hover:bg-red-700" : "bg-gray-400 hover:bg-gray-500"}`}
                >
                  저장
                </Button>
              </CardHeader>
              <CardContent className="space-y-2 pt-3">
                {expenseItems.map((item, index) => (
                  <Input
                    key={`expense-${index}`}
                    value={item}
                    onChange={(e) => {
                      const newItems = [...expenseItems];
                      newItems[index] = e.target.value;
                      setExpenseItems(newItems);
                    }}
                    placeholder={`항목 ${index + 1}`}
                    className="h-8"
                  />
                ))}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* 오른쪽: 작성자 정보 및 메모 */}
        <div className="space-y-4 flex flex-col">
          {/* 작성자 정보 */}
          <Card>
            <CardHeader className="py-3 flex flex-row items-center justify-between">
              <CardTitle className="text-lg">작성자 정보</CardTitle>
              <Button 
                size="sm" 
                onClick={handleSaveAuthorInfo} 
                className={`h-7 px-2 text-xs ${hasAuthorInfoChanged ? "bg-emerald-600 hover:bg-emerald-700" : "bg-gray-400 hover:bg-gray-500"}`}
              >
                저장
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="author" className="text-xs">작성자</Label>
                <Input
                  id="author"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  placeholder="작성자 이름"
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="manager" className="text-xs">책임자</Label>
                <Input
                  id="manager"
                  value={manager}
                  onChange={(e) => setManager(e.target.value)}
                  placeholder="책임자 이름"
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="currency" className="text-xs">금액 단위</Label>
                <Input
                  id="currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  placeholder="원"
                  className="h-9"
                />
              </div>
            </CardContent>
          </Card>

          {/* 메모 - 남은 공간 채우기 */}
          <Card className="flex-1 flex flex-col">
            <CardHeader className="py-3 flex flex-row items-center justify-between">
              <CardTitle className="text-lg">설정 메모</CardTitle>
              <Button 
                size="sm" 
                onClick={handleSaveMemo} 
                className={`h-7 px-2 text-xs ${hasMemoChanged ? "bg-emerald-600 hover:bg-emerald-700" : "bg-gray-400 hover:bg-gray-500"}`}
              >
                저장
              </Button>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              <Label htmlFor="settings-memo" className="sr-only">설정 메모</Label>
              <textarea
                id="settings-memo"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="메모를 입력하세요..."
                className="w-full flex-1 min-h-[300px] p-3 border rounded-md text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}




