"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { FolderCheck, ExternalLink, Trash2 } from "lucide-react";
import DriveFolderPicker from "@/components/DriveFolderPicker";

interface Props {
  connected: boolean;
  folderId: string | null;
  folderName: string | null;
  pickedAt: string | null;
}

export default function BackupTargetFolderCard({ connected, folderId, folderName, pickedAt }: Props) {
  const router = useRouter();
  const [clearing, setClearing] = useState(false);

  const handleClear = async () => {
    if (!confirm("선택된 백업 폴더를 해제하시겠습니까?")) return;
    setClearing(true);
    try {
      const res = await fetch("/api/backup/google-drive/target-folder", { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("선택이 해제되었습니다.");
      router.refresh();
    } catch {
      toast.error("해제 실패");
    } finally {
      setClearing(false);
    }
  };

  return (
    <Card>
      <CardHeader className="py-4">
        <CardTitle className="text-base">백업 폴더</CardTitle>
        <CardDescription className="text-xs">
          모든 백업 파일이 저장될 Google Drive 폴더를 선택하세요. 선택한 폴더 외 다른 파일은 앱이 접근하지 않습니다.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {!connected ? (
          <p className="text-sm text-gray-500">먼저 Google 계정을 연결해주세요.</p>
        ) : folderId ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <FolderCheck className="h-4 w-4 text-emerald-600 shrink-0" />
              <span className="text-gray-700">선택됨:</span>
              <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded truncate max-w-xs">
                {folderName || folderId}
              </span>
            </div>
            {pickedAt && (
              <p className="text-xs text-gray-500">
                선택 시각: {new Date(pickedAt).toLocaleString("ko-KR")}
              </p>
            )}
            <div className="flex gap-2 pt-1 flex-wrap">
              <DriveFolderPicker
                label="폴더 변경"
                variant="outline"
                className="text-xs h-8"
              />
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-8"
                asChild
              >
                <a
                  href={`https://drive.google.com/drive/folders/${folderId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-3.5 w-3.5 mr-1" />
                  Drive 에서 열기
                </a>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-8 text-red-600 border-red-200 hover:bg-red-50"
                onClick={handleClear}
                disabled={clearing}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                {clearing ? "해제 중..." : "선택 해제"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              아직 백업 폴더가 선택되지 않았습니다.
            </p>
            <DriveFolderPicker
              label="백업 폴더 선택"
              className="bg-emerald-600 hover:bg-emerald-700 text-sm h-9"
            />
            <p className="text-xs text-gray-400">
              Google Drive 에서 백업 파일을 저장할 폴더를 선택합니다. 기존 폴더 그대로 사용 가능.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
