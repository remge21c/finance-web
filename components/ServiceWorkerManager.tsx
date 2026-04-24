"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function ServiceWorkerManager() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIOSBanner, setShowIOSBanner] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(console.error)
    }

    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
    const isStandalone = (window.navigator as any).standalone === true
    if (isIOS && !isStandalone && !localStorage.getItem('pwa-ios-dismissed')) {
      setShowIOSBanner(true)
    }

    const handler = (e: Event) => {
      e.preventDefault()
      setInstallPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  if (dismissed) return null

  // Android: 시스템 설치 프롬프트 트리거 배너
  if (installPrompt) {
    return (
      <div className="fixed bottom-4 left-4 right-4 z-50 bg-emerald-700 text-white rounded-xl p-4 shadow-lg flex items-center justify-between max-w-sm mx-auto">
        <div>
          <p className="font-semibold text-sm">앱으로 설치하기</p>
          <p className="text-xs text-emerald-200 mt-0.5">홈 화면에 추가하여 빠르게 실행하세요</p>
        </div>
        <div className="flex gap-2 ml-3 shrink-0">
          <button
            onClick={() => { setDismissed(true); setInstallPrompt(null) }}
            className="text-xs text-emerald-300 px-2 py-1"
          >
            나중에
          </button>
          <button
            onClick={() => { installPrompt.prompt(); setDismissed(true) }}
            className="bg-white text-emerald-700 text-xs font-semibold px-3 py-1.5 rounded-lg"
          >
            설치
          </button>
        </div>
      </div>
    )
  }

  // iOS: 수동 설치 안내 배너
  if (showIOSBanner) {
    return (
      <div className="fixed bottom-4 left-4 right-4 z-50 bg-slate-800 text-white rounded-xl p-4 shadow-lg max-w-sm mx-auto">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-semibold text-sm">홈 화면에 추가하기</p>
            <p className="text-xs text-slate-300 mt-1">
              Safari 하단의 <span className="font-medium text-white">공유 버튼(□↑)</span>을 탭한 후{' '}
              <span className="font-medium text-white">&quot;홈 화면에 추가&quot;</span>를 선택하세요.
            </p>
          </div>
          <button
            onClick={() => {
              setShowIOSBanner(false)
              setDismissed(true)
              localStorage.setItem('pwa-ios-dismissed', '1')
            }}
            className="text-slate-400 text-xl leading-none shrink-0"
          >
            ✕
          </button>
        </div>
      </div>
    )
  }

  return null
}
