import { ActivityHandler, TurnContext } from "botbuilder";
import { SearchService } from "./search-service";
import type { SearchResultWithCitation } from "./types";

export class SearchAgentBot extends ActivityHandler {
  private searchService: SearchService;

  constructor() {
    super();
    this.searchService = new SearchService();

    this.onMessage(async (context: TurnContext, next) => {
      const query = context.activity.text?.trim();
      if (!query) {
        await context.sendActivity("Please enter a search query.");
        await next();
        return;
      }

      await context.sendActivity({ type: "typing" });

      try {
        // Smart search: query rewriting + hybrid search + deduplication
        const results = await this.searchService.smartSearch(query, { top: 5 });

        if (results.length === 0) {
          await context.sendActivity(
            "No relevant documents found. Try rephrasing your query or using different keywords."
          );
          await next();
          return;
        }

        // Generate RAG answer with citations
        const answer = await this.searchService.generateAnswer(query, results);

        // Build response with citations
        const citationList = results.map((r, i) =>
          `[${i + 1}] **${r.citation.sourceTitle || r.citation.title}**${r.citation.sourceUrl ? ` — [Open](${r.citation.sourceUrl})` : ""}`
        ).join("\n");

        const response = `${answer}\n\n---\n**Sources:**\n${citationList}`;
        await context.sendActivity(response);
      } catch (error: any) {
        console.error("Search error:", error);
        await context.sendActivity(
          `An error occurred while searching: ${error.message || "Unknown error"}. Please try again.`
        );
      }

      await next();
    });

    this.onMembersAdded(async (context, next) => {
      for (const member of context.activity.membersAdded || []) {
        if (member.id !== context.activity.recipient.id) {
          await context.sendActivity(
            "👋 Hello! I'm the Enterprise Document Search Agent. Ask me anything about your organization's documents — policies, guidelines, project documentation, and more.\n\nI use advanced hybrid search with semantic reranking and query rewriting for the best results."
          );
        }
      }
      await next();
    });
  }
}
