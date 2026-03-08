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
    private getSearchClient;
    private getEmbedding;
    rewriteQuery(query: string): Promise<string[]>;
    search(query: string, options?: SearchOptions): Promise<SearchResultWithCitation[]>;
    smartSearch(query: string, options?: SearchOptions): Promise<SearchResultWithCitation[]>;
    generateAnswer(query: string, context: SearchResultWithCitation[]): Promise<string>;
}
//# sourceMappingURL=search-service.d.ts.map