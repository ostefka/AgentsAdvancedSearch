"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearchService = void 0;
const search_documents_1 = require("@azure/search-documents");
const identity_1 = require("@azure/identity");
class SearchService {
    endpoint;
    indexName;
    miClientId;
    aoaiEndpoint;
    aoaiEmbeddingDeployment;
    aoaiChatDeployment;
    constructor() {
        this.endpoint = process.env.AZURE_SEARCH_ENDPOINT || "";
        this.indexName = process.env.AZURE_SEARCH_INDEX_NAME || "";
        this.miClientId = process.env.AZURE_CLIENT_ID_MI || "";
        this.aoaiEndpoint = process.env.AZURE_OPENAI_ENDPOINT || "";
        this.aoaiEmbeddingDeployment = process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT || "text-embedding";
        this.aoaiChatDeployment = process.env.AZURE_OPENAI_CHAT_DEPLOYMENT || "gpt-4o-mini";
    }
    getCredential() {
        if (this.miClientId) {
            return new identity_1.ManagedIdentityCredential(this.miClientId);
        }
        return new identity_1.DefaultAzureCredential();
    }
    getSearchClient() {
        return new search_documents_1.SearchClient(this.endpoint, this.indexName, this.getCredential());
    }
    async getEmbedding(text) {
        const credential = this.getCredential();
        const token = await credential.getToken("https://cognitiveservices.azure.com/.default");
        const resp = await fetch(`${this.aoaiEndpoint}/openai/deployments/${this.aoaiEmbeddingDeployment}/embeddings?api-version=2024-06-01`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token.token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ input: text }),
        });
        if (!resp.ok)
            throw new Error(`Embedding API error: ${resp.status}`);
        const data = await resp.json();
        return data.data[0].embedding;
    }
    async rewriteQuery(query) {
        if (!this.aoaiEndpoint)
            return [query];
        try {
            const credential = this.getCredential();
            const token = await credential.getToken("https://cognitiveservices.azure.com/.default");
            const resp = await fetch(`${this.aoaiEndpoint}/openai/deployments/${this.aoaiChatDeployment}/chat/completions?api-version=2024-06-01`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token.token}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                    messages: [
                        {
                            role: "system",
                            content: `You are a search query optimizer. Given a user question, generate 1-3 optimized search queries that would find relevant documents. Return ONLY a JSON array of strings, no explanation. Example: ["query1", "query2"]`,
                        },
                        { role: "user", content: query },
                    ],
                    temperature: 0,
                    max_tokens: 200,
                }),
            });
            if (!resp.ok)
                return [query];
            const data = await resp.json();
            const content = data.choices[0]?.message?.content?.trim();
            const queries = JSON.parse(content);
            if (Array.isArray(queries) && queries.length > 0) {
                console.log(`Query rewritten: "${query}" → ${JSON.stringify(queries)}`);
                return queries.slice(0, 3);
            }
        }
        catch (e) {
            console.warn(`Query rewrite failed, using original: ${e}`);
        }
        return [query];
    }
    async search(query, options) {
        const client = this.getSearchClient();
        const searchType = options?.searchType || "hybrid";
        const top = options?.top || 5;
        const filter = options?.filter;
        const selectFields = [
            "id", "title", "content", "category",
            "source_url", "source_title", "source_type",
            "page_number", "chunk_id", "author", "last_modified",
            "department", "document_type", "document_version", "effective_date", "section_title"
        ];
        const searchOptions = { top, filter, select: selectFields };
        if (searchType === "semantic" || searchType === "hybrid") {
            searchOptions.queryType = "semantic";
            searchOptions.semanticSearchOptions = {
                configurationName: "default-semantic-config",
                errorMode: "partial",
                captions: { captionType: "extractive", highlight: true },
                answers: { answerType: "extractive", count: 3 },
            };
        }
        if (searchType === "hybrid") {
            const vector = await this.getEmbedding(query);
            searchOptions.vectorSearchOptions = {
                queries: [{
                        kind: "vector",
                        vector,
                        kNearestNeighborsCount: top,
                        fields: ["content_vector"],
                    }],
            };
        }
        const results = [];
        const searchResults = await client.search(query, searchOptions);
        for await (const result of searchResults.results) {
            const doc = result.document;
            const captions = [];
            if (result.captions) {
                for (const c of result.captions) {
                    if (c.text)
                        captions.push(c.text);
                }
            }
            results.push({
                content: doc.content || "",
                citation: {
                    id: doc.id,
                    title: doc.title || "Untitled",
                    sourceUrl: doc.source_url || "",
                    sourceTitle: doc.source_title || doc.title || "Unknown",
                    sourceType: doc.source_type || "Unknown",
                    pageNumber: doc.page_number,
                    chunkId: doc.chunk_id,
                    author: doc.author,
                    lastModified: doc.last_modified,
                    department: doc.department,
                    documentType: doc.document_type,
                    documentVersion: doc.document_version,
                    sectionTitle: doc.section_title,
                },
                score: result.score || 0,
                semanticScore: result.rerankerScore,
                captions,
            });
        }
        return results;
    }
    async smartSearch(query, options) {
        const queries = await this.rewriteQuery(query);
        const top = options?.top || 5;
        const filter = options?.filter;
        const allResults = new Map();
        for (const q of queries) {
            const results = await this.search(q, { top, filter, searchType: "hybrid" });
            for (const r of results) {
                const existing = allResults.get(r.citation.id);
                if (!existing || r.score > existing.score) {
                    allResults.set(r.citation.id, r);
                }
            }
        }
        return Array.from(allResults.values())
            .sort((a, b) => (b.semanticScore || b.score) - (a.semanticScore || a.score))
            .slice(0, top);
    }
    async generateAnswer(query, context) {
        const credential = this.getCredential();
        const token = await credential.getToken("https://cognitiveservices.azure.com/.default");
        const contextText = context.map((r, i) => {
            const src = r.citation.sourceTitle || r.citation.title;
            const caption = r.captions?.[0] || r.content.substring(0, 500);
            return `[${i + 1}] ${src}\n${caption}`;
        }).join("\n\n");
        const resp = await fetch(`${this.aoaiEndpoint}/openai/deployments/${process.env.AZURE_OPENAI_ANSWER_DEPLOYMENT || "gpt-4o"}/chat/completions?api-version=2024-06-01`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token.token}`, "Content-Type": "application/json" },
            body: JSON.stringify({
                messages: [
                    {
                        role: "system",
                        content: `You are an Enterprise Document Search assistant. Answer the user's question based ONLY on the provided document context. Always cite sources using [number] notation matching the context numbers. If the context doesn't contain enough information, say so. Respond in the same language the user uses.`,
                    },
                    {
                        role: "user",
                        content: `Question: ${query}\n\nDocument context:\n${contextText}`,
                    },
                ],
                temperature: 0.1,
                max_tokens: 2000,
            }),
        });
        if (!resp.ok)
            throw new Error(`Chat API error: ${resp.status}`);
        const data = await resp.json();
        return data.choices[0]?.message?.content || "No answer generated.";
    }
}
exports.SearchService = SearchService;
//# sourceMappingURL=search-service.js.map