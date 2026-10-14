import { describe, it, expect } from "vitest";
import { parseRssFeed } from "@/lib/rss";
import { isEligibleClubSourceArticle } from "@/lib/ingest/clubSourcePolicy";
import { isIrrelevantSport } from "@/lib/ingest/filterPolicy";

const sources = [
  {name:"The Stacey West",url:"https://staceywest.net/feed/"},
  {name:"FeanOnline",url:"https://www.feanonline.nl/feed/news.rss"},
];
const cutoff = Date.now();
describe.runIf(process.env.RUN_LIVE_CLUB_SOURCE_AUDIT === "1")("read-only live club-source eligibility", () => {
  for(const source of sources){
    it(source.name,async()=>{
      const articles=await parseRssFeed(source.url);
      expect(articles.length).toBeGreaterThan(0);
      const rows=articles.map(a=>{
        const valid=!!a.published_at&&Number.isFinite(Date.parse(a.published_at));
        const age=valid?(cutoff-Date.parse(a.published_at!))/3_600_000:Infinity;
        const notIrrelevant=!isIrrelevantSport([a.title,a.url,a.summary??"",...(a.tags??[])].join(" "));
        const club=isEligibleClubSourceArticle(source.name,a);
        return {title:a.title,url:a.url,age:Math.round(age*10)/10,eligible:valid&&age>=0&&age<=12&&notIrrelevant&&club,recent6:valid&&age>=0&&age<=6,recent12:valid&&age>=0&&age<=12,club,notIrrelevant};
      });
      const accepted=rows.filter(x=>x.eligible);
      const published={source:source.name,total:rows.length,recent6h:rows.filter(x=>x.recent6).length,recent12h:rows.filter(x=>x.recent12).length,clubEligible:rows.filter(x=>x.club).length,within12hAndFiltered:accepted.length,eligible:accepted.slice(0,25).map(({title,url,age})=>({title,url,age})),rejectedRecent:rows.filter(x=>x.recent12&&!x.eligible).slice(0,20).map(({title,club,notIrrelevant})=>({title,club,notIrrelevant}))};
      console.log("CLUB_ELIGIBILITY_AUDIT",JSON.stringify(published));
      expect(accepted.every(x=>x.recent12&&x.club&&x.notIrrelevant)).toBe(true);
    },35000);
  }
});
