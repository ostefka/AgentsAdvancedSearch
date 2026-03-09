# Foundry IQ & Agentic Retrieval — Exhaustive Technical Research

> **Date:** March 2026  
> **Status:** All features are in **public preview** (no SLA, not recommended for production)  
> **API version:** `2025-11-01-preview`

---

## 1. What is Foundry IQ?

### Identity
Foundry IQ is **NOT** a separate Azure service. It is a **managed knowledge layer** within Microsoft Foundry (formerly Azure AI Foundry) that provides agents with permission-aware access to enterprise data. It is essentially a **portal experience + orchestration wrapper** on top of Azure AI Search's agentic retrieval capabilities.

### What it actually does
- Provides a UI in the Microsoft Foundry (new) portal for creating knowledge bases, connecting knowledge sources, and wiring them to agents
- Under the hood, all indexing, querying, and retrieval is performed by **Azure AI Search**
- Automates document chunking, vector embedding generation, and metadata extraction
- Schedules recurring indexer runs for incremental data refresh
- Synchronizes ACLs for supported sources and honors Microsoft Purview sensitivity labels
- Runs queries under the caller's Microsoft Entra identity for end-to-end permission enforcement

### How it differs from plain Azure AI Search queries
| Aspect | Plain AI Search | Foundry IQ |
|--------|----------------|------------|
| Query interface | You call Search REST or SDK directly | You call a knowledge base's `retrieve` action or MCP endpoint |
| Query planning | You write the query yourself | An LLM decomposes complex queries into focused subqueries |
| Multi-source | You query one index at a time | Knowledge base fans out across multiple knowledge sources |
| Semantic reranking | You enable it per query | Automatically applied to all subqueries |
| Chat history | Not supported at query level | Natively accepts conversation history |
| Result format | Raw search results (documents, scores) | Unified response with grounding data, citations, and activity log |
| Answer generation | Not included | Optional "answer synthesis" via LLM |

### Relationship to other IQ workloads
- **Fabric IQ** — semantic intelligence for Microsoft Fabric (analytics, Power BI)
- **Work IQ** — contextual intelligence for Microsoft 365 (documents, meetings, chats)
- **Foundry IQ** — managed knowledge for enterprise data (Azure, SharePoint, OneLake, web)

Each IQ workload is standalone but can be combined.

---

## 2. What is "Agentic Retrieval" in Azure AI Search?

### Definition
Agentic retrieval is a **new multi-query pipeline** in Azure AI Search designed for complex questions from users or agents. It is the **underlying engine** that powers Foundry IQ.

### Key distinction
- **Foundry IQ** = Portal experience in Microsoft Foundry that uses agentic retrieval
- **Agentic retrieval** = The actual API/engine in Azure AI Search that you can also call directly

**You do NOT need Foundry IQ to use agentic retrieval.** You can call the Azure AI Search APIs directly from any custom agent.

### Step-by-step: How agentic retrieval works

```
1. INITIATION
   Your app calls: POST /knowledgebases/{name}/retrieve
   Input: messages[] (conversation history) + query

2. QUERY PLANNING (LLM step — skipped if reasoning=minimal)
   The knowledge base sends messages + query to an Azure OpenAI LLM
   The LLM:
   - Reads the full chat thread to understand context
   - Breaks compound questions into focused subqueries
   - Selects which knowledge sources to query
   - Corrects spelling mistakes
   - Rewrites with synonyms/paraphrasing
   Output: 1-5 subqueries (depending on reasoning effort)

3. QUERY EXECUTION (parallel)
   All subqueries execute simultaneously against selected knowledge sources
   Each subquery runs:
   - Keyword search (BM25) on searchable text fields
   - Vector search on vector fields (if configured)
   - Combined hybrid if both are present
   - Semantic reranking (L2, or L3 for medium effort)
   - Scoring profiles, synonym maps, analyzers apply

4. RESULT SYNTHESIS
   Results from all subqueries are merged into a unified response:
   - response[]    → grounding data (unified string) or synthesized answer
   - activity[]    → query plan details, token counts, timing
   - references[]  → source document citations with ref_ids
```

### The three-part response

| Part | Purpose |
|------|---------|
| **response** | Either raw grounding data (extractiveData mode) or an LLM-generated answer (answerSynthesis mode) |
| **activity** | Transparency: shows subqueries, token counts, timing, which knowledge sources were queried |
| **references** | Source citations: document keys, semantic fields from source docs |

---

## 3. Capabilities vs. Our Manual Approach

