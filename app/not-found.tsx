import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-100">
      <div className="text-center space-y-6 p-8">
        <div className="space-y-2">
          <h1 className="text-8xl font-bold text-emerald-600">404</h1>
          <h2 className="text-2xl font-semibold text-gray-800">
            페이지를 찾을 수 없습니다
          </h2>
          <p className="text-gray-500 max-w-sm mx-auto">
            요청하신 페이지가 존재하지 않거나 이동되었습니다.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild className="bg-emerald-600 hover:bg-emerald-700">
            <Link href="/dashboard">대시보드로 이동</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/">홈으로 돌아가기</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
