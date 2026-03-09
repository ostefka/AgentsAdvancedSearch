import { ConfidentialClientApplication } from "@azure/msal-node";

const msalConfig = {
  auth: {
    clientId: process.env.CLIENT_ID || "",
    clientSecret: process.env.CLIENT_SECRET || "",
    authority: `https://login.microsoftonline.com/${process.env.TENANT_ID || ""}`,
  },
};

let cca: ConfidentialClientApplication | null = null;

function getMsalClient(): ConfidentialClientApplication {
  if (!cca) {
    cca = new ConfidentialClientApplication(msalConfig);
  }
  return cca;
}

/**
 * Exchange user SSO token for an AI Search-scoped token via OBO flow.
 */
export async function exchangeForSearchToken(userToken: string): Promise<string> {
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
