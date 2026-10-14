"use client";

import { useEffect, useId, useRef, useSyncExternalStore } from "react";
import {
  RELEASE_VERSION,
  getReleaseNoticeServerSnapshot,
  releaseNoticeStore,
} from "@/lib/releaseNotice";

const brandGold = "#DAB661";

export default function WelcomeModal() {
  const mode = useSyncExternalStore(
    releaseNoticeStore.subscribe,
    releaseNoticeStore.snapshot,
    getReleaseNoticeServerSnapshot,
  );
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (mode === "hidden" || !dialog) return;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus();
      }
    };
  }, [mode]);

  if (mode === "hidden") return null;
  const welcome = mode === "welcome";

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={event => {
        event.preventDefault();
        releaseNoticeStore.acknowledge();
      }}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-6 text-slate-100 shadow-2xl backdrop:bg-slate-950/80 backdrop:backdrop-blur-sm"
    >
      <p className="mb-3 text-xs font-semibold uppercase tracking-widest" style={{ color: brandGold }}>
        {welcome ? "SportMonitor" : "Nytt i SportMonitor"} · v{RELEASE_VERSION}
      </p>
      <h2 id={titleId} className="text-xl font-bold leading-tight text-white">
        {welcome ? <>Välkommen till Sport<span style={{ color: brandGold }}>Monitor</span></> : "Smartare koll på sportnyheterna"}
      </h2>
      {welcome ? (
        <>
          <p className="mb-5 mt-3 text-sm leading-relaxed text-slate-400">
            Vi bevakar hundratals RSS-flöden och filtrerar bort allt brus för att ge dig en renodlad upplevelse av fotboll och ishockey.
          </p>
          <div className="mb-6 space-y-4 text-xs leading-relaxed text-slate-300">
            <p><b className="text-slate-100">🔔 Smarta notiser:</b> Följ spelare eller lag för att få push-notiser. Vi begränsar utskicken så du aldrig blir spammad.</p>
            <p><b className="text-slate-100">⚡ Realtid:</b> Sidan uppdateras automatiskt var 45:e sekund för att du inte ska missa något.</p>
          </div>
          <h3 className="mb-2 border-t border-slate-700 pt-4 text-sm font-semibold" style={{ color: brandGold }}>
            Nytt: smartare koll på sportnyheterna
          </h3>
        </>
      ) : null}
      <div id={descriptionId} className="mt-3 space-y-3 text-sm leading-relaxed text-slate-300">
        <p>Vi har byggt en ny AI-granskning för <strong className="text-white">breaking och transfer</strong>. Rubriken och tillgänglig ingress tolkas innan en artikel får en särskild markering eller extra prioritet.</p>
        <p>Att en spelare <strong className="text-white">lämnar matchen skadad</strong> ska inte förväxlas med att han lämnar klubben. Rykten skiljs från bekräftade besked.</p>
      </div>
      <button
        type="button"
        onClick={() => releaseNoticeStore.acknowledge()}
        style={{ backgroundColor: brandGold }}
        className="mt-6 w-full rounded-xl py-3 text-sm font-bold text-slate-950 shadow-lg transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#DAB661]"
      >
        {welcome ? "Uppfattat – kör igång!" : "Uppfattat"}
      </button>
    </dialog>
  );
}
