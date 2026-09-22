// web/src/app/page.tsx

"use client";

import packageJson from "../../package.json";
import ClientTopDropper from "@/components/ClientTopDropper";
import TopHighlight from "@/components/TopHighlight";
import NewsColumn from "@/components/NewsColumn";
import WelcomeModal from "@/components/WelcomeModal";

/* ==========================================================================
   COMPONENT
   ========================================================================== */

export default function Page() {
  return (
    <main className="sm-bg sm-shell min-h-screen flex flex-col">
      <div className="mx-auto flex-1 w-full max-w-[1200px] px-4 pb-16">
        {/* ==================================================================
           HEADER / TOP BAR
           ================================================================== */}
        <ClientTopDropper />

        {/* ==================================================================
           TOP HIGHLIGHT
           ================================================================== */}
        <div className="mt-6">
          <TopHighlight />
        </div>

        {/* ==================================================================
           NEWS COLUMNS
           ================================================================== */}
        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
          <NewsColumn sport="football" title="Fotboll" />
          <NewsColumn sport="hockey" title="Hockey" />
        </div>

        {/* ==================================================================
           FOOTER
           ================================================================== */}
        <footer className="mt-16 border-t border-white/5 pt-10">
          <div className="grid gap-10 text-sm sm-dim md:grid-cols-2">
            <div>
              <h3 className="mb-3 font-semibold text-white">Om SportMonitor</h3>
              <p className="leading-relaxed">
                SportMonitor är en oberoende nyhetsaggregator som samlar sportnyheter från de största källorna – lokalt som globalt. Vår intelligenta motor rensar bort bruset och fokuserar exklusivt på fotboll och ishockey, med särskilt fokus på att punktmarkera våra svenska herrspelare utomlands samtidigt som du har full koll lokalt. 
                 Med våra verktyg för personalisering skapar du en nyhetsupplevelse skräddarsydd för just dina lag och spelare. Flödet uppdateras automatiskt och levererar det senaste direkt till dig. <br />
                Flödet uppdateras och levererar nyheter till dig automatiskt.
                <br />
                <strong className="text-white/80">
                  Mindre scrollande, mer sport.
                </strong>
              </p>
            </div>

            <div>
              <h3 className="mb-3 font-semibold text-white">
                Push-notiser &amp; Personalisering
              </h3>
              <p className="leading-relaxed">
                 Följ det du faktiskt bryr dig om. 
                 Välj favoritlag och spelare så håller SportMonitor koll åt dig, från lokala nyheter till de
                 största händelserna. Få push-notiser när något viktigt händer och låt ditt
                 personliga flöde prioritera rätt innehåll automatiskt. <br />
                 Välj favoriter, sortera favoriter högst upp och dölj sådant du redan har läst. 
                 <br /> <strong className="text-white/80">
                 Mindre brus. Mer av sporten du gillar.
                </strong>
              </p>
            </div>
          </div>

          <div className="mt-12 border-t border-white/5 pt-8 text-center">
            <p className="mb-2 text-[10px] sm-dim">
              Innehåll ägs av respektive publicist – SportMonitor länkar endast
              vidare till originalkällan.
            </p>

            <div className="font-mono text-[10px] tracking-[0.2em] text-slate-400">
              SPORTMONITOR v{packageJson.version}
            </div>
          </div>
        </footer>
      </div>

      {/* ====================================================================
         WELCOME MODAL
         Visas endast för nya besökare
         ==================================================================== */}
      <WelcomeModal />
    </main>
  );
}
