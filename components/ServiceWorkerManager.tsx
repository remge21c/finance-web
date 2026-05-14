"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function ServiceWorkerManager() {
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(console.error)
    }

    const checkStandalone = () => {
      return (
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as any).standalone
      );
    };

    if (checkStandalone()) {
      setIsStandalone(true);
      return;
    }

    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

    if (isIosDevice) {
      if (!localStorage.getItem("pwa_prompt_dismissed")) {
        setTimeout(() => setShowPrompt(true), 3000);
      }
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      if (!localStorage.getItem("pwa_prompt_dismissed")) setShowPrompt(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () =>
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setShowPrompt(false);
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem("pwa_prompt_dismissed", "true");
  };

  if (!showPrompt || isStandalone) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-[100] bg-emerald-700 text-white p-4 rounded-xl shadow-2xl flex items-start gap-3 max-w-sm mx-auto">
      <div className="flex-1">
        <h3 className="font-bold text-sm">앱으로 설치하기</h3>
        {isIOS ? (
          <p className="text-xs text-emerald-200 mt-1">
            Safari 하단의 <span className="font-medium text-white">공유 버튼(□↑)</span>을 탭한 후{" "}
            <span className="font-medium text-white">&quot;홈 화면에 추가&quot;</span>를 선택하세요.
          </p>
        ) : (
          <p className="text-xs text-emerald-200 mt-1">
            홈 화면에 앱을 설치하여 더 편하게 이용하세요.
          </p>
        )}
      </div>
      {!isIOS && deferredPrompt && (
        <button
          onClick={handleInstallClick}
          className="bg-white text-emerald-700 px-3 py-1.5 rounded-lg text-xs font-bold shrink-0"
        >
          설치
        </button>
      )}
      <button onClick={handleDismiss} className="text-emerald-300 shrink-0">
        <X size={18} />
      </button>
    </div>
  );
}
