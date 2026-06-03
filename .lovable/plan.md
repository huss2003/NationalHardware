## Goal
Show every customer and supplier in the Ledger party picker, not just the first 50.

## Root cause
The data is all there — the database holds 509 customers and 140 suppliers, and the Ledger query fetches all of them. The problem is purely in the display: in `src/routes/_app.ledger.tsx` the `filtered` list applies `.slice(0, 50)` both when there's no search and when searching. So only 50 names ever appear in the sidebar list.

## Change
In `src/routes/_app.ledger.tsx`, update the `filtered` memo (around lines 45–51) so it no longer truncates to 50:
- When there is no search query, return the full sorted list of parties.
- When searching, return all matching parties (no `.slice` cap).

The list already lives inside a scrollable container (`max-h-[60vh] overflow-y-auto`), so rendering the full list is fine — the user can scroll/search through all 509 customers and 140 suppliers. A small count label (e.g. "Showing X parties") can be added above the list so it's clear how many exist.

## Result
All parties become visible and searchable in the Ledger; selecting any one shows their full transaction history and outstanding balance as before. No database or business-logic changes are needed.
