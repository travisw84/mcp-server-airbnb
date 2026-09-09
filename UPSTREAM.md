# Integration record

This remains a fork of openbnb-org/mcp-server-airbnb. Original MIT license and
commit authors are preserved. Integration reviewed 10 September 2026.

Included upstream PRs: #52 offline/live test split; #53 requested-listing match;
#59 current highlights shape; #55 location recovery; #57 occupancy and policies;
#58 host/badge status; #56 photo and sleeping/bathroom tours; #43 compact cards
and ID validation; #44 structured prices/tax notes; #36 room-type fix; #35
expanded amenities; #32 instant-book, guest-favourite, room counts and bounding
box; #37 review aggregates; #61 regional-domain configuration already on main.
The original commits were cherry-picked with their authors preserved.

Daniel's standalone fork (danielk-am/mcp-server-airbnb, MIT) informed UGC house
rule and description recovery: commits 1fe1771 and 79c26a1. Those small helpers
were adapted in reliability.ts instead of replacing the GitHub fork's ancestry.
Its absolute-URL robots-parser fix is also included. No private Coolify or
unauthenticated HTTP server configuration was copied.

PR #26's retry idea is implemented with bounded exponential backoff, jitter and
Retry-After handling. Long retry waits are returned as errors, not ignored.
#31/#19's private GraphQL review APIs are not included: persisted-query hashes
and web-client API keys are not stable supported account integrations. #39's
hardcoded Canadian domain is superseded by regional configuration. #11's
badge approach is superseded by text plus structured badge type. #38 hosting
metadata and issue #62 remote HTTP transport are outside this local stdio tool.

Integration-specific fixes: preserve host recovery without coordinates,
Superhost metadata in compact output, ID-aware location selection, locate
nonzero data branches, validate dates/counts/filter enums before network access,
deduplicate overlapping amenity URL parameters, and test the combined stdio
pipeline against a local HTTP fixture.

Known limits: public HTML is not a supported Airbnb API; fields and selectors
can change. No booking guarantee, inferred tax inclusion, review-text API,
account login or account writes. See the separate account skill repository.
