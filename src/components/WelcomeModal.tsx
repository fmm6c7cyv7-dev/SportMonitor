"use client";
import { useState, useSyncExternalStore } from "react";

const WELCOME_STORAGE_KEY = "sm_seen_welcome";

function subscribeToWelcomeState(): () => void {
  return () => {};
}

function getWelcomeSeenSnapshot(): boolean {
  return localStorage.getItem(WELCOME_STORAGE_KEY) === "true";
}

function getWelcomeSeenServerSnapshot(): boolean {
  return true;
}

export default function WelcomeModal() {
  const hasSeenWelcome = useSyncExternalStore(
    subscribeToWelcomeState,
    getWelcomeSeenSnapshot,
    getWelcomeSeenServerSnapshot,
  );
  const [dismissed, setDismissed] = useState(false);
  const isOpen = !hasSeenWelcome && !dismissed;

  const close = () => {
    localStorage.setItem(WELCOME_STORAGE_KEY, "true");
    setDismissed(true);
  };

  if (!isOpen) return null;

  // Vi använder hex-koden #DAB661 för att matcha guld-färgen i SportMonitor-loggan
  const brandGold = "#DAB661";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="max-w-md w-full rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
        
        {/* Header med loggor på båda sidor och anpassat gap */}
        <div className="flex items-center justify-center gap-7 mb-6"> 
          <img 
            src="/favicon.ico" 
            alt="SportMonitor Logo Left" 
            className="w-8 h-8 rounded-full shadow-sm shadow-black/50" 
            onError={(e) => (e.currentTarget.src = "/icon.png")} 
          />
          
          <h2 className="text-xl font-bold tracking-tight text-white leading-tight text-center">
            Välkommen till <span>Sport</span><span style={{ color: brandGold }}>Monitor</span>
          </h2>

          <img 
            src="/favicon.ico" 
            alt="SportMonitor Logo Right" 
            className="w-8 h-8 rounded-full shadow-sm shadow-black/50" 
            onError={(e) => (e.currentTarget.src = "/icon.png")} 
          />
        </div>
        
        <p className="text-slate-400 text-sm mb-6 text-center leading-relaxed">
          Vi bevakar hundratals RSS-flöden och filtrerar bort allt brus för att ge dig en renodlad upplevelse av fotboll och ishockey.
        </p>
        
        <div className="space-y-4 mb-8">
          <div className="flex items-start gap-3">
            <span style={{ color: brandGold }} className="text-lg">🔔</span>
            <p className="text-xs text-slate-300">
              <b className="text-slate-100">Smarta notiser:</b> Följ spelare eller lag för att få push-notiser. Vi begränsar utskicken så du aldrig blir spammad.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <span style={{ color: brandGold }} className="text-lg">⚡</span>
            <p className="text-xs text-slate-300">
              <b className="text-slate-100">Realtid:</b> Sidan uppdateras automatiskt var 45:e sekund för att du inte ska missa något.
            </p>
          </div>
        </div>
        
        {/* Knappen använder nu samma guld-hex som loggan */}
        <button 
          onClick={close}
          style={{ backgroundColor: brandGold }}
          className="w-full py-3 text-slate-950 font-black rounded-xl transition-all hover:opacity-90 uppercase tracking-widest text-sm shadow-lg shadow-black/20"
        >
          Uppfattat - kör igång!
        </button>
      </div>
    </div>
  );
}