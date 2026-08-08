import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  findPdpPresentation,
  extractAmenities,
  extractHighlights,
  keyAmenityGroups,
  findNodeLocation,
  extractLocationCoordinate,
  recoverLocationSection,
  extractOccupancy,
  findBookingPrefetchData,
  extractCancellationPolicies,
  extractHouseRules,
} from "../dist/util.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fx = JSON.parse(
  readFileSync(join(__dirname, "fixtures", "pdp-presentation.json"), "utf8")
);

test("findPdpPresentation locates the branch without hardcoding an index", () => {
  assert.ok(findPdpPresentation(fx.healthy));
  assert.equal(findPdpPresentation(fx.noPdpBranch), null);
  assert.equal(findPdpPresentation({}), null);
  assert.equal(findPdpPresentation(null), null);
});

test("extractAmenities passes through the section title", () => {
  const out = extractAmenities(findPdpPresentation(fx.healthy));
  assert.equal(out.title, "What this place offers");
});

test("an all-unavailable group is left unmarked; its title carries the meaning", () => {
  const out = extractAmenities(findPdpPresentation(fx.healthy));
  const heat = out.seeAllAmenitiesGroups.find((g) => g.title === "Heating and cooling");
  const not = out.seeAllAmenitiesGroups.find((g) => g.title === "Not included");
  assert.deepEqual(heat.amenities, ["Central air conditioning", "Ceiling fan"]);
  // available:false is how Airbnb renders a struck-through amenity. The mechanism
  // is availability homogeneity, not the group's title: a group where every item
  // shares the same availability is left unmarked because the group's own name -
  // whatever it is - already tells the story. Only a group mixing available and
  // unavailable items needs its unavailable items called out individually. This
  // fixture's homogeneous group happens to be titled "Not included", but that
  // title is not what triggers the behavior - see the next test.
  assert.deepEqual(not.amenities, ["Dryer", "Hot water"]);
});

test("a homogeneously-unavailable group is left unmarked under any title, not just 'Not included'", () => {
  const pdp = {
    amenities: {
      seeAllAmenitiesGroups: [
        {
          title: "Kitchen extras",
          amenities: [
            { title: "Wine glasses", available: false },
            { title: "Coffee maker", available: false },
          ],
        },
      ],
    },
  };
  const out = extractAmenities(pdp);
  assert.deepEqual(out.seeAllAmenitiesGroups[0].amenities, ["Wine glasses", "Coffee maker"]);
});

test("a group mixing available and unavailable items marks the unavailable ones", () => {
  const pdp = {
    amenities: {
      seeAllAmenitiesGroups: [
        {
          title: "Laundry",
          amenities: [
            { title: "Washer", available: true },
            { title: "Dryer", available: false },
          ],
        },
      ],
    },
  };
  const out = extractAmenities(pdp);
  assert.deepEqual(out.seeAllAmenitiesGroups[0].amenities, [
    "Washer",
    "Dryer — unavailable",
  ]);
});

test("extractHighlights joins a subtitle onto its title when present", () => {
  const out = extractHighlights(findPdpPresentation(fx.healthy));
  assert.deepEqual(out.highlights, [
    "Dive right in: This is one of the few places in the area with a pool.",
    "Peace and quiet",
  ]);
});

// --- partial extraction: one field failing must not cost the others ---

test("amenities still extract when highlights are gone", () => {
  const pdp = findPdpPresentation(fx.amenitiesOnly);
  const amenities = extractAmenities(pdp);
  assert.ok(amenities, "amenities must survive a missing highlights field");
  assert.deepEqual(amenities.seeAllAmenitiesGroups[0].amenities, [
    "AC - split type ductless system",
  ]);
  assert.equal(extractHighlights(pdp), null, "missing highlights report as null, not as an error");
});

test("a malformed amenity group does not destroy the healthy groups around it", () => {
  const out = extractAmenities(findPdpPresentation(fx.partiallyMalformedGroups));
  const titles = out.seeAllAmenitiesGroups.map((g) => g.title);
  assert.ok(titles.includes("Bathroom"), "groups before the bad one must survive");
  assert.ok(titles.includes("Kitchen"), "groups after the bad one must survive");
  const bathroom = out.seeAllAmenitiesGroups.find((g) => g.title === "Bathroom");
  assert.deepEqual(bathroom.amenities, ["Hair dryer"]);
});

