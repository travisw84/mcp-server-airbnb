import test from "node:test";
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {readFileSync} from "node:fs";
import {Client} from "@modelcontextprotocol/sdk/client/index.js";
import {StdioClientTransport} from "@modelcontextprotocol/sdk/client/stdio.js";
test("stdio end-to-end: filters, compact output, robots and cross-PR recovery",async()=>{
 const fx=JSON.parse(readFileSync(new URL("./fixtures/pdp-presentation.json",import.meta.url),"utf8"));
 const card=JSON.parse(readFileSync(new URL("./fixtures/search-results.json",import.meta.url),"utf8"))[0];
 card.badges=[{text:"Guest favourite",loggingContext:{badgeType:"SUPERHOST"}}];
 const node=structuredClone(fx.healthy.niobeClientData.find(e=>e?.[1]?.data?.node)?.[1].data.node);
 delete node.location;
 node.pdpPresentation.descriptions={longDescriptionHtml:{localizedString:"Description recovered"}};
 node.pdpPresentation.rules={groupItems:[{title:"Rules",items:[{title:{content:{localizedString:"No smoking"}}}]}]};
 const pdp={niobeClientData:[[null,{data:{node}}]]};
 let requestUrl;
 const http=createServer((req,res)=>{
  requestUrl=new URL(req.url,"http://localhost");
  if(requestUrl.pathname==="/robots.txt"){res.end("User-agent: *\nDisallow: /s/\nAllow: /rooms/\n");return;}
  const payload=requestUrl.pathname.startsWith("/rooms/")?pdp:{niobeClientData:[[null,{}],[null,{data:{presentation:{staysSearch:{results:{searchResults:[card],paginationInfo:{}}}}}}]]};
  res.end('<script id="data-deferred-state-0">'+JSON.stringify(payload)+'</script>');
 });
 await new Promise(resolve=>http.listen(0,"127.0.0.1",resolve));
 const client=new Client({name:"offline-integration",version:"1"});
 try {
  await client.connect(new StdioClientTransport({command:process.execPath,args:["dist/index.js"],env:{...process.env,AIRBNB_BASE_URL:"http://127.0.0.1:"+http.address().port,IGNORE_ROBOTS_TXT:"false",DISABLE_GEOCODING:"true"},stderr:"ignore"}));
  const blocked=await client.callTool({name:"airbnb_search",arguments:{location:"Melbourne"}});
  assert.equal(blocked.isError,true);
  const search=await client.callTool({name:"airbnb_search",arguments:{location:"Melbourne",propertyType:"entire_home",amenities:["air_conditioning","king_bed"],compact:true,ignoreRobotsText:true}});
  assert.equal(search.isError,false);
  assert.deepEqual(requestUrl.searchParams.getAll("amenities[]"),["5","1000"]);
  assert.deepEqual(requestUrl.searchParams.getAll("room_types[]"),["Entire home/apt"]);
  assert.equal(JSON.parse(search.content[0].text).searchResults[0].badgeType,"SUPERHOST");
  const details=await client.callTool({name:"airbnb_listing_details",arguments:{id:"123"}});
  assert.equal(details.isError,false);
  const sections=JSON.parse(details.content[0].text).details;
  assert.ok(sections.find(s=>s.id==="HOST"),"host must recover even without coordinates");
  assert.ok(sections.find(s=>s.id==="DESCRIPTION_DEFAULT"));
  assert.ok(sections.find(s=>s.id==="POLICIES_DEFAULT"));
  const invalid=await client.callTool({name:"airbnb_listing_details",arguments:{id:"../login"}});
  assert.equal(invalid.isError,true);
 } finally {await client.close();await new Promise(resolve=>http.close(resolve));}
});