### Feature-by-feature comparison

| Capability | Agentic Retrieval | Our Custom Agent (#8) |
|-----------|-------------------|----------------------|
| **Query decomposition** | LLM breaks complex query into 1-5 subqueries automatically | GPT-4o-mini rewrites into 1-3 queries via prompt |
| **Chat history awareness** | Native — accepts `messages[]` array with full conversation | Not implemented — each query is standalone |
| **Multi-index fan-out** | Built-in — queries across multiple knowledge sources simultaneously | Single index only |
| **Parallel execution** | All subqueries run in parallel | `for` loop — sequential execution |
| **Semantic reranking** | Automatic on all subqueries, L2 (low) or L3 (medium) | Enabled but single pass |
| **Hybrid search** | Automatic if index has both text + vector fields | Manual: BM25 + vector + semantic |
| **Deduplication** | Built-in result merging | Manual Map-based dedup by doc ID |
| **Spelling correction** | LLM corrects typos in query planning | Not implemented |
| **Iterative search** | Medium effort: if initial results insufficient, re-searches with refined queries | Not implemented |
| **Answer synthesis** | Built-in — LLM generates answer with `[ref_id:N]` citations | Manual — separate `generateAnswer()` call to GPT-4o |
| **Activity/transparency** | Full activity log: token counts, timing, subqueries | None — no query introspection |
| **MCP endpoint** | Each knowledge base is an MCP server | Not applicable |
| **OBO auth** | Supported via bearer token | Implemented via OBO token exchange |
| **Knowledge source selection** | LLM intelligently selects which sources to query | N/A — single index |

### What agentic retrieval adds that we DON'T have

1. **Chat history integration at retrieval time** — The LLM uses prior conversation turns to contextualize the current query. We don't pass history to query rewriting.

2. **Intelligent knowledge source selection** — With multiple indexes, the LLM decides which ones are relevant per query. We only search one index.

3. **Iterative search (medium effort)** — If initial results are poor (as judged by a semantic classifier), it runs a second pass with refined queries. We do a single pass.

4. **L3 semantic classification** — Medium effort upgrades to a higher-precision semantic classifier. We only get L2.

5. **Built-in spelling correction** — Part of query planning.

6. **Unified response format** — Structured `response[]` + `activity[]` + `references[]` with citation ref_ids. We assemble this manually.

7. **MCP server endpoint** — Any MCP-compatible client (GitHub Copilot, Claude, Cursor) can connect directly.

### What we do that agentic retrieval also does (parity)

- ✅ Query rewriting/decomposition (we use GPT-4o-mini prompt, they use LLM planning)
- ✅ Hybrid search (BM25 + vector + semantic)
- ✅ Semantic reranking
- ✅ Deduplication
- ✅ Answer generation from grounding data
- ✅ OBO authentication

### What we do BETTER (or equal)

- **Fine-grained control** — We have full control over prompts, scoring, field selection. Agentic retrieval's query planning is "automated and not customizable."
- **Sequential queries for free** — Our queries don't incur agentic retrieval token costs.
- **Custom answer generation** — We control the exact model, temperature, system prompt for answers. With agentic retrieval's answer synthesis, you can only provide `answerInstructions` text.
- **No preview dependency** — Our code is GA. Agentic retrieval is preview.

---

## 4. Knowledge Sources vs. Knowledge Bases vs. Regular Indexes

### Hierarchy

```
Knowledge Base (top-level orchestrator)
  ├── Knowledge Source 1 → wraps Search Index A
  ├── Knowledge Source 2 → wraps Blob container (auto-generates indexer pipeline)
  ├── Knowledge Source 3 → remote SharePoint (queried at runtime)
  └── Knowledge Source 4 → Bing web (queried at runtime)
```

### Knowledge Source — what it is
A knowledge source is a **wrapper object** on your search service that points to exactly one data structure:

| Type | Behavior |
|------|----------|
| `searchIndex` | Wraps an **existing** search index (your regular index!) |
| `azureBlob` | **Generates** a full indexer pipeline (data source, skillset, indexer, index) from a blob container |
| `indexedOneLake` | Generates pipeline from a OneLake lakehouse |
| `indexedSharePoint` | Generates pipeline from SharePoint |
| `remoteSharePoint` | Queries SharePoint directly at query time (no index) |
| `webParameters` | Queries Bing at query time (no index) |

**Critical insight:** The `searchIndex` type simply wraps your existing regular AI Search index. **No special index format is required.** Your index just needs:
- A semantic configuration (required)
- A vectorizer definition if you have vector fields (recommended)
- Searchable text fields

### Knowledge Base — what it is
A knowledge base is the orchestration layer that:
- References 1+ knowledge sources
- Connects to an LLM deployment (Azure OpenAI)
- Defines the default retrieval reasoning effort
- Exposes a `retrieve` action and an MCP endpoint

### How chunking/vectorization differs
- For `searchIndex` knowledge sources: **no difference** — you use your existing index as-is
- For `azureBlob`/`indexedOneLake`/`indexedSharePoint`: the knowledge source definition auto-generates the indexer pipeline with chunking and vectorization built in

---

## 5. Can We Achieve Parity? Can We Call the API from Our Custom Agent?

### YES — We can call the Agentic Retrieval API directly

The retrieve API is a standard REST endpoint on your Azure AI Search service:

```http
POST https://{search-service}.search.windows.net/knowledgebases/{kb-name}/retrieve?api-version=2025-11-01-preview
Authorization: Bearer {token}
Content-Type: application/json

{
    "messages": [
        { "role": "user", "content": [{ "type": "text", "text": "your question" }] }
    ],
    "retrievalReasoningEffort": { "kind": "low" },
    "outputMode": "extractiveData",
    "maxOutputSize": 6000
}
```

### SDK availability (preview)
- **.NET**: `Azure.Search.Documents 11.8.0-beta.1` — `KnowledgeBaseRetrievalClient`
- **Python**: `azure-search-documents 11.7.0b2`
- **JavaScript/TypeScript**: Preview package available (see CHANGELOG.md)
- **Java**: Preview package available

### How to integrate with Agent #8

**Option A: Use agentic retrieval as a drop-in replacement for `smartSearch()`**

```typescript
// Instead of our manual query rewriting + hybrid search:
const response = await fetch(
  `${searchEndpoint}/knowledgebases/${kbName}/retrieve?api-version=2025-11-01-preview`,
  {
    method: "POST",
    headers: { Authorization: `Bearer ${oboToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: conversationHistory, // includes chat history!
      retrievalReasoningEffort: { kind: "low" },
      outputMode: "extractiveData",
      maxOutputSize: 6000
    })
  }
);
const result = await response.json();
// result.response[0].content[0].text = JSON grounding data
// result.references = citation data
// result.activity = query plan details
```

**Option B: Use `minimal` reasoning effort (bypass LLM, use just the retrieval pipeline)**

This gives you the agentic retrieval response format without LLM query planning costs:

```typescript
{
    "intents": [{ "type": "semantic", "search": "your query" }]
    // No messages, no LLM, just hybrid search + semantic reranking
}
```

**Option C: Use `answerSynthesis` mode for end-to-end answer generation**

This replaces both `smartSearch()` AND `generateAnswer()`:

```typescript
{
    "messages": [...],
    "retrievalReasoningEffort": { "kind": "low" },
    "outputMode": "answerSynthesis",
    "answerInstructions": "Respond concisely with citations. Use the same language as the user."
}
```

### What's required to set up

1. Create a knowledge source wrapping your existing search index:
   ```
   PUT /knowledgesources/my-ks?api-version=2025-11-01-preview
   { "name": "my-ks", "searchIndexParameters": { "searchIndexName": "your-existing-index" } }
   ```

2. Create a knowledge base:
   ```
   PUT /knowledgebases/my-kb?api-version=2025-11-01-preview
   {
     "name": "my-kb",
     "knowledgeSources": [{ "name": "my-ks" }],
     "models": [{ "azureOpenAIParameters": { "resourceUri": "...", "deploymentName": "gpt-4o-mini" } }],
     "retrievalReasoningEffort": { "kind": "low" },
     "outputMode": "extractiveData"
   }
   ```

3. Call retrieve from your agent:
   ```
   POST /knowledgebases/my-kb/retrieve?api-version=2025-11-01-preview
   ```

### Can our manual approach fully replicate agentic retrieval?

| Feature | Replicable? | Notes |
|---------|-------------|-------|
| Query decomposition | ✅ Yes | We already do this |
| Chat history awareness | ✅ Yes | We'd need to pass history to our rewrite prompt |
| Parallel execution | ✅ Yes | Use `Promise.all()` |
| Multi-index | ✅ Yes | Create multiple SearchClients |
| Semantic reranking | ✅ Yes | Already enabled |
| Spelling correction | ✅ Yes | Add to our rewrite prompt |
| Iterative search | ⚠️ Partially | We could implement retry logic, but the L3 semantic classifier is proprietary |
| L3 classification | ❌ No | Proprietary to medium effort, not available via standard search API |
| MCP endpoint | ❌ No | Would need custom implementation |
| Activity/token tracking | ⚠️ Partially | We'd need to build our own telemetry |
| Answer synthesis with ref_ids | ✅ Yes | We already generate answers with citations |

---

## 6. Pricing Comparison

### Agentic Retrieval Costs

**Two billing streams:**

#### A. Azure AI Search — Agentic Reasoning Tokens
| Plan | Price |
|------|-------|
| Free tier | 50 million free agentic reasoning tokens/month |
| Standard plan | $0.022 per 1 million additional tokens (after free quota) |

Tokens = number of tokens returned by each subquery during retrieval.

#### B. Azure OpenAI — Query Planning + Answer Synthesis Tokens
Standard pay-as-you-go for the model you assign:
- GPT-4o-mini: $0.15/1M input, $0.60/1M output
- GPT-4o: higher rates

### Cost example from Microsoft docs (2,000 queries)

| Component | Calculation | Cost |
|-----------|-------------|------|
| AI Search agentic reasoning | 150M tokens × $0.022/1M | **$3.30** |
| AOAI input tokens (query planning) | 4M tokens × $0.15/1M | **$0.60** |
| AOAI output tokens (query plan) | 700K tokens × $0.60/1M | **$0.42** |
| **Total for 2,000 queries** | | **$4.32** |

That's **$0.00216 per query** (~0.2 cents).

### Our Custom Approach Costs

| Component | What we pay | Notes |
|-----------|-------------|-------|
| AI Search queries | Included in tier pricing (no per-query cost) | We pay for the service tier, not per query |
| Semantic ranker | Free plan or standard plan | Same cost whether manual or agentic |
| AOAI for query rewriting | GPT-4o-mini tokens | ~$0.15/1M input + $0.60/1M output |
| AOAI for answer generation | GPT-4o tokens | Higher cost model |
| AOAI for embeddings | text-embedding-3-large | ~$0.13/1M tokens |

### Comparison

For query **planning only** (not answer synthesis):
- **Our approach:** ~$0.0001-0.0003 per query (GPT-4o-mini for rewriting, ~200 input + 100 output tokens)
- **Agentic retrieval:** ~$0.002 per query (agentic reasoning tokens + AOAI planning tokens)

**Our manual approach is ~5-10x cheaper for query planning alone** because:
1. We don't pay agentic reasoning tokens ($0.022/1M)
2. Our rewrite prompt is simpler/shorter than their full query planning

However, these are small absolute numbers. At 10,000 queries/month:
- Our approach: ~$1-3/month for rewriting
- Agentic retrieval: ~$20/month

The **first 50M free agentic reasoning tokens** covers roughly 5,000-10,000 queries, so for low-volume scenarios, agentic retrieval could be free.

---

## 7. Detailed Reasoning Effort Comparison

| Property | Minimal | Low (default) | Medium |
|----------|---------|---------------|--------|
| LLM query planning | ❌ No | ✅ Single pass | ✅ + follow-up iteration |
| Subqueries | 1 (your query) | Up to 3 | Up to 5 |
| Knowledge sources/KB | Up to 10 | Up to 3 | Up to 5 |
| Semantic ranking docs | Standard L2 | 50 docs L2, 10 docs L3 | 50 docs L2, 20 docs L3 |
| Answer synthesis | ❌ Not supported | ✅ Up to 5,000 tokens | ✅ Up to 10,000 tokens |
| Iterative search | ❌ | ❌ | ✅ (one retry) |
| Chat history | ❌ Ignored | ✅ Used | ✅ Used |
| Cost | Lowest | Moderate | Highest |
| Latency | Lowest | Moderate | Highest |

### `minimal` is interesting for us
With `minimal`, you get:
- The agentic retrieval **response format** (response + activity + references)
- Hybrid/vector/keyword search with semantic reranking
- **No LLM costs** — you provide the query, no planning
- Your existing query rewriting still works
- Up to **10** knowledge sources

This is essentially our current approach but with the structured agentic response format.

---

## 8. Recommendation

### Summary of findings

| Aspect | Winner | Notes |
|--------|--------|-------|
| **Query quality** | Agentic retrieval (low/medium) | Chat history awareness + iterative search is superior |
| **Control & customization** | Custom solution | Query planning is "automated and not customizable" |
| **Cost** | Custom solution | ~5-10x cheaper per query |
| **Development effort** | Agentic retrieval | Less code to write/maintain |
| **Production readiness** | Custom solution | Agentic retrieval is preview, no SLA |
| **Multi-index/multi-source** | Agentic retrieval | Built-in fan-out vs. manual implementation |
| **MCP compatibility** | Agentic retrieval | Built-in MCP server |
| **Maturity** | Custom solution | GA vs. preview |
| **OBO auth** | Both | Both support bearer token auth |

### Recommendation: Hybrid approach (Phase 1: custom, Phase 2: evaluate agentic retrieval)

#### Phase 1 (Now): Stick with and improve our custom approach
- Agentic retrieval is **preview** — no SLA, API may change (already had a breaking rename from "knowledge agent" to "knowledge base")
- Our Agent #8 is for enterprise/production use
- We already have query rewriting + hybrid search + deduplication + answer generation
- **Quick wins to add:**
  - Pass conversation history to the rewrite prompt (closes the biggest gap)
  - Switch sequential query execution to `Promise.all()` for parallelism
  - Add spelling correction to rewrite prompt

#### Phase 2 (When agentic retrieval goes GA): Evaluate integration
- Use the `retrieve` REST API directly from Agent #8 (it's just an HTTP call)
- Could use `minimal` reasoning effort (no LLM cost) just for the structured response format
- Could use `low` effort to offload query planning to the service
- Our OBO token flow works directly — pass bearer token in Authorization header

#### Why NOT switch now
1. **Preview = breaking changes are likely.** Already had one (knowledge agent → knowledge base rename, 2025-08-01 → 2025-11-01)
2. **The JS SDK is in early preview.** Only .NET and Python have substantial samples
3. **We lose control.** Query planning is not customizable. If it makes bad subqueries, we can't fix it
4. **The cost delta is small** — we'd pay ~$15-20/month more for 10K queries, but we lose visibility
5. **We already achieve ~80% of agentic retrieval's benefits** with our current code

#### When it WOULD make sense to switch
- When agentic retrieval reaches **GA** with SLA
- If we need **multi-index fan-out** across different knowledge domains
- If we want **MCP endpoint** compatibility (e.g., Copilot Studio integration)
- If the **iterative search** (medium effort) proves significantly better for our data

### Quick reference: Integration code if we decide to try it

```typescript
// Setup (one-time): Create knowledge source + knowledge base via REST
// Ongoing: Replace smartSearch + generateAnswer with single call

