import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, AlertCircle, ArrowRight, Shield } from "lucide-react";
import Link from "next/link";

interface NoGroupAvailableProps {
  isFinanceAdmin?: boolean;
}

export default function NoGroupAvailable({ isFinanceAdmin = false }: NoGroupAvailableProps) {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-gray-700">
            <AlertCircle className="h-6 w-6 text-amber-500" />
            <span>그룹이 없습니다</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-gray-600">
            {isFinanceAdmin ? (
              <>
                재정관리자는 그룹을 생성할 수 있습니다.
                <br />
                아래 버튼을 클릭하여 새 그룹을 만들어주세요.
              </>
            ) : (
              <>
                현재 소속된 그룹이 없습니다.
                <br />
                관리자에게 문의하여 그룹에 추가해달라고 요청해주세요.
              </>
            )}
          </p>

          {isFinanceAdmin ? (
            <Link href="/dashboard/finance/groups">
              <Button className="w-full bg-teal-600 hover:bg-teal-700">
                <Shield className="h-4 w-4 mr-2" />
                그룹 관리 페이지로 이동
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          ) : (
            <Link href="/dashboard/profile">
              <Button className="w-full bg-emerald-600 hover:bg-emerald-700">
                <Users className="h-4 w-4 mr-2" />
                프로필에서 그룹 요청하기
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <Users className="h-5 w-5 text-blue-600 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">그룹이란?</p>
                <p className="text-blue-700">
                  그룹은 부서나 팀 단위로 재정을 관리하는 공간입니다.
                  관리자가 그룹에 초대하면 해당 그룹의 재정 데이터를 확인하고
                  권한에 따라 입력/수정할 수 있습니다.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
