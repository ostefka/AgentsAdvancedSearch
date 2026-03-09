"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.exchangeForSearchToken = exchangeForSearchToken;
const msal_node_1 = require("@azure/msal-node");
const msalConfig = {
    auth: {
        clientId: process.env.CLIENT_ID || "",
        clientSecret: process.env.CLIENT_SECRET || "",
        authority: `https://login.microsoftonline.com/${process.env.TENANT_ID || ""}`,
    },
};
let cca = null;
function getMsalClient() {
    if (!cca) {
        cca = new msal_node_1.ConfidentialClientApplication(msalConfig);
    }
    return cca;
}
/**
 * Exchange user SSO token for an AI Search-scoped token via OBO flow.
 */
async function exchangeForSearchToken(userToken) {
    const client = getMsalClient();
    const result = await client.acquireTokenOnBehalfOf({
        oboAssertion: userToken,
        scopes: ["https://search.azure.com/.default"],
    });
    if (!result?.accessToken) {
        throw new Error("OBO token exchange failed — no access token returned");
    }
    return result.accessToken;
}
//# sourceMappingURL=auth.js.map