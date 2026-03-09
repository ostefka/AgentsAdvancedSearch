import type { SearchResultWithCitation, SearchOptions } from "./types";
export declare class SearchService {
    private endpoint;
    private indexName;
    private miClientId;
    private aoaiEndpoint;
    private aoaiEmbeddingDeployment;
    private aoaiChatDeployment;
    constructor();
    private getCredential;
    /**
     * Get a SearchClient authenticated with the user's OBO token (per-user RBAC)
     * or fallback to managed identity if no user token is available.
     */
    private getSearchClient;
    private getEmbedding;
    private callOpenAI;
    /**
     * History-aware query rewriting with spelling correction and synonym expansion.
     * Uses conversation history to understand follow-up questions.
     */
    rewriteQuery(query: string, conversationHistory?: Array<{
        role: string;
        content: string;
    }>): Promise<string[]>;
    search(query: string, options?: SearchOptions, userToken?: string): Promise<SearchResultWithCitation[]>;
    /**
     * Advanced smart search: history-aware query rewriting, parallel execution,
     * iterative refinement if results are poor, weighted scoring.
     */
    smartSearch(query: string, options?: SearchOptions, userToken?: string, conversationHistory?: Array<{
        role: string;
        content: string;
    }>): Promise<SearchResultWithCitation[]>;
    /**
     * Compute a composite score that weighs semantic reranker score higher
     * than base BM25/vector score for better ranking.
     */
    private computeCompositeScore;
    generateAnswer(query: string, context: SearchResultWithCitation[], conversationHistory?: Array<{
        role: string;
        content: string;
    }>): Promise<string>;
}
//# sourceMappingURL=search-service.d.ts.map