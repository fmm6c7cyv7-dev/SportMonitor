// Read-only source probe. No credentials, database writes, or push calls.
const targets = [
  { name: "The Stacey West", url: "https://staceywest.net/feed/", host: "staceywest.net" },
  { name: "FeanOnline", url: "https://www.feanonline.nl/feed/news.rss", host: "www.feanonline.nl" },
];
const timeout = (ms) => AbortSignal.timeout(ms);
const decode = (text) => text.replace(/<!\[CDATA\[|\]\]>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;|&apos;/g,"'").replace(/&quot;/g, '"').replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
const field = (block, tag) => block.match(new RegExp("<"+tag+"\\b[^>]*>([\\s\\S]*?)</"+tag+">","i"))?.[1]??"";
const feedInfo = async ({name,url,host}) => {
  try {
    const response = await fetch(url,{redirect:"follow",signal:timeout(12000),headers:{"User-Agent":"SportMonitor-ReadOnlySourceQA/1.0","Accept":"application/rss+xml, application/xml, text/xml, */*"}});
    const content = await response.text();
    const items = [...content.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].map(x=>x[1]);
    const entries = [...content.matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry>/gi)].map(x=>x[1]);
    const blocks = items.length?items:entries;
    const now = Date.now();
    const parsed = blocks.map(b=>{
      const title=decode(field(b,"title"));
      const link=decode(field(b,"link"))||b.match(/<link[^>]*href=["']([^"']+)/i)?.[1]||"";
      const rawDate=decode(field(b,"pubDate")||field(b,"published")||field(b,"updated"));
      const time=Date.parse(rawDate);
      let validHost=false;
      try {validHost=new URL(link).hostname===host||new URL(link).hostname===host.replace(/^www\./,"");}catch{}
      return {title,link,date:Number.isFinite(time)?new Date(time).toISOString():null,validHost};
    });
    const fresh=parsed.filter(x=>x.date&&now-Date.parse(x.date)>=0&&now-Date.parse(x.date)<=7*86400000);
    const valid=parsed.filter(x=>x.title&&x.link&&x.date&&x.validHost);
    const unrelated=parsed.filter(x=>/casino|betting|odds|spelbolag|dames|vrouwen|vrouwenvoetbal|advertorial|sponsor(ed)?/i.test(x.title));
    const report={name,status:response.status,contentType:response.headers.get("content-type"),finalUrl:response.url,bytes:content.length,blocks:blocks.length,valid:valid.length,last7days:fresh.length,possibleScopeRisks:unrelated.length,uniqueUrls:new Set(parsed.map(x=>x.link)).size,first:parsed.slice(0,6).map(x=>({title:x.title,date:x.date,url:x.link})),errors:[]};
    if(!response.ok)report.errors.push("HTTP failure");
    if(!blocks.length)report.errors.push("No RSS/Atom items");
    if(valid.length!==blocks.length)report.errors.push("Invalid article title/date/link/host");
    return report;
  } catch(e){return {name,url,error:String(e)};}
};
const reports = await Promise.all(targets.map(feedInfo));
console.log("SOURCE_PROBE_JSON",JSON.stringify(reports));
if(reports.some(x=>x.error||x.errors?.length)) process.exitCode=1;
