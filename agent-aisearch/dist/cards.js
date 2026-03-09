"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildSearchResultsCard = buildSearchResultsCard;
exports.buildTextResponse = buildTextResponse;
/**
 * Build an Adaptive Card JSON for search results with document previews,
 * scores, and clickable links.
 */
function buildSearchResultsCard(query, answer, results) {
    const citationBlocks = results.map((r, i) => {
        const score = r.semanticScore
            ? `${(r.semanticScore * 100).toFixed(0)}%`
            : `${(r.score * 100).toFixed(0)}%`;
        const preview = r.captions?.[0] || r.content.substring(0, 200) + "...";
        const meta = [];
        if (r.citation.author)
            meta.push(`👤 ${r.citation.author}`);
        if (r.citation.department)
            meta.push(`🏢 ${r.citation.department}`);
        if (r.citation.documentVersion)
            meta.push(`v${r.citation.documentVersion}`);
        if (r.citation.lastModified) {
            const d = new Date(r.citation.lastModified);
            if (!isNaN(d.getTime()))
                meta.push(`📅 ${d.toLocaleDateString()}`);
        }
        return {
            type: "Container",
            separator: i > 0,
            spacing: "Medium",
            items: [
                {
                    type: "ColumnSet",
                    columns: [
                        {
                            type: "Column",
                            width: "stretch",
                            items: [
                                {
                                    type: "TextBlock",
                                    text: `[${i + 1}] **${r.citation.sourceTitle || r.citation.title}**`,
                                    wrap: true,
                                    weight: "Bolder",
                                    size: "Medium",
                                },
                            ],
                        },
                        {
                            type: "Column",
                            width: "auto",
                            items: [
                                {
                                    type: "TextBlock",
                                    text: `🎯 ${score}`,
                                    color: "Good",
                                    weight: "Bolder",
                                },
                            ],
                        },
                    ],
                },
                ...(meta.length > 0
                    ? [
                        {
                            type: "TextBlock",
                            text: meta.join(" · "),
                            size: "Small",
                            color: "Dark",
                            isSubtle: true,
                            wrap: true,
                        },
                    ]
                    : []),
                {
                    type: "TextBlock",
                    text: preview,
                    wrap: true,
                    size: "Small",
                    maxLines: 3,
                },
                ...(r.citation.sourceUrl
                    ? [
                        {
                            type: "ActionSet",
                            actions: [
                                {
                                    type: "Action.OpenUrl",
                                    title: "📄 Open Document",
                                    url: r.citation.sourceUrl,
                                },
                            ],
                        },
                    ]
                    : []),
            ],
        };
    });
    return {
        type: "AdaptiveCard",
        $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
        version: "1.5",
        body: [
            {
                type: "TextBlock",
                text: answer,
                wrap: true,
                size: "Default",
            },
            {
                type: "TextBlock",
                text: "📚 **Sources**",
                wrap: true,
                size: "Medium",
                weight: "Bolder",
                spacing: "Large",
                separator: true,
            },
            ...citationBlocks,
        ],
    };
}
/**
 * Build a simple text-only response with citations for environments
 * where Adaptive Cards may not render well.
 */
function buildTextResponse(answer, results) {
    const citations = results
        .map((r, i) => {
        const title = r.citation.sourceTitle || r.citation.title;
        const url = r.citation.sourceUrl;
        return url ? `[${i + 1}] **${title}** — [Open](${url})` : `[${i + 1}] **${title}**`;
    })
        .join("\n");
    return `${answer}\n\n---\n**📚 Sources:**\n${citations}`;
}
//# sourceMappingURL=cards.js.map