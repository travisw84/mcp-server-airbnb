import test from "node:test";
import assert from "node:assert/strict";
import { extractDescription, extractPdpRules, validateInputs, retryDelay } from "../dist/reliability.js";
import { findNodeLocation, compactSearchResult } from "../dist/util.js";

test("Daniel UGC description and nested translated rules survive", () => {
  assert.equal(extractDescription({descriptions:{longDescriptionHtml:{localizedString:"<p>Stay</p>"}}}).htmlDescription.htmlText, "<p>Stay</p>");
  const rules = extractPdpRules({rules:{groupItems:[{title:"During your stay",items:[{title:{content:{localizedStringWithTranslationPreference:"No smoking"}},description:{content:{localizedString:"Inside or outside"}}}]}]}});
  assert.deepEqual(rules.houseRulesSections[0].items, ["No smoking: Inside or outside"]);
  assert.equal(extractDescription({}), null);
});
test("all recovery branches select the requested listing", () => {
  const data={niobeClientData:["999","123"].map(id=>[null,{data:{node:{id:Buffer.from("DemandStayListing:"+id).toString("base64"),location:{id}}}}])};
  assert.equal(findNodeLocation(data,"123").id,"123");
  assert.equal(findNodeLocation(data,"456"),null);
});
test("compact mode preserves structured badge evidence", () => {
  assert.equal(compactSearchResult({badgeType:"SUPERHOST"},"https://www.airbnb.com").badgeType,"SUPERHOST");
});
test("invalid dates, bounds, counts and ids fail before networking", () => {
  for(const args of [{id:"../login"},{checkin:"2026-02-30"},{checkin:"2026-10-10",checkout:"2026-10-01"},{adults:1.5},{adults:-1},{ne_lat:10},{minPrice:100,maxPrice:20},{ne_lat:91,ne_lng:1,sw_lat:0,sw_lng:0}]) {
    assert.throws(()=>validateInputs(args));
  }
  validateInputs({id:"123",checkin:"2026-10-01",checkout:"2026-10-03",adults:2});
});
test("429 retries are bounded and respect reasonable Retry-After", () => {
  assert.equal(retryDelay(0,"2",0),2000);
  assert.equal(retryDelay(0,"3600",0),null);
  assert.equal(retryDelay(3,null,0),null);
  assert.equal(retryDelay(0,null,0),500);
});
