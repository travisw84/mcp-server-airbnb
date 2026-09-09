# Airbnb read-only search MCP

Personal maintained fork of OpenBnB, with selected upstream PRs and Daniel's
listing recovery fixes. Includes the `airbnb-holiday-search` Codex skill.
See [UPSTREAM.md](UPSTREAM.md) for included and deliberately omitted changes.

## Install from source

Requires Node.js 22 or later.

```sh
git clone https://github.com/TravisWinsor84/mcp-server-airbnb.git
cd mcp-server-airbnb
npm ci
```

`npm ci` builds `dist/index.js`. Configure your MCP client to run `node` with
the absolute path to that file. For Codex:

```toml
[mcp_servers.airbnb]
command = "node"
args = ["/absolute/path/mcp-server-airbnb/dist/index.js"]

[mcp_servers.airbnb.env]
AIRBNB_BASE_URL = "https://www.airbnb.com.au"
```

Copy `skills/airbnb-holiday-search` into your Codex skills directory.
Restart/reconnect the MCP after replacing a running build. This GitHub fork is
not the `@openbnb` npm release; do not install that package expecting these fixes.
GitHub releases include an npm tarball containing the built server and skill.

## Capabilities

- `airbnb_search`: destination, dates, guests, property type, amenities, minimum
  bedrooms/beds/bathrooms, instant-book/guest-favourite, price bounds, pagination,
  optional manual bounding box and compact output.
- `airbnb_listing_details`: requested listing ID, amenities (including unavailable
  groups), description, highlights, occupancy, house rules, rate-specific
  cancellation information, host status, review aggregates and photo-room tours
  when present in Airbnb's page state.
- Structured price line items and Airbnb's tax note when provided; no invented
  currency, tax inclusion or final checkout total.

Use the current tool schema for enum values. For example, an entire place with
air conditioning uses `propertyType: "entire_home"` and
`amenities: ["air_conditioning"]`, not amenity display labels.

## Configuration and limits

`AIRBNB_BASE_URL` chooses the regional origin. A detected country handoff reports
the target instead of silently claiming the search returned nothing.

Robots rules are respected by default. A caller explicitly authorized to override
may use `ignoreRobotsText: true` per request, or configure
`IGNORE_ROBOTS_TXT=true` / `--ignore-robots-txt`. The actual flag is not
`--no-robots`. This does not bypass CAPTCHA or guarantee access.

Photon geocoding with Nominatim fallback receives the destination string unless
you provide a Place ID, a full bounding box, or `DISABLE_GEOCODING=true`.
Disabling geocoding can reduce location accuracy. Four bbox corners are required.

This is public HTML extraction, not an official Airbnb API. Prices/availability
can change; missing fields are unknown. The server does not log in, store
account cookies, message hosts, save listings or book/cancel anything.
Use [the account-management skill](https://github.com/TravisWinsor84/mcp-airbnb-account)
through Codex's built-in browser/computer-use tools for those workflows.

## Verification and updates

```sh
npm test
npm audit
npm outdated
npm pack --dry-run
```

Offline tests include real stdio requests against a local HTTP fixture, with
robots handling, overlapping filter integration, compact badges, and details
recovery. CI runs on Node 22, 24 and 26. Dependabot tracks dependency updates.

Opt-in live public checks (no browser automation or account writes):

```sh
AIRBNB_BASE_URL=https://www.airbnb.com.au IGNORE_ROBOTS_TXT=true npm run test:live
```

On 10 September 2026, live search, geocoding, listing details and three amenity
cases passed. Offline suite: 105 tests plus domain-normalization checks.
These are snapshots, not a guarantee against future Airbnb markup changes.

## License

MIT. Original OpenBnB license and upstream authorship are retained.