test("extraction returns null rather than throwing when the branch moves", () => {
  assert.equal(extractAmenities(null), null);
  assert.equal(extractAmenities({}), null);
  assert.equal(extractHighlights(null), null);
  assert.equal(extractHighlights({}), null);
});

test("extractAmenities returns null when every group is empty", () => {
  const pdp = {
    amenities: {
      seeAllAmenitiesGroups: [
        { title: "Bathroom", amenities: [] },
        { title: "Kitchen", amenities: [] },
      ],
    },
  };
  assert.equal(extractAmenities(pdp), null);
});

// --- subtitle shape: Airbnb has shipped this as both a plain string and a
// { text } object, on both amenities and highlights. Both must label the same. ---

test("extractAmenities labels a string subtitle and a { text } subtitle identically", () => {
  const pdp = findPdpPresentation(fx.subtitleShapes);
  const out = extractAmenities(pdp);
  assert.deepEqual(out.seeAllAmenitiesGroups[0].amenities, [
    "Shampoo (Body wash)",
    "Hair dryer (1200W)",
  ]);
});

test("extractHighlights labels a string subtitle and a { text } subtitle identically", () => {
  const pdp = findPdpPresentation(fx.subtitleShapes);
  const out = extractHighlights(pdp);
  assert.deepEqual(out.highlights, [
    "Great location: Walk to the beach",
    "Self check-in: Check yourself in with the keypad.",
  ]);
});

// --- keyAmenityGroups: no coverage at all before this branch ---

test("keyAmenityGroups keys groups by title", () => {
  const section = {
    seeAllAmenitiesGroups: [
      { title: "Bathroom", amenities: [{ title: "Hair dryer" }] },
      { title: "Kitchen", amenities: [{ title: "Oven" }] },
    ],
  };
  const out = keyAmenityGroups(section);
  assert.deepEqual(out.seeAllAmenitiesGroups, {
    Bathroom: [{ title: "Hair dryer" }],
    Kitchen: [{ title: "Oven" }],
  });
});

test("keyAmenityGroups falls back to 'Other' for an untitled group", () => {
  const section = {
    seeAllAmenitiesGroups: [{ amenities: [{ title: "Mystery item" }] }],
  };
  const out = keyAmenityGroups(section);
  assert.deepEqual(out.seeAllAmenitiesGroups, { Other: [{ title: "Mystery item" }] });
});

test("keyAmenityGroups merges duplicate titles by concatenation, not overwrite", () => {
  const section = {
    seeAllAmenitiesGroups: [
      { title: "Bathroom", amenities: [{ title: "Hair dryer" }] },
      { title: "Bathroom", amenities: [{ title: "Shampoo" }] },
    ],
  };
  const out = keyAmenityGroups(section);
  assert.deepEqual(out.seeAllAmenitiesGroups.Bathroom, [
    { title: "Hair dryer" },
    { title: "Shampoo" },
  ]);
});

test("keyAmenityGroups drops groups that have no amenities", () => {
  const section = {
    seeAllAmenitiesGroups: [
      { title: "Bathroom", amenities: [] },
      { title: "Kitchen", amenities: [{ title: "Oven" }] },
    ],
  };
  const out = keyAmenityGroups(section);
  assert.deepEqual(out.seeAllAmenitiesGroups, { Kitchen: [{ title: "Oven" }] });
  assert.ok(!("Bathroom" in out.seeAllAmenitiesGroups));
});

test("keyAmenityGroups passes through non-matching objects, arrays, and null unchanged", () => {
  assert.equal(keyAmenityGroups(null), null);
  assert.equal(keyAmenityGroups(42), 42);

  const arr = [1, 2, 3];
  assert.equal(keyAmenityGroups(arr), arr);

  const noGroups = { foo: "bar" };
  assert.deepEqual(keyAmenityGroups(noGroups), noGroups);
});

// --- listingId matching and fallback behavior ---

test("findPdpPresentation selects the requested listing when a neighbour is prefetched first", () => {
  const pdp = findPdpPresentation(fx.prefetchedNeighbour, "12345");
  assert.equal(pdp?.amenities?.title, "Requested Listing Amenities");
});