async function agenticRetrieve(
  messages: Array<{role: string, content: string}>,
  userToken: string
): Promise<AgenticResponse> {
  const resp = await fetch(
    `${SEARCH_ENDPOINT}/knowledgebases/${KB_NAME}/retrieve?api-version=2025-11-01-preview`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${userToken}`,  // OBO token works directly!
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messages: messages.map(m => ({
          role: m.role,
          content: [{ type: "text", text: m.content }]
        })),
        retrievalReasoningEffort: { kind: "low" },
        outputMode: "answerSynthesis",
        answerInstructions: "Respond concisely with citations [ref_id:N]. Use the same language as the user.",
        maxOutputSize: 6000,
        maxRuntimeInSeconds: 30
      })
    }
  );
  return await resp.json();
}
```

---

## Appendix: Agentic Retrieval Limits by Tier

| Limit | Free | Basic | S1 | S2 | S3 | S3 HD | L1 | L2 |
|-------|------|-------|----|----|----|----|----|----|
| Knowledge sources/service | 3 | 5-15 | 50 | 200 | 200 | 0 | 10 | 10 |
| Knowledge bases/service | 3 | 5-15 | 50 | 200 | 200 | 0 | 10 | 10 |
| KB sources (minimal) | 3 | 5-10 | 10 | 10 | 10 | 0 | 10 | 10 |
| KB sources (low) | 3 | 3 | 3 | 3 | 3 | 0 | 3 | 3 |
| KB sources (medium) | 3 | 5 | 5 | 5 | 5 | 0 | 5 | 5 |

**Note:** S3 HD does NOT support agentic retrieval (max = 0).

## Appendix: Supported LLMs for Query Planning

- gpt-4o
- gpt-4o-mini
- gpt-4.1
- gpt-4.1-nano
- gpt-4.1-mini
- gpt-5
- gpt-5-nano
- gpt-5-mini

Any model can be used for final answer generation (downstream, outside agentic retrieval).
