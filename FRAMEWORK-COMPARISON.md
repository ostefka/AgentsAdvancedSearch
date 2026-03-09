# Framework Comparison: Custom Engine Agent for M365 Copilot + Teams

> **Date:** March 2026  
> **Context:** Agent #8 — enterprise custom engine agent with SSO + OBO, Azure AI Search hybrid search, Adaptive Cards, session memory  
> **Target:** M365 Copilot (`copilotAgents.customEngineAgents`) + Teams, deployed on Container App

---

## The Three Options

| | **Option A: Teams SDK v2** | **Option B: Semantic Kernel JS** | **Option C: Raw Botbuilder** |
|---|---|---|---|
| **Package** | `@microsoft/teams.apps` + `@microsoft/teams.ai` + `@microsoft/teams.cards` | `@microsoft/semantic-kernel` (JS) | `botbuilder` (v4.23+) |
| **Repo** | [microsoft/teams-sdk](https://github.com/microsoft/teams-sdk) | [microsoft/semantic-kernel](https://github.com/microsoft/semantic-kernel) | [microsoft/botbuilder-js](https://github.com/microsoft/botbuilder-js) |
| **Architecture** | Replaces BotBuilder entirely — NOT built on BotBuilder | Orchestration layer; needs a bot host (M365 Agents SDK or BotBuilder) | Low-level Bot Framework SDK |
| **Languages** | TypeScript, C#, Python | C#, Python, **Java**; JS/TS is early/limited | TypeScript, C#, Python, Java |
| **Status** | GA (March 2026); v2 is the "rewrite" of Teams AI Library v1 | C# is mature; JS/TS is experimental/early | Stable, but in maintenance mode |

---

## 1. SSO + OBO Token Exchange (CRITICAL)

### Option A: Teams SDK v2
- **Built-in SSO/OAuth support** via `app.oauth` configuration
- Automatic token exchange through Azure Bot Service token service
- Simple `signin()` / `signout()` methods injected into handlers
- **OBO gap:** The SDK handles SSO → gets a user token. You must then manually perform OBO exchange via `@azure/identity` `OnBehalfOfCredential` to get a token for downstream services (AI Search). The SDK does NOT do this automatically.
- SSO works in **personal scope only** (Teams constraint, applies to all frameworks)

```typescript
// Teams SDK v2 — SSO + OBO pattern
const app = new App({
  oauth: { defaultConnectionName: 'graph' }
});

app.on('message', async ({ signin, token, send }) => {
  if (!await signin()) return; // SSO/OAuth flow
  
  // OBO: exchange the SSO token for AI Search scoped token
  const oboCredential = new OnBehalfOfCredential({
    tenantId, clientId, clientSecret,
    userAssertionToken: token.token
  });
  const searchToken = await oboCredential.getToken(['https://search.azure.com/.default']);
  // Use searchToken with AI Search SDK
});
```

### Option B: Semantic Kernel JS
- **No built-in SSO/OBO support** — Semantic Kernel is an orchestration framework, not a bot framework
- Must be paired with M365 Agents SDK or BotBuilder for bot hosting + SSO
- The Copilot Camp BAF labs (C#) use M365 Agents SDK + Semantic Kernel for tool calling, with SSO handled at the bot layer
- **JS/TS status:** SK JS doesn't have mature SSO integration; you'd implement OBO manually regardless

### Option C: Raw Botbuilder
- **Manual SSO implementation** via `OAuthPrompt` / `TeamsBotSsoPrompt` dialog
- Well-documented pattern using `@azure/identity` `OnBehalfOfCredential`
- **OfficeDev samples:** `bot-sso` and `bot-sso-docker` samples show complete SSO + OBO implementation with Dialogs
- More boilerplate but full control over token lifecycle

```typescript
// Botbuilder — SSO + OBO (from OfficeDev samples)
const oboCredential = new OnBehalfOfCredential({
  tenantId: config.tenantId,
  clientId: config.clientId,
  clientSecret: config.clientSecret,
  userAssertionToken: ssoToken
});
const authProvider = new TokenCredentialAuthenticationProvider(oboCredential, {
  scopes: ['https://search.azure.com/.default']
});
```

### Verdict: SSO/OBO
| | SSO Built-in | OBO Built-in | Effort |
|---|---|---|---|
| Teams SDK v2 | ✅ Yes | ❌ Manual | Low |
| Semantic Kernel JS | ❌ No | ❌ Manual | High (needs host) |
| Raw Botbuilder | ⚠️ Via Dialogs | ❌ Manual | Medium |

**Winner: Teams SDK v2** — simplest SSO, OBO is manual regardless.

---

## 2. Adaptive Card Support (Copilot vs Teams)

### What Works in M365 Copilot
Based on Microsoft documentation and testing:

| Feature | Teams | M365 Copilot |
|---|---|---|
| Card rendering (TextBlock, Image, ColumnSet) | ✅ | ✅ |
| `Action.OpenUrl` | ✅ | ✅ |
| `Action.Execute` (invoke to bot) | ✅ | ✅ |
| `Action.Submit` (legacy) | ✅ | ⚠️ Limited |
| `Action.ShowCard` | ✅ | ⚠️ May not render |
| `Action.ToggleVisibility` | ✅ | ⚠️ May not render |
| Input controls (TextInput, ChoiceSet) | ✅ | ⚠️ Limited support |
| `msteams.width: "Full"` | ✅ | ❌ Ignored |
| AI label + citations entity format | ✅ | ✅ |
| Feedback buttons (`channelData.feedbackLoop`) | ✅ | ✅ |
| Sensitivity labels | ✅ | ✅ |
| Streaming + cards in same turn | ✅ | ⚠️ Ordering issues |
| Hero/Thumbnail cards | ✅ | ✅ |

**Key limitations in Copilot:**
- Interactive card features (inputs, show/hide) are limited
- Card width control may not work
- Message ordering with streaming + cards needs care (use single `StreamingResponse` per turn)
- Citation modal windows support Adaptive Cards but **without interactive items**

### Citation Format (Works in Both Teams + Copilot)
```typescript
// Citation entity format — works with ANY framework
await context.sendActivity({
  type: 'message',
  text: 'Here are the results [1][2]',
  entities: [{
    type: 'https://schema.org/Message',
    '@type': 'Message',
    '@context': 'https://schema.org',
    additionalType: ['AIGeneratedContent'],
    citation: [{
      '@type': 'Claim',
      position: 1,
      appearance: {
        '@type': 'DigitalDocument',
        name: 'Document Title',
        url: 'https://sharepoint.com/doc1',
        abstract: 'Document excerpt...',
        keywords: ['policy', 'HR'],
        image: { '@type': 'ImageObject', name: 'Microsoft Word' }
      }
    }]
  }]
});
```

### Framework Comparison for Adaptive Cards

| | Option A: Teams SDK v2 | Option B: SK JS | Option C: Botbuilder |
|---|---|---|---|
| Card builder | `@microsoft/teams.cards` — type-safe `AdaptiveCard`, `TextBlock`, etc. | None built-in | `CardFactory.adaptiveCard(json)` |
| Card templating | First-class `new AdaptiveCard(...)` fluent API | N/A | JSON + `adaptivecards-templating` |
| Citation support | Auto via `PredictedSayCommand` in AI module | Manual entity construction | Manual entity construction |
| Feedback buttons | `enable_feedback_loop: true` in AI module | Manual `channelData` | Manual `channelData` |
| AI label | Automatic in AI module | Manual entity | Manual entity |

**Winner: Teams SDK v2** — type-safe card builder + automatic citation/feedback support.

---

## 3. AI Search Integration (Hybrid Search + Query Rewriting)

### Option A: Teams SDK v2
- **No built-in AI Search connector** — the SDK focuses on Teams/bot concerns
- You bring your own search client (`@azure/search-documents`)
- The `ChatPrompt` AI module supports custom functions/tools, so you can register a search tool
- No conflict — just call Azure AI Search SDK directly from your handler

```typescript
app.on('message', async ({ send, activity }) => {
  const results = await searchService.hybridSearch(activity.text);
  const card = buildResultsCard(results);
  await send(card);
});
```

### Option B: Semantic Kernel JS  
- **C# has `AzureAISearchVectorStoreRecordCollection`** — mature vector store connector
- **JS/TS:** Limited/no Azure AI Search connector as of March 2026
- Even in C#, hybrid search (BM25 + vector + semantic reranking) requires custom implementation beyond the basic vector store abstraction
- Query rewriting would use SK's prompt/planner capabilities

### Option C: Raw Botbuilder
- **Current working implementation** — direct Azure AI Search SDK calls
- Full control over `SearchClient` configuration
- Our existing `search-service.ts` already implements hybrid search + query rewriting + deduplication

### Verdict: AI Search
All three options require direct `@azure/search-documents` SDK usage for hybrid search. None provide a turnkey integration for BM25 + vector + semantic reranking + query rewriting.

**Winner: Tie** — all three use the same underlying SDK. Your existing `search-service.ts` works with any framework.

---

## 4. Conversation State / Session Memory

### Option A: Teams SDK v2
- Memory via `ChatPrompt` conversation history — automatic
- The `ChatPrompt` class manages message history for multi-turn conversations
- System/user/assistant messages tracked per conversation
- For persistent state, integrate with `MemoryStorage` or CosmosDB

```typescript
const prompt = new ChatPrompt({
  model: new OpenAIChatModel({ ... }),
  // history is managed automatically per conversation
});
const result = await prompt.send(userMessage, { instructions: systemPrompt });
```

### Option B: Semantic Kernel JS
- `ChatHistory` class for conversation history
- C# has rich `IChatCompletionService` with history management
- JS/TS: Basic chat history support exists

### Option C: Raw Botbuilder
- `ConversationState` + `MemoryStorage` for state management
- Manual conversation history tracking (push messages to array, manage context window)
- Fully customizable but more code

### Verdict: Session Memory
| | Built-in Chat History | State Management | Effort |
|---|---|---|---|
| Teams SDK v2 | ✅ Automatic in ChatPrompt | ✅ Built-in | Low |
| Semantic Kernel JS | ⚠️ Basic | ⚠️ Basic | Medium |
| Raw Botbuilder | ❌ Manual | ✅ ConversationState | High |

**Winner: Teams SDK v2** — `ChatPrompt` handles history automatically.

---

## 5. Typing Indicators + Streaming

### Option A: Teams SDK v2
- `TypingActivityInput` for typing indicators
- Streaming via `StreamingResponse` (same underlying M365 Agents SDK mechanism)
- `QueueInformativeUpdateAsync` for progress messages like "Searching..."

### Option B: Semantic Kernel JS
- No built-in typing/streaming for bot channel — depends on host framework

### Option C: Raw Botbuilder
- `context.sendActivity({ type: 'typing' })` for typing indicators
- `StreamingResponse` available in newer `@microsoft/agents-hosting` package
- Progress messages: send regular text activities between operations

### Verdict: Typing/Streaming
**Tie between A and C.** Both support typing + streaming. Teams SDK v2 has slightly cleaner API.

---

## 6. TypeScript Support Quality

| | TypeScript Quality | Type Safety | DX |
|---|---|---|---|
| **Teams SDK v2** | ✅ Excellent — TypeScript-first design, full type safety for cards/activities/handlers | ✅ Strong | ✅ Modern, fluent API |
| **Semantic Kernel JS** | ⚠️ Early — JS/TS package exists but lags significantly behind C# | ⚠️ Partial | ❌ Limited docs/samples |
| **Raw Botbuilder** | ✅ Good — mature TS types, large ecosystem | ✅ Good | ⚠️ Verbose, callback-heavy |

**Winner: Teams SDK v2** — purpose-built for TypeScript with modern patterns.

---

## 7. Maturity / Production Readiness

| | GA Status | Enterprise Usage | Risk |
|---|---|---|---|
| **Teams SDK v2** | GA (JS/C# as of early 2026) | Growing — new SDK, limited production stories | ⚠️ Medium — new SDK, migration from v1 ongoing |
| **Semantic Kernel JS** | ❌ Not GA for JS/TS | C# is production-ready, JS is not | 🔴 High for JS/TS |
| **Raw Botbuilder** | ✅ GA, proven | Vast production deployments | ✅ Low risk, but maintenance mode |

**Winner: Raw Botbuilder** for proven stability; **Teams SDK v2** for forward direction.

---

## 8. Community Samples & Documentation

### Relevant Samples Found

| Sample | Framework | SSO | AI Search | Adaptive Cards | Copilot | URL |
|---|---|---|---|---|---|---|
| **bot-sso** | Botbuilder + Agents SDK | ✅ OBO | ❌ | ✅ | ❌ | [OfficeDev/m365-agents-toolkit-samples/bot-sso](https://github.com/OfficeDev/microsoft-365-agents-toolkit-samples/tree/main/bot-sso) |
| **bot-sso-docker** | Botbuilder + Agents SDK | ✅ OBO | ❌ | ✅ | ❌ | [OfficeDev/m365-agents-toolkit-samples/bot-sso-docker](https://github.com/OfficeDev/microsoft-365-agents-toolkit-samples/tree/main/bot-sso-docker) |
| **ProxyAgent-NodeJS** | M365 Agents SDK | ✅ SSO | ❌ (Foundry) | ❌ | ✅ Copilot | [OfficeDev/m365-agents-toolkit-samples/ProxyAgent-NodeJS](https://github.com/OfficeDev/microsoft-365-agents-toolkit-samples/tree/main/ProxyAgent-NodeJS) |
| **ProxyAgent-CSharp** | M365 Agents SDK | ✅ SSO + FIC | ❌ (Foundry) | ❌ | ✅ Copilot | [OfficeDev/m365-agents-toolkit-samples/ProxyAgent-CSharp](https://github.com/OfficeDev/microsoft-365-agents-toolkit-samples/tree/main/ProxyAgent-CSharp) |
| **data-analyst-agent-v2** | Teams SDK v2 | ❌ | ❌ | ✅ Charts | ✅ Copilot | [OfficeDev/m365-agents-toolkit-samples/data-analyst-agent-v2](https://github.com/OfficeDev/microsoft-365-agents-toolkit-samples/tree/main/data-analyst-agent-v2) |
| **coffee-agent** | Teams SDK v2 | ❌ | ❌ | ✅ Rich cards | ✅ | [OfficeDev/m365-agents-toolkit-samples/coffee-agent](https://github.com/OfficeDev/microsoft-365-agents-toolkit-samples/tree/main/coffee-agent) |
| **travel-agent** | M365 Agents SDK + SK (C#) | ❌ | ❌ | ✅ | ✅ Copilot | [OfficeDev/m365-agents-toolkit-samples/travel-agent](https://github.com/OfficeDev/microsoft-365-agents-toolkit-samples/tree/main/travel-agent) |
| **query-org-user-with-ME-sso** | Teams AI v1 | ✅ SSO | ❌ | ✅ | ❌ | [OfficeDev/m365-agents-toolkit-samples/query-org-user-with-message-extension-sso](https://github.com/OfficeDev/microsoft-365-agents-toolkit-samples/tree/main/query-org-user-with-message-extension-sso) |
| **Copilot Camp BAF2** | M365 Agents SDK + SK (C#) | ❌ | ✅ AI Search KB | ❌ | ✅ Copilot | [Lab BAF2](https://microsoft.github.io/copilot-camp/pages/custom-engine/agent-framework/02-add-claim-search/) |
| **Copilot Camp BMA4** | M365 Agents SDK (C#) | ❌ | ❌ | ❌ | ✅ Copilot | [Lab BMA4](https://microsoft.github.io/copilot-camp/pages/custom-engine/agents-sdk/04-bring-agent-to-copilot/) |

### Key Finding
**No official sample combines ALL of: SSO + OBO + AI Search + Adaptive Cards + Copilot custom engine agent.** This is a gap in the ecosystem. The closest is:
- Copilot Camp BAF2 (C#, AI Search + Copilot, but no SSO/OBO)
- bot-sso-docker (TypeScript, SSO/OBO, but no AI Search or Copilot)
- ProxyAgent-NodeJS (TypeScript, SSO + Copilot, but Foundry-backed, no direct AI Search)

---

## 9. Copilot Custom Engine Agent Compatibility

All three frameworks support `copilotAgents.customEngineAgents` in manifest v1.22 — this is a **manifest-level concern**, not a framework concern.

```json
// manifest.json — works with ANY bot framework
{
  "$schema": "https://developer.microsoft.com/en-us/json-schemas/teams/v1.22/MicrosoftTeams.schema.json",
  "manifestVersion": "1.22",
  "bots": [{ "botId": "${{BOT_ID}}", "scopes": ["personal"] }],
  "copilotAgents": {
    "customEngineAgents": [{ "id": "${{BOT_ID}}", "type": "bot" }]
  }
}
```

The bot just needs to:
1. Accept activities at `/api/messages`
2. Handle `message` activities
3. Return proper activity responses

**All three frameworks satisfy this.** Teams SDK v2 even has explicit Copilot documentation.

---

## Summary Scorecard

| Criteria | Teams SDK v2 | Semantic Kernel JS | Raw Botbuilder |
|---|:---:|:---:|:---:|
| **SSO/OBO** | ⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ |
| **Adaptive Cards** | ⭐⭐⭐⭐⭐ | ⭐ | ⭐⭐⭐ |
| **AI Search integration** | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ |
| **Session memory** | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ |
| **Typing/streaming** | ⭐⭐⭐⭐ | ⭐ | ⭐⭐⭐ |
| **TypeScript quality** | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ |
| **Maturity** | ⭐⭐⭐ | ⭐ (JS) | ⭐⭐⭐⭐⭐ |
| **Samples/docs** | ⭐⭐⭐ | ⭐ (JS) | ⭐⭐⭐⭐ |
| **Copilot compat** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **TOTAL** | **37/45** | **16/45** | **32/45** |

---

## 🏆 Recommendation

### Primary: **Option A — Teams SDK v2** (`@microsoft/teams.apps`)

**Rationale:**
1. **SSO is a first-class feature** — `signin()` / `signout()` built into every handler; OBO is still manual but the SSO token is trivially available
2. **Type-safe Adaptive Cards** — `@microsoft/teams.cards` with `AdaptiveCard`, `TextBlock`, etc. eliminates JSON hand-coding
3. **ChatPrompt for AI** — built-in conversation history, tool/function calling, Azure OpenAI integration
4. **Automatic AI enhancements** — AI label, citations, feedback buttons handled by the framework
5. **Explicit Copilot support** — the SDK was designed with `copilotAgents.customEngineAgents` in mind
6. **Microsoft's forward bet** — Teams AI Library v1 is deprecated, v2 is the successor. BotBuilder is in maintenance mode
7. **A2A + MCP support** — future-proof with Agent-to-Agent and Model Context Protocol plugins

**Risks to mitigate:**
- New SDK — verify specific features work in production before committing
- Migration from current botbuilder code requires rewriting bot handler (not a port, a rewrite)
- No official SSO + AI Search + Copilot sample exists — we'd be pioneering this combination

### Fallback: **Option C — Raw Botbuilder** (enhanced with M365 Agents SDK packages)

If Teams SDK v2 proves too immature for production:
- Keep current botbuilder-based bot
- Add SSO via `TeamsBotSsoPrompt` dialog pattern (from `bot-sso` sample)
- Add Adaptive Cards via JSON + `adaptivecards-templating`
- Add citations/AI labels via raw entity construction
- Add conversation state via `ConversationState` + `MemoryStorage`
- Consider migrating to `@microsoft/agents-hosting` (the M365 Agents SDK) which is the runtime underneath Teams SDK v2

### Eliminated: **Option B — Semantic Kernel JS**

Not viable for TypeScript in March 2026. SK is excellent for C#, but the JS/TS story is too immature:
- No GA JS/TS package
- No AI Search connector for JS
- No bot hosting — needs to be paired with BotBuilder or M365 Agents SDK anyway
- The Copilot Camp BAF labs (which use SK) are all C# only

---

## Implementation Plan (Teams SDK v2)

### Phase 1: Core Bot + SSO
```
@microsoft/teams.apps        — App framework, routing, OAuth/SSO
@microsoft/teams.cards        — Adaptive Card builder
@microsoft/teams.ai           — ChatPrompt, AI model integration
@azure/identity               — OnBehalfOfCredential for OBO
@azure/search-documents       — AI Search hybrid queries
```

### Phase 2: AI Search + Query Rewriting
- Port `search-service.ts` (existing implementation, framework-agnostic)
- Register as tool/function in ChatPrompt
- Add OBO token injection for per-user RBAC

### Phase 3: Rich UI
- AI-labeled responses with citations (entity format)
- Adaptive Card result cards with document previews
- Feedback buttons
- Typing indicators + "Searching..." progress

### Phase 4: Deploy + Publish
- Container App deployment (reuse existing infra)
- Manifest v1.22 with `copilotAgents.customEngineAgents`
- Sideload to M365 Copilot + Teams

---

## Key URLs

| Resource | URL |
|---|---|
| Teams SDK v2 docs | https://microsoft.github.io/teams-ai/ |
| Teams SDK v2 repo | https://github.com/microsoft/teams-sdk |
| Teams SDK v2 TypeScript packages | https://github.com/microsoft/teams-sdk/tree/main/teams.ts/packages |
| M365 Agents Toolkit Samples | https://github.com/OfficeDev/microsoft-365-agents-toolkit-samples |
| Copilot Camp — Custom Engine | https://microsoft.github.io/copilot-camp/pages/custom-engine/ |
| Copilot Camp — BAF labs (AI Search) | https://microsoft.github.io/copilot-camp/pages/custom-engine/agent-framework/ |
| Bot SSO sample (TypeScript) | https://github.com/OfficeDev/microsoft-365-agents-toolkit-samples/tree/main/bot-sso |
| ProxyAgent (TypeScript + SSO + Copilot) | https://github.com/OfficeDev/microsoft-365-agents-toolkit-samples/tree/main/ProxyAgent-NodeJS |
| AI-generated content (citations) docs | https://learn.microsoft.com/en-us/microsoftteams/platform/bots/how-to/bot-messages-ai-generated-content |
| Custom engine agents overview | https://learn.microsoft.com/en-us/microsoft-365-copilot/extensibility/overview-custom-engine-agent |
| Streaming UX in bots | https://learn.microsoft.com/en-us/microsoftteams/platform/bots/streaming-ux |

---

## Disambiguation: SDK Naming (March 2026)

The Microsoft bot SDK ecosystem has confusing naming. Here's the current state:

| Name | Package | Status | Notes |
|---|---|---|---|
| **BotBuilder v4** | `botbuilder` | Maintenance mode | Legacy, still works |
| **Teams AI Library v1** | `@microsoft/teams-ai` | **Deprecated** | Was built ON TOP of BotBuilder |
| **Teams SDK v2** | `@microsoft/teams.apps`, `@microsoft/teams.ai`, `@microsoft/teams.cards` | **GA** | Complete rewrite, NOT based on BotBuilder |
| **M365 Agents SDK** | `@microsoft/agents-hosting`, `@microsoft/agents-hosting-teams` | **GA** | Runtime layer; Teams SDK v2 uses this internally |
| **Semantic Kernel** | `@microsoft/semantic-kernel` (JS) | Preview | AI orchestration only, needs host |

**Important:** Teams SDK v2 is NOT "Teams AI Library v2" — it's a complete rewrite from scratch with different package names, APIs, and architecture. It does NOT depend on BotBuilder.