test("findPdpPresentation returns null when requested listing id matches nothing and no id-less fallback exists", () => {
  const pdp = findPdpPresentation(fx.prefetchedNeighbour, "88888");
  assert.equal(pdp, null);
});

test("findPdpPresentation falls back to an id-less node when no id-bearing entry matches", () => {
  const pdp = findPdpPresentation(fx.healthy, "12345");
  assert.equal(pdp?.amenities?.title, "What this place offers");
});

test("findPdpPresentation preserves existing behavior when listingId is omitted", () => {
  const pdp = findPdpPresentation(fx.prefetchedNeighbour);
  assert.equal(pdp?.amenities?.title, "Neighbour Amenities");
});


// --- Airbnb now ships headline/body instead of title/subtitle.
// Both shapes must be accepted. ---

test("extractHighlights maps the new headline/body shape (nested LocalizedContent) correctly", () => {
  const out = extractHighlights(findPdpPresentation(fx.highlightsNewShape));
  assert.ok(out, "expected highlights, got null");
  assert.deepEqual(out.highlights, [
    "Top 10% of homes: This home is highly ranked based on ratings, reviews, and reliability.",
    "Dive right in: This is one of the few places in the area with a pool.",
    "Peace and quiet",
    "Free parking: Free parking on premises",
  ]);
});

test("extractHighlights still maps the legacy title/subtitle shape (no regression)", () => {
  const out = extractHighlights(findPdpPresentation(fx.healthy));
  assert.deepEqual(out.highlights, [
    "Dive right in: This is one of the few places in the area with a pool.",
    "Peace and quiet",
  ]);
});

test("extractHighlights handles body as a { text } object", () => {
  const pdp = { highlights: [
    { headline: "Self check-in", body: { text: "Check yourself in with the lockbox." } },
  ] };
  const out = extractHighlights(pdp);
  assert.ok(out, "expected highlights, got null");
  assert.deepEqual(out.highlights, ["Self check-in: Check yourself in with the lockbox."]);
});

test("extractHighlights ignores non-string localized values instead of stringifying them", () => {
  const pdp = { highlights: [
    { headline: { localizedContent: { text: "nested" } }, title: "Superhost", body: "Great host" },
    { headline: { localizedContent: ["a", "b"] } },
  ] };
  const out = extractHighlights(pdp);
  assert.deepEqual(out.highlights, ["Superhost: Great host"]);
});

test("extractHighlights treats an empty new-shape value as missing and falls back to the legacy key", () => {
  const pdp = { highlights: [
    { headline: "", title: "Superhost", body: "", subtitle: "Great host" },
  ] };
  const out = extractHighlights(pdp);
  assert.deepEqual(out.highlights, ["Superhost: Great host"]);
});

test("extractHighlights output is always plain strings, never raw GraphQL objects", () => {
  // Regression guard: the previous code returned LocalizedContent objects instead
  // of extracting .localizedContent, so the output contained __typename keys.
  for (const key of ["highlightsNewShape", "healthy", "subtitleShapes", "highlightsMixed"]) {
    const pdp = findPdpPresentation(fx[key]);
    const out = extractHighlights(pdp);
    assert.ok(out, `${key} must yield highlights`);
    for (const h of out.highlights) {
      assert.equal(typeof h, "string", `highlight in ${key} must be a string, got: ${JSON.stringify(h)}`);
      assert.ok(!h.includes("__typename"), `highlight in ${key} must not contain __typename: ${h}`);
    }
  }
});

test("extractHighlights skips items missing both headline and title (no 'null: ...' string)", () => {
  const out = extractHighlights(findPdpPresentation(fx.highlightsMixed));
  assert.deepEqual(out.highlights, ["Great for families", "Superhost"]);
  for (const h of out.highlights) {
    assert.ok(!h.startsWith("null"), `must never produce a "null: ..." string, got: ${h}`);
  }
});

test("extractHighlights returns null for empty and absent highlights", () => {
  assert.equal(extractHighlights({ highlights: [] }), null);
  assert.equal(extractHighlights({ highlights: null }), null);
  assert.equal(extractHighlights({}), null);
  assert.equal(extractHighlights(null), null);
});

// --- LOCATION_DEFAULT recovery: same silent-failure mode PR #42 fixed for
// amenities/highlights, but LOCATION_DEFAULT recovers from node.location, a
// sibling of node.pdpPresentation, rather than from pdpPresentation itself. ---

