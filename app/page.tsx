import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-100">
      <div className="text-center space-y-6">
        <h1 className="text-4xl font-bold text-emerald-800">
          재정 관리 프로그램
        </h1>
        <p className="text-lg text-emerald-600">
          수입/지출 관리 및 주간 보고서 생성
        </p>
        <div className="space-x-4">
          <Link href="/login">
            <Button variant="default" size="lg" className="bg-emerald-600 hover:bg-emerald-700">
              로그인
            </Button>
          </Link>
          <Link href="/register">
            <Button variant="outline" size="lg" className="border-emerald-600 text-emerald-600 hover:bg-emerald-50">
              회원가입
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
