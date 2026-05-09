"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useGroupContext } from "@/lib/contexts/GroupContext";
import { useSettings } from "@/lib/hooks/useSettings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

export default function SettingsPage() {
  const router = useRouter();
  const { hasWritePermission } = useGroupContext();
  const { settings, loading, updateSettings } = useSettings();

  // 읽기 권한자는 대시보드로 리다이렉트
  useEffect(() => {
    if (!hasWritePermission) {
      router.replace("/dashboard");
    }
  }, [hasWritePermission, router]);

  // 수입/지출 항목
  const [incomeItems, setIncomeItems] = useState<string[]>(Array(10).fill(""));
  const [expenseItems, setExpenseItems] = useState<string[]>(Array(10).fill(""));
  
  // 예산
  const [incomeBudgets, setIncomeBudgets] = useState<string[]>(Array(10).fill(""));
  const [expenseBudgets, setExpenseBudgets] = useState<string[]>(Array(10).fill(""));
  
  // 재정출납부 정보
  const [appTitle, setAppTitle] = useState("재정관리");
  const [sign1Label, setSign1Label] = useState("작성자");
  const [sign2Label, setSign2Label] = useState("책임자");
  const [sign3Label, setSign3Label] = useState("감사자");
  const [author, setAuthor] = useState("");
  const [manager, setManager] = useState("");
  const [auditor, setAuditor] = useState("");
  const [currency, setCurrency] = useState("원");
  const [memo, setMemo] = useState("");

  // 계좌현황 이름
  const [account1Name, setAccount1Name] = useState("현금");
  const [account2Name, setAccount2Name] = useState("터치앤고");
  const [account3Name, setAccount3Name] = useState("기타");

  // 원본값 저장 (변경사항 비교용)
  const [originalValues, setOriginalValues] = useState({
    incomeItems: Array(10).fill(""),
    expenseItems: Array(10).fill(""),
    incomeBudgets: Array(10).fill(""),
    expenseBudgets: Array(10).fill(""),
    appTitle: "재정관리",
    sign1Label: "작성자",
    sign2Label: "책임자",
    sign3Label: "감사자",
    author: "",
    manager: "",
    auditor: "",
    currency: "원",
    memo: "",
    account1Name: "현금",
    account2Name: "터치앤고",
    account3Name: "기타",
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
      setAppTitle(settings.app_title || "재정관리");
      setSign1Label(settings.ui_sign_1 || "작성자");
      setSign2Label(settings.ui_sign_2 || "책임자");
      setSign3Label(settings.ui_sign_3 || "감사자");
      setAuthor(settings.author || "");
      setManager(settings.manager || "");
      setAuditor(settings.auditor || "");
      setCurrency(settings.currency || "원");
      setMemo(settings.memo || "");
      setAccount1Name(settings.account1_name || "현금");
      setAccount2Name(settings.account2_name || "터치앤고");
      setAccount3Name(settings.account3_name || "기타");

      // 원본값 저장
      setOriginalValues({
        incomeItems: [...incomeItemsStr],
        expenseItems: [...expenseItemsStr],
        incomeBudgets: [...incomeBudgetsStr],
        expenseBudgets: [...expenseBudgetsStr],
        appTitle: settings.app_title || "재정관리",
        sign1Label: settings.ui_sign_1 || "작성자",
        sign2Label: settings.ui_sign_2 || "책임자",
        sign3Label: settings.ui_sign_3 || "감사자",
        author: settings.author || "",
        manager: settings.manager || "",
        auditor: settings.auditor || "",
        currency: settings.currency || "원",
        memo: settings.memo || "",
        account1Name: settings.account1_name || "현금",
        account2Name: settings.account2_name || "터치앤고",
        account3Name: settings.account3_name || "기타",
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
    appTitle !== originalValues.appTitle ||
    sign1Label !== originalValues.sign1Label ||
    sign2Label !== originalValues.sign2Label ||
    sign3Label !== originalValues.sign3Label ||
    author !== originalValues.author ||
    manager !== originalValues.manager ||
    auditor !== originalValues.auditor ||
    currency !== originalValues.currency,
    [appTitle, sign1Label, sign2Label, sign3Label, author, manager, auditor, currency, originalValues]
  );
  
  const hasMemoChanged = useMemo(() =>
    memo !== originalValues.memo,
    [memo, originalValues.memo]
  );

  const hasAccountNamesChanged = useMemo(() =>
    account1Name !== originalValues.account1Name ||
    account2Name !== originalValues.account2Name ||
    account3Name !== originalValues.account3Name,
    [account1Name, account2Name, account3Name, originalValues]
  );

  const hasAnyChanged = useMemo(() =>
    hasIncomeBudgetsChanged || hasExpenseBudgetsChanged ||
    hasIncomeItemsChanged || hasExpenseItemsChanged ||
    hasAuthorInfoChanged || hasMemoChanged || hasAccountNamesChanged,
    [hasIncomeBudgetsChanged, hasExpenseBudgetsChanged, hasIncomeItemsChanged, hasExpenseItemsChanged, hasAuthorInfoChanged, hasMemoChanged, hasAccountNamesChanged]
  );

  // 전체 저장
  const handleSave = async () => {
    const result = await updateSettings({
      app_title: appTitle,
      income_items: incomeItems.filter((i) => i.trim() !== ""),
      expense_items: expenseItems.filter((i) => i.trim() !== ""),
      income_budgets: incomeBudgets.map((b) => parseFloat(b) || 0),
      expense_budgets: expenseBudgets.map((b) => parseFloat(b) || 0),
      ui_sign_1: sign1Label,
      ui_sign_2: sign2Label,
      ui_sign_3: sign3Label,
      author,
      manager,
      auditor,
      currency,
      memo,
      account1_name: account1Name,
      account2_name: account2Name,
      account3_name: account3Name,
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
        appTitle,
        author,
        manager,
        auditor,
        currency,
        memo,
        account1Name,
        account2Name,
        account3Name,
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
  // 재정출납부 정보 저장
  const handleSaveAuthorInfo = async () => {
    const result = await updateSettings({
      app_title: appTitle,
      ui_sign_1: sign1Label,
      ui_sign_2: sign2Label,
      ui_sign_3: sign3Label,
      author,
      manager,
      auditor,
      currency,
    });
    if (result.error) {
      toast.error("재정출납부 정보 저장 실패: " + result.error);
    } else {
      toast.success("재정출납부 정보가 저장되었습니다.");
      setOriginalValues(prev => ({ ...prev, appTitle, sign1Label, sign2Label, sign3Label, author, manager, auditor, currency }));
      // 상단 Navbar에 앱 타이틀 반영을 위해 페이지 새로고침
      router.refresh();
    }
  };

  // 계좌현황 이름 저장
  const handleSaveAccountNames = async () => {
    const result = await updateSettings({
      account1_name: account1Name,
      account2_name: account2Name,
      account3_name: account3Name,
    });
    if (result.error) {
      toast.error("계좌현황 이름 저장 실패: " + result.error);
    } else {
      toast.success("계좌현황 이름이 저장되었습니다.");
      setOriginalValues(prev => ({ ...prev, account1Name, account2Name, account3Name }));
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
    setAuditor("");
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
    <div className="space-y-4 sm:space-y-6">
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">설정</h1>
          <p className="text-slate-400 text-sm mt-1">수입/지출 항목 및 예산을 관리합니다</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleReset} className="text-sm h-10 px-5 font-medium">
            초기화
          </Button>
          <Button
            onClick={handleSave}
            className={`text-sm h-10 px-5 font-medium ${hasAnyChanged
              ? "bg-emerald-600 hover:bg-emerald-700"
              : "bg-gray-400 hover:bg-gray-500"
            }`}
          >
            저장
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* 왼쪽 영역: 2x2 그리드 (예산 위, 항목 아래) */}
        <div className="lg:col-span-2 space-y-4">
          {/* 상단: 수입예산 / 지출예산 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 수입 예산 */}
            <Card className="card-section-income">
              <CardHeader className="card-header-income flex flex-row items-center justify-between py-3 px-4">
                <CardTitle className="text-base sm:text-lg font-semibold text-blue-700">수입예산</CardTitle>
                <Button
                  size="sm"
                  onClick={handleSaveIncomeBudgets}
                  className={`btn-save text-sm h-10 px-4 font-medium ${hasIncomeBudgetsChanged ? "btn-save-income" : "btn-save-inactive"}`}
                >
                  저장
                </Button>
              </CardHeader>
              <CardContent className="space-y-3 pt-3 px-4">
                {incomeBudgets.map((budget, index) => (
                  <div key={`income-budget-${index}`} className="flex items-center gap-2 sm:gap-3">
                    <span className="text-sm text-gray-500 w-20 sm:w-24 truncate">
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
                      className="h-10 flex-1 text-sm"
                    />
                  </div>
                ))}
                <Separator />
                <div className="flex justify-between text-sm sm:text-base font-semibold">
                  <span className="text-gray-600">총수입 예산</span>
                  <span className="text-blue-600">{formatAmount(incomeBudgetTotal)} {currency}</span>
                </div>
              </CardContent>
            </Card>

            {/* 지출 예산 */}
            <Card className="card-section-expense">
              <CardHeader className="card-header-expense flex flex-row items-center justify-between py-3 px-4">
                <CardTitle className="text-base sm:text-lg font-semibold text-red-700">지출예산</CardTitle>
                <Button
                  size="sm"
                  onClick={handleSaveExpenseBudgets}
                  className={`btn-save text-sm h-10 px-4 font-medium ${hasExpenseBudgetsChanged ? "btn-save-expense" : "btn-save-inactive"}`}
                >
                  저장
                </Button>
              </CardHeader>
              <CardContent className="space-y-3 pt-3 px-4">
                {expenseBudgets.map((budget, index) => (
                  <div key={`expense-budget-${index}`} className="flex items-center gap-2 sm:gap-3">
                    <span className="text-sm text-gray-500 w-20 sm:w-24 truncate">
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
                      className="h-10 flex-1 text-sm"
                    />
                  </div>
                ))}
                <Separator />
                <div className="flex justify-between text-sm sm:text-base font-semibold">
                  <span className="text-gray-600">총지출 예산</span>
                  <span className="text-red-600">{formatAmount(expenseBudgetTotal)} {currency}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 하단: 수입항목 / 지출항목 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 수입 항목 */}
            <Card className="card-section-income">
              <CardHeader className="card-header-income flex flex-row items-center justify-between py-3 px-4">
                <CardTitle className="text-base sm:text-lg font-semibold text-blue-700">수입항목</CardTitle>
                <Button
                  size="sm"
                  onClick={handleSaveIncomeItems}
                  className={`btn-save text-sm h-10 px-4 font-medium ${hasIncomeItemsChanged ? "btn-save-income" : "btn-save-inactive"}`}
                >
                  저장
                </Button>
              </CardHeader>
              <CardContent className="space-y-3 pt-3 px-4">
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
                    className="h-10 text-sm"
                  />
                ))}
              </CardContent>
            </Card>

            {/* 지출 항목 */}
            <Card className="card-section-expense">
              <CardHeader className="card-header-expense flex flex-row items-center justify-between py-3 px-4">
                <CardTitle className="text-base sm:text-lg font-semibold text-red-700">지출항목</CardTitle>
                <Button
                  size="sm"
                  onClick={handleSaveExpenseItems}
                  className={`btn-save text-sm h-10 px-4 font-medium ${hasExpenseItemsChanged ? "btn-save-expense" : "btn-save-inactive"}`}
                >
                  저장
                </Button>
              </CardHeader>
              <CardContent className="space-y-3 pt-3 px-4">
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
                    className="h-10 text-sm"
                  />
                ))}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* 오른쪽: 재정출납부 정보 및 메모 */}
        <div className="space-y-4 flex flex-col">
          {/* 재정출납부 정보 */}
          <Card className="shadow-sm">
            <CardHeader className="py-3 px-4 border-b border-gray-100 flex flex-row items-center justify-between">
              <CardTitle className="text-base sm:text-lg font-semibold text-gray-700">재정출납부 정보</CardTitle>
              <Button
                size="sm"
                onClick={handleSaveAuthorInfo}
                className={`btn-save text-sm h-10 px-4 font-medium ${hasAuthorInfoChanged ? "btn-save-active" : "btn-save-inactive"}`}
              >
                저장
              </Button>
            </CardHeader>
            <CardContent className="space-y-3 px-4">
              <div className="space-y-1.5">
                <Label htmlFor="appTitle" className="text-sm font-medium">재정출납부 명칭</Label>
                <Input
                  id="appTitle"
                  value={appTitle}
                  onChange={(e) => setAppTitle(e.target.value)}
                  placeholder="재정관리"
                  className="h-10 text-sm"
                />
              </div>
              {/* 서명 라벨 + 이름 */}
              <div className="space-y-1.5">
                <div className="flex gap-2 mb-1">
                  <span className="text-xs text-gray-400 w-[38%]">라벨명</span>
                  <span className="text-xs text-gray-400 flex-1">이름</span>
                </div>
                <div className="flex gap-2">
                  <Input
                    value={sign1Label}
                    onChange={(e) => setSign1Label(e.target.value)}
                    placeholder="작성자"
                    className="h-10 text-sm w-[38%]"
                  />
                  <Input
                    id="author"
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                    placeholder="이름 입력"
                    className="h-10 text-sm flex-1"
                  />
                </div>
                <div className="flex gap-2">
                  <Input
                    value={sign2Label}
                    onChange={(e) => setSign2Label(e.target.value)}
                    placeholder="책임자"
                    className="h-10 text-sm w-[38%]"
                  />
                  <Input
                    id="manager"
                    value={manager}
                    onChange={(e) => setManager(e.target.value)}
                    placeholder="이름 입력"
                    className="h-10 text-sm flex-1"
                  />
                </div>
                <div className="flex gap-2">
                  <Input
                    value={sign3Label}
                    onChange={(e) => setSign3Label(e.target.value)}
                    placeholder="감사자"
                    className="h-10 text-sm w-[38%]"
                  />
                  <Input
                    id="auditor"
                    value={auditor}
                    onChange={(e) => setAuditor(e.target.value)}
                    placeholder="이름 입력"
                    className="h-10 text-sm flex-1"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="currency" className="text-sm font-medium">금액 단위</Label>
                <Input
                  id="currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  placeholder="원"
                  className="h-10 text-sm"
                />
              </div>
            </CardContent>
          </Card>

          {/* 계좌현황 이름 */}
          <Card className="shadow-sm">
            <CardHeader className="py-3 px-4 border-b border-gray-100 flex flex-row items-center justify-between">
              <CardTitle className="text-base sm:text-lg font-semibold text-gray-700">계좌현황 이름</CardTitle>
              <Button
                size="sm"
                onClick={handleSaveAccountNames}
                className={`btn-save text-sm h-10 px-4 font-medium ${hasAccountNamesChanged ? "btn-save-active" : "btn-save-inactive"}`}
              >
                저장
              </Button>
            </CardHeader>
            <CardContent className="space-y-3 px-4">
              <div className="space-y-1.5">
                <Label htmlFor="account1Name" className="text-sm font-medium">계좌현황1</Label>
                <Input
                  id="account1Name"
                  value={account1Name}
                  onChange={(e) => setAccount1Name(e.target.value)}
                  placeholder="현금"
                  className="h-10 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="account2Name" className="text-sm font-medium">계좌현황2</Label>
                <Input
                  id="account2Name"
                  value={account2Name}
                  onChange={(e) => setAccount2Name(e.target.value)}
                  placeholder="터치앤고"
                  className="h-10 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="account3Name" className="text-sm font-medium">계좌현황3</Label>
                <Input
                  id="account3Name"
                  value={account3Name}
                  onChange={(e) => setAccount3Name(e.target.value)}
                  placeholder="기타"
                  className="h-10 text-sm"
                />
              </div>
            </CardContent>
          </Card>

          {/* 메모 - 남은 공간 채우기 */}
          <Card className="flex-1 flex flex-col shadow-sm">
            <CardHeader className="py-3 px-4 border-b border-gray-100 flex flex-row items-center justify-between">
              <CardTitle className="text-base sm:text-lg font-semibold text-gray-700">설정 메모</CardTitle>
              <Button
                size="sm"
                onClick={handleSaveMemo}
                className={`btn-save text-sm h-10 px-4 font-medium ${hasMemoChanged ? "btn-save-active" : "btn-save-inactive"}`}
              >
                저장
              </Button>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col px-4">
              <Label htmlFor="settings-memo" className="sr-only">설정 메모</Label>
              <textarea
                id="settings-memo"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="메모를 입력하세요..."
                className="w-full flex-1 min-h-[200px] sm:min-h-[300px] p-3 border rounded-md text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}










