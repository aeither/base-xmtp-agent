import { tool } from "ai";
import { z } from "zod";

/**
 * Tool for providing the web app/mini app link
 */
export const getWebAppLinkTool = tool({
  description:
    "Get the link to the web app, mini app, or open the app. Use this when users ask about accessing the web application, mini app, or want to open the app.",
  inputSchema: z.object({
    appType: z
      .string()
      .optional()
      .describe("The type of app requested (e.g., 'web app', 'mini app', 'app')"),
  }),
  execute: async ({ appType }) => {
    const appLink = "https://ethrome2025.vercel.app/";

    return {
      link: appLink,
      message: `Here's the link to access the app: ${appLink}`,
      appType: appType || "web app",
    };
  },
});