test("findNodeLocation locates node.location without hardcoding an index", () => {
  assert.ok(findNodeLocation(fx.healthy));
  assert.equal(findNodeLocation(fx.noLocationBranch), null);
  assert.equal(findNodeLocation({}), null);
  assert.equal(findNodeLocation(null), null);
});

test("extractLocationCoordinate reads a real lat/lng off the node", () => {
  const out = extractLocationCoordinate(findNodeLocation(fx.healthy));
  assert.deepEqual(out, { lat: 45.3535, lng: -121.9452 });
});

test("extractLocationCoordinate returns null rather than a fabricated pair when stubbed", () => {
  assert.equal(extractLocationCoordinate(findNodeLocation(fx.locationStubbed)), null);
  assert.equal(extractLocationCoordinate(findNodeLocation(fx.noLocationBranch)), null);
  assert.equal(extractLocationCoordinate(null), null);
  assert.equal(extractLocationCoordinate({}), null);
});

test("extractLocationCoordinate rejects a half-formed pair (only one of lat/lng present)", () => {
  assert.equal(extractLocationCoordinate({ coordinate: { latitude: 45.3535 } }), null);
  assert.equal(extractLocationCoordinate({ coordinate: { longitude: -121.9452 } }), null);
});

test("recoverLocationSection passes a section with valid lat/lng through untouched", () => {
  const sections = [{ id: "LOCATION_DEFAULT", lat: 1, lng: 2, title: "Where you'll be" }];
  const out = recoverLocationSection(sections, { lat: 45.3535, lng: -121.9452 });
  assert.deepEqual(out, sections);
  assert.notEqual(out[0].lat, 45.3535, "present-and-valid values must win over recovery");
});

test("recoverLocationSection fills in a stubbed LOCATION_DEFAULT section from the recovered coordinate", () => {
  const sections = [{ id: "LOCATION_DEFAULT" }];
  const out = recoverLocationSection(sections, { lat: 45.3535, lng: -121.9452 });
  assert.equal(out.length, 1);
  assert.deepEqual(out[0], { id: "LOCATION_DEFAULT", lat: 45.3535, lng: -121.9452 });
});

test("recoverLocationSection adds LOCATION_DEFAULT when the section is absent entirely", () => {
  const sections = [{ id: "AMENITIES_DEFAULT" }];
  const out = recoverLocationSection(sections, { lat: 45.3535, lng: -121.9452 });
  assert.equal(out.length, 2);
  const loc = out.find((s) => s.id === "LOCATION_DEFAULT");
  assert.deepEqual(loc, { id: "LOCATION_DEFAULT", lat: 45.3535, lng: -121.9452 });
});

test("recoverLocationSection changes nothing when neither source has coordinates", () => {
  const sections = [{ id: "LOCATION_DEFAULT" }];
  const out = recoverLocationSection(sections, null);
  assert.deepEqual(out, sections);
  assert.ok(!("lat" in out[0]), "must omit lat rather than fabricate one");
  assert.ok(!("lng" in out[0]), "must omit lng rather than fabricate one");
});

test("rejects NaN and Infinity coordinates and recovers a NaN-carrying stub", () => {
  assert.equal(extractLocationCoordinate({ coordinate: { latitude: NaN, longitude: -121.9452 } }), null);
  assert.equal(extractLocationCoordinate({ coordinate: { latitude: 45.3535, longitude: Infinity } }), null);

  const sections = [{ id: "LOCATION_DEFAULT", lat: NaN, lng: -121.9452 }];
  const out = recoverLocationSection(sections, { lat: 45.3535, lng: -121.9452 });
  assert.deepEqual(out, [{ id: "LOCATION_DEFAULT", lat: 45.3535, lng: -121.9452 }]);
});

// --- occupancy ---

test("extractOccupancy surfaces personCapacity from pdpPresentation", () => {
  const out = extractOccupancy(findPdpPresentation(fx.withOccupancy));
  assert.deepEqual(out, { personCapacity: 10 });
});

test("extractOccupancy returns null when personCapacity is absent or non-numeric", () => {
  assert.equal(extractOccupancy(null), null);
  assert.equal(extractOccupancy({}), null);
  assert.equal(extractOccupancy(findPdpPresentation(fx.healthy)), null);
  assert.equal(extractOccupancy({ personCapacity: "10" }), null);
});

// --- house rules ---

test("extractHouseRules preserves quiet-hours subtitles on grouped rules", () => {
  const out = extractHouseRules(fx.policiesSection);
  assert.equal(out.title, "Things to know");
  assert.equal(out.houseRulesTitle, "House rules");
  const during = out.houseRulesSections.find((s) => s.title === "During your stay");
  assert.ok(during.items.includes("Quiet hours: 11:00 PM - 7:00 AM"));
  assert.ok(during.items.includes("10 guests maximum"));
  assert.ok(during.items.includes("No pets"));
});

test("extractHouseRules falls back to the short houseRules preview", () => {
  const out = extractHouseRules(fx.policiesPreviewOnly);
  assert.deepEqual(out.houseRules, [
    "Check-in after 4:00 PM",
    "7 guests maximum",
  ]);
  assert.equal(out.title, "House rules");
});

test("extractHouseRules labels a string subtitle and a { text } subtitle identically", () => {
  const section = {
    houseRulesSections: [
      {
        title: "During your stay",
        items: [
          { title: "Quiet hours", subtitle: "10:00 PM - 7:00 AM" },
          { title: "Quiet hours", subtitle: { text: "10:00 PM - 7:00 AM" } },
        ],
      },
    ],
  };
  const out = extractHouseRules(section);
  assert.deepEqual(out.houseRulesSections[0].items, [
    "Quiet hours: 10:00 PM - 7:00 AM",
    "Quiet hours: 10:00 PM - 7:00 AM",
  ]);
});

test("extractHouseRules returns null rather than throwing when rules are gone", () => {
  assert.equal(extractHouseRules(null), null);
  assert.equal(extractHouseRules({}), null);
  assert.equal(extractHouseRules({ houseRulesSections: [] }), null);
  assert.equal(extractHouseRules({ houseRules: [] }), null);
});

// --- cancellation policies ---

test("extractCancellationPolicies surfaces dual-rate options with upgrade price", () => {
  const out = extractCancellationPolicies(fx.bookingPrefetch);
  assert.deepEqual(out.cancellationPolicies, [
    {
      name: "Non-refundable",
      description:
        "Free cancellation for 24 hours. After that, the reservation is non-refundable.",
      priceType: "TIERED_PRICING_STANDARD",
    },
    {
      name: "Refundable",
      description:
        "Free cancellation before September 26. Cancel before check-in on October 1 for a partial refund.",
      priceType: "TIERED_PRICING_FLEXIBLE",
      price: "$138.67",
    },
  ]);
});

test("extractCancellationPolicies accepts camelCase field names", () => {
  const out = extractCancellationPolicies(fx.bookingPrefetchCamel);
  assert.deepEqual(out.cancellationPolicies, [
    {
      name: "Flexible",
      description: "Full refund up to 24 hours before check-in.",
      priceType: "TIERED_PRICING_FLEXIBLE",
    },
  ]);
});

test("findBookingPrefetchData walks the clientData path without hardcoding beyond the known tree", () => {
  const prefetch = findBookingPrefetchData(fx.clientDataWithPrefetch);
  assert.ok(prefetch);
  const out = extractCancellationPolicies(prefetch);
  assert.equal(out.cancellationPolicies[0].name, "Moderate");
});

test("findBookingPrefetchData finds prefetch when it is not at niobeClientData[0]", () => {
  const prefetch = findBookingPrefetchData(fx.clientDataPrefetchAtNonZeroIndex);
  assert.ok(prefetch, "expected bookingPrefetchData on a non-zero niobeClientData entry");
  const out = extractCancellationPolicies(prefetch);
  assert.equal(out.cancellationPolicies[0].name, "Flexible");
  assert.equal(out.cancellationPolicies[0].description, "Full refund 1 day prior to arrival.");
});

test("extractCancellationPolicies returns null when the array is absent or empty", () => {
  assert.equal(extractCancellationPolicies(null), null);
  assert.equal(extractCancellationPolicies({}), null);
  assert.equal(extractCancellationPolicies({ cancellationPolicies: [] }), null);
  assert.equal(extractCancellationPolicies({ cancellationPolicies: [{ noName: true }] }), null);
  assert.equal(findBookingPrefetchData({}), null);
  assert.equal(findBookingPrefetchData(null), null);
});
