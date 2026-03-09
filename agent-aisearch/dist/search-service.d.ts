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
    rewriteQuery(query: string): Promise<string[]>;
    search(query: string, options?: SearchOptions, userToken?: string): Promise<SearchResultWithCitation[]>;
    smartSearch(query: string, options?: SearchOptions, userToken?: string): Promise<SearchResultWithCitation[]>;
    generateAnswer(query: string, context: SearchResultWithCitation[]): Promise<string>;
}
//# sourceMappingURL=search-service.d.ts.map