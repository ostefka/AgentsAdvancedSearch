import type { SearchResultWithCitation } from "./types";
/**
 * Build an Adaptive Card JSON for search results with document previews,
 * scores, and clickable links.
 */
export declare function buildSearchResultsCard(query: string, answer: string, results: SearchResultWithCitation[]): object;
/**
 * Build a simple text-only response with citations for environments
 * where Adaptive Cards may not render well.
 */
export declare function buildTextResponse(answer: string, results: SearchResultWithCitation[]): string;
//# sourceMappingURL=cards.d.ts.map