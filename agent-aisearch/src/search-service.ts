import { SearchClient } from "@azure/search-documents";
import { DefaultAzureCredential, ManagedIdentityCredential } from "@azure/identity";
import type { SearchDocument, SearchResultWithCitation, SearchOptions, SearchType } from "./types";
import { exchangeForSearchToken } from "./auth";

export class SearchService {
  private endpoint: string;
  private indexName: string;
  private miClientId: string;
  private aoaiEndpoint: string;
  private aoaiEmbeddingDeployment: string;
  private aoaiChatDeployment: string;

  constructor() {
    this.endpoint = process.env.AZURE_SEARCH_ENDPOINT || "";
    this.indexName = process.env.AZURE_SEARCH_INDEX_NAME || "";
    this.miClientId = process.env.AZURE_CLIENT_ID_MI || "";
    this.aoaiEndpoint = process.env.AZURE_OPENAI_ENDPOINT || "";
    this.aoaiEmbeddingDeployment = process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT || "text-embedding";
    this.aoaiChatDeployment = process.env.AZURE_OPENAI_CHAT_DEPLOYMENT || "gpt-4o-mini";
  }

  private getCredential() {
    if (this.miClientId) {
      return new ManagedIdentityCredential(this.miClientId);
    }
    return new DefaultAzureCredential();
  }

  /**
   * Get a SearchClient authenticated with the user's OBO token (per-user RBAC)
   * or fallback to managed identity if no user token is available.
   */
  private async getSearchClient(userToken?: string): Promise<SearchClient<SearchDocument>> {
    if (userToken) {
      // OBO: exchange user token for AI Search-scoped token
      const searchToken = await exchangeForSearchToken(userToken);
      return new SearchClient<SearchDocument>(this.endpoint, this.indexName, {
        getToken: async () => ({
          token: searchToken,
          expiresOnTimestamp: Date.now() + 3600000,
        }),
      });
    }
    // Fallback to managed identity
    return new SearchClient<SearchDocument>(this.endpoint, this.indexName, this.getCredential());
  }

