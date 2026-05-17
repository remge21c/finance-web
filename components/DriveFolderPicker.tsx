"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { FolderOpen } from "lucide-react";

interface Props {
  label?: string;
  variant?: "default" | "outline";
  className?: string;
}

declare global {
  interface Window {
    gapi?: {
      load: (api: string, cb: () => void) => void;
    };
    google?: {
      picker: {
        PickerBuilder: new () => GooglePickerBuilder;
        ViewId: { FOLDERS: string };
        DocsView: new (viewId: string) => GoogleDocsView;
        Action: { PICKED: string; CANCEL: string };
        Feature: { NAV_HIDDEN: string; SUPPORT_DRIVES: string };
        Response: { ACTION: string; DOCUMENTS: string };
        Document: { ID: string; NAME: string; MIME_TYPE: string };
      };
    };
  }
}

interface GoogleDocsView {
  setSelectFolderEnabled: (b: boolean) => GoogleDocsView;
  setMimeTypes: (types: string) => GoogleDocsView;
  setIncludeFolders: (b: boolean) => GoogleDocsView;
  setParent: (id: string) => GoogleDocsView;
}

interface GooglePickerBuilder {
  addView: (view: GoogleDocsView) => GooglePickerBuilder;
  setOAuthToken: (token: string) => GooglePickerBuilder;
  setDeveloperKey: (key: string) => GooglePickerBuilder;
  setAppId: (id: string) => GooglePickerBuilder;
  setCallback: (cb: (data: any) => void) => GooglePickerBuilder;
  enableFeature: (feature: string) => GooglePickerBuilder;
  setTitle: (title: string) => GooglePickerBuilder;
  build: () => { setVisible: (b: boolean) => void };
}

const PICKER_API_URL = "https://apis.google.com/js/api.js";

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`script load failed: ${src}`));
    document.head.appendChild(script);
  });
}

function loadPicker(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.picker) {
      resolve();
      return;
    }
    if (!window.gapi) {
      reject(new Error("gapi 미로드"));
      return;
    }
    window.gapi.load("picker", () => {
      if (window.google?.picker) resolve();
      else reject(new Error("picker 로드 실패"));
    });
  });
}

export default function DriveFolderPicker({ label, variant = "default", className }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleClick = useCallback(async () => {
    setLoading(true);
    try {
      // 1) 짧은 수명 access_token 발급
      const tokenRes = await fetch("/api/auth/google-drive/picker-token");
      if (!tokenRes.ok) {
        const body = await tokenRes.json().catch(() => ({}));
        if (body.code === "NO_TOKEN") {
          toast.error("먼저 Google 계정을 연결해주세요.");
        } else {
          toast.error(body.error || "토큰 발급 실패");
        }
        return;
      }
      const { accessToken } = (await tokenRes.json()) as { accessToken: string };

      // 2) gapi + picker 로드
      await loadScript(PICKER_API_URL);
      await loadPicker();
      if (!window.google?.picker) throw new Error("picker 객체 없음");

      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
      if (!apiKey) {
        toast.error("NEXT_PUBLIC_GOOGLE_API_KEY 환경변수가 없습니다.");
        return;
      }

      // 3) 폴더 전용 view + Picker 빌드
      const folderView = new window.google.picker.DocsView(window.google.picker.ViewId.FOLDERS)
        .setSelectFolderEnabled(true)
        .setIncludeFolders(true)
        .setMimeTypes("application/vnd.google-apps.folder");

      const picker = new window.google.picker.PickerBuilder()
        .addView(folderView)
        .setOAuthToken(accessToken)
        .setDeveloperKey(apiKey)
        .enableFeature(window.google.picker.Feature.NAV_HIDDEN)
        .setTitle("백업 폴더 선택")
        .setCallback(async (data: any) => {
          const action = data?.[window.google!.picker.Response.ACTION];
          if (action !== window.google!.picker.Action.PICKED) return;
          const docs = data?.[window.google!.picker.Response.DOCUMENTS];
          const doc = docs?.[0];
          if (!doc) return;
          const folderId = doc[window.google!.picker.Document.ID] as string;
          const folderName = doc[window.google!.picker.Document.NAME] as string;

          // 4) 서버 저장
          const saveRes = await fetch("/api/backup/google-drive/target-folder", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ folder_id: folderId, folder_name: folderName }),
          });
          if (!saveRes.ok) {
            const body = await saveRes.json().catch(() => ({}));
            toast.error(body.error || "폴더 저장 실패");
            return;
          }
          toast.success(`폴더 설정: ${folderName}`);
          router.refresh();
        })
        .build();

      picker.setVisible(true);
    } catch (err: any) {
      console.error("[DriveFolderPicker] error:", err);
      toast.error("Picker 열기 실패");
    } finally {
      setLoading(false);
    }
  }, [router]);

  return (
    <Button
      variant={variant}
      className={className}
      onClick={handleClick}
      disabled={loading}
    >
      <FolderOpen className="h-4 w-4 mr-1.5" />
      {loading ? "로드 중..." : label || "백업 폴더 선택"}
    </Button>
  );
}