  private async getEmbedding(text: string): Promise<number[]> {
    const credential = this.getCredential();
    const token = await credential.getToken("https://cognitiveservices.azure.com/.default");
    const resp = await fetch(
      `${this.aoaiEndpoint}/openai/deployments/${this.aoaiEmbeddingDeployment}/embeddings?api-version=2024-06-01`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token.token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ input: text }),
      }
    );
    if (!resp.ok) throw new Error(`Embedding API error: ${resp.status}`);
    const data = await resp.json() as any;
    return data.data[0].embedding;
  }

  private async callOpenAI(deployment: string, messages: any[], options?: { temperature?: number; maxTokens?: number }): Promise<string> {
    const credential = this.getCredential();
    const token = await credential.getToken("https://cognitiveservices.azure.com/.default");
    const resp = await fetch(
      `${this.aoaiEndpoint}/openai/deployments/${deployment}/chat/completions?api-version=2024-06-01`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token.token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          messages,
          temperature: options?.temperature ?? 0,
          max_tokens: options?.maxTokens ?? 500,
        }),
      }
    );
    if (!resp.ok) throw new Error(`OpenAI API error: ${resp.status}`);
    const data = await resp.json() as any;
    return data.choices[0]?.message?.content?.trim() || "";
  }

  /**
   * History-aware query rewriting with spelling correction and synonym expansion.
   * Uses conversation history to understand follow-up questions.
   */
  async rewriteQuery(query: string, conversationHistory?: Array<{ role: string; content: string }>): Promise<string[]> {
    if (!this.aoaiEndpoint) return [query];

    const historyContext = conversationHistory && conversationHistory.length > 0
      ? `\n\nConversation history (for context — the user may be asking a follow-up):\n${conversationHistory.slice(-6).map(m => `${m.role}: ${m.content}`).join("\n")}`
      : "";

    try {
      const content = await this.callOpenAI(this.aoaiChatDeployment, [
        {
          role: "system",
          content: `You are an expert search query optimizer for enterprise document search. Your job is to maximize recall and precision.

Given a user question${historyContext ? " and conversation history" : ""}, generate 2-4 optimized search queries. Apply these strategies:
1. **Decompose** complex questions into focused sub-queries
2. **Fix spelling** errors and typos in the original query
3. **Expand synonyms** — add alternative terms (e.g., "BOZP" → also search "bezpečnost práce", "occupational safety")
4. **Translate key terms** — if the query is in Czech, also generate an English variant for technical terms
5. **Resolve references** — if conversation history shows the user is referring to something from earlier, make it explicit
6. **Keep one query close to the original** for exact-match relevance

Return ONLY a JSON array of strings. Example: ["query1", "query2", "query3"]`,
        },
        { role: "user", content: query },
      ], { maxTokens: 300 });

      const queries = JSON.parse(content);
      if (Array.isArray(queries) && queries.length > 0) {
        console.log(`Query rewritten: "${query}" → ${JSON.stringify(queries)}`);
        return queries.slice(0, 4);
      }
    } catch (e) {
      console.warn(`Query rewrite failed, using original: ${e}`);
    }
    return [query];
  }

  async search(query: string, options?: SearchOptions, userToken?: string): Promise<SearchResultWithCitation[]> {
    const client = await this.getSearchClient(userToken);
    const searchType: SearchType = options?.searchType || "hybrid";
    const top = options?.top || 8; // Retrieve more for better re-ranking
    const filter = options?.filter;

    const selectFields = [
      "id", "title", "content", "category",
      "source_url", "source_title", "source_type",
      "page_number", "chunk_id", "author", "last_modified",
      "department", "document_type", "document_version", "effective_date", "section_title"
    ] as any;

    const searchOptions: any = { top, filter, select: selectFields };

    if (searchType === "semantic" || searchType === "hybrid") {
      searchOptions.queryType = "semantic";
      searchOptions.semanticSearchOptions = {
        configurationName: "default-semantic-config",
        errorMode: "partial",
        captions: { captionType: "extractive", highlight: true },
        answers: { answerType: "extractive", count: 5 },
      };
    }

    if (searchType === "hybrid") {
      const vector = await this.getEmbedding(query);
      searchOptions.vectorSearchOptions = {
        queries: [{
          kind: "vector",
          vector,
          kNearestNeighborsCount: top * 2, // Over-retrieve vectors for better coverage
          fields: ["content_vector"],
        }],
      };
    }

    const results: SearchResultWithCitation[] = [];
    const searchResults = await client.search(query, searchOptions);

    for await (const result of searchResults.results) {
      const doc = result.document;
      const captions: string[] = [];
      if ((result as any).captions) {
        for (const c of (result as any).captions) {
          if (c.text) captions.push(c.text);
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
        semanticScore: (result as any).rerankerScore,
        captions,
      });
    }

    return results;
  }

  /**
   * Advanced smart search: history-aware query rewriting, parallel execution,
   * iterative refinement if results are poor, weighted scoring.
   */
  async smartSearch(
    query: string,
    options?: SearchOptions,
    userToken?: string,
    conversationHistory?: Array<{ role: string; content: string }>
  ): Promise<SearchResultWithCitation[]> {
    const top = options?.top || 5;
    const filter = options?.filter;

    // Phase 1: Rewrite query with conversation context
    const queries = await this.rewriteQuery(query, conversationHistory);

    // Phase 2: Execute all sub-queries in PARALLEL
    const searchPromises = queries.map(q =>
      this.search(q, { top: top + 3, filter, searchType: "hybrid" }, userToken)
        .catch(err => {
          console.warn(`Sub-query failed: "${q}" — ${err.message}`);
          return [] as SearchResultWithCitation[];
        })
    );
    const allSearchResults = await Promise.all(searchPromises);

    // Phase 3: Merge and deduplicate with best-score-wins
    const allResults = new Map<string, SearchResultWithCitation>();
    for (const results of allSearchResults) {
      for (const r of results) {
        const existing = allResults.get(r.citation.id);
        const rScore = this.computeCompositeScore(r);
        const existingScore = existing ? this.computeCompositeScore(existing) : -1;
        if (rScore > existingScore) {
          allResults.set(r.citation.id, r);
        }
      }
    }

    // Phase 4: Sort by composite score
    let ranked = Array.from(allResults.values())
      .sort((a, b) => this.computeCompositeScore(b) - this.computeCompositeScore(a))
      .slice(0, top);

    // Phase 5: Iterative refinement — if top results have low scores, try refined search
    const avgScore = ranked.length > 0
      ? ranked.reduce((sum, r) => sum + this.computeCompositeScore(r), 0) / ranked.length
      : 0;

    if (avgScore < 0.3 && ranked.length < top) {
      console.log(`Low score results (avg: ${avgScore.toFixed(3)}), attempting refined search...`);
      try {
        const refinedQuery = await this.callOpenAI(this.aoaiChatDeployment, [
          {
            role: "system",
            content: "The previous search returned poor results. Given the original question and what was found, generate 2 alternative search queries that might find better results. Return ONLY a JSON array.",
          },
          {
            role: "user",
            content: `Original question: ${query}\nPrevious queries tried: ${JSON.stringify(queries)}\nResults found: ${ranked.length} with average score ${avgScore.toFixed(3)}`,
          },
        ], { maxTokens: 200 });

        const refinedQueries = JSON.parse(refinedQuery);
        if (Array.isArray(refinedQueries)) {
          const refinedPromises = refinedQueries.slice(0, 2).map(q =>
            this.search(q, { top, filter, searchType: "hybrid" }, userToken).catch(() => [])
          );
          const refinedResults = await Promise.all(refinedPromises);
          for (const results of refinedResults) {
            for (const r of results) {
              if (!allResults.has(r.citation.id)) {
                allResults.set(r.citation.id, r);
              }
            }
          }
          ranked = Array.from(allResults.values())
            .sort((a, b) => this.computeCompositeScore(b) - this.computeCompositeScore(a))
            .slice(0, top);
          console.log(`After refinement: ${ranked.length} results`);
        }
      } catch (e) {
        console.warn(`Iterative refinement failed: ${e}`);
      }
    }

    return ranked;
  }

  /**
   * Compute a composite score that weighs semantic reranker score higher
   * than base BM25/vector score for better ranking.
   */
  private computeCompositeScore(r: SearchResultWithCitation): number {
    if (r.semanticScore !== undefined) {
      // Semantic reranker score (0-4) is much more reliable for relevance
      // Normalize to 0-1 and weight 70/30
      return (r.semanticScore / 4) * 0.7 + Math.min(r.score, 1) * 0.3;
    }
    return r.score;
  }

  async generateAnswer(
    query: string,
    context: SearchResultWithCitation[],
    conversationHistory?: Array<{ role: string; content: string }>
  ): Promise<string> {
    const contextText = context.map((r, i) => {
      const src = r.citation.sourceTitle || r.citation.title;
      const meta: string[] = [];
      if (r.citation.author) meta.push(`Author: ${r.citation.author}`);
      if (r.citation.department) meta.push(`Department: ${r.citation.department}`);
      if (r.citation.documentVersion) meta.push(`Version: ${r.citation.documentVersion}`);
      if (r.citation.lastModified) meta.push(`Modified: ${r.citation.lastModified}`);
      const metaLine = meta.length > 0 ? `\nMetadata: ${meta.join(", ")}` : "";
      const caption = r.captions?.[0] || r.content.substring(0, 800);
      return `[${i + 1}] Source: ${src}${metaLine}\nContent:\n${caption}`;
    }).join("\n\n---\n\n");

    const historyMessages = conversationHistory
      ? conversationHistory.slice(-6).map(m => ({ role: m.role, content: m.content }))
      : [];

    const answerDeployment = process.env.AZURE_OPENAI_ANSWER_DEPLOYMENT || "gpt-4o-mini";

    return await this.callOpenAI(answerDeployment, [
      {
        role: "system",
        content: `You are an Enterprise Document Search assistant. Your role is to provide accurate, comprehensive answers based on retrieved enterprise documents.

RULES:
1. Answer ONLY based on the provided document context. Never fabricate information.
2. Always cite sources using [number] notation that matches the document numbers in the context.
3. If multiple documents support the same point, cite all of them: [1][3].
4. If the context doesn't contain enough information to fully answer, explicitly state what information is missing.
5. Respond in the SAME LANGUAGE the user uses. If the user writes in Czech, respond in Czech. If English, respond in English.
6. When comparing information across documents, organize by document/company/topic with clear structure.
7. Include specific numbers, dates, versions, and names when available in the documents.
8. For questions about "how many" or "which companies", be exhaustive — list ALL matches found in the context.
9. Use markdown formatting for readability: bold for key terms, bullet lists for multiple items.
10. If document versions are mentioned, note which version contains which information.`,
      },
      ...historyMessages,
      {
        role: "user",
        content: `Question: ${query}\n\nDocument context:\n${contextText}`,
      },
    ], { temperature: 0.1, maxTokens: 3000 });
  }
}
