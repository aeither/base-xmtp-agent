import "dotenv/config";
import { Agent } from "@xmtp/agent-sdk";
import { getTestUrl } from "@xmtp/agent-sdk/debug";
import { createGroq } from "@ai-sdk/groq";
import { generateText, stepCountIs } from "ai";
import { getCryptoPriceTool } from "./tools/crypto-price.js";

/* Initialize the Groq client */
const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

const agent = await Agent.createFromEnv({});

agent.on("text", async (ctx) => {
  const messageContent = ctx.message.content;
  const senderAddress = await ctx.getSenderAddress();
  console.log(`Received message: ${messageContent} by ${senderAddress}`);

  try {
    /* Get the AI response from Groq with tool calling */
    const { text, toolCalls, steps } = await generateText({
      model: groq("llama-3.3-70b-versatile"),
      tools: {
        getCryptoPrice: getCryptoPriceTool,
      },
      stopWhen: stepCountIs(5), // Allow up to 5 steps for multi-step reasoning
      system:
        "You are a helpful crypto assistant. When users ask about cryptocurrency prices, use the getCryptoPrice tool. " +
        "Common coin IDs: bitcoin, ethereum, solana, cardano, polkadot, avalanche-2, chainlink, uniswap. " +
        "Always provide context and format prices nicely in your response.",
      messages: [{ role: "user", content: messageContent }],
    });

    console.log(`AI generated ${steps.length} step(s)`);
    if (toolCalls.length > 0) {
      console.log(
        `Tool calls made: ${toolCalls.map((tc) => tc.toolName).join(", ")}`,
      );
    }

    console.log(`Sending AI response: ${text}`);
    /* Send the AI response to the conversation */
    await ctx.sendText(text);
  } catch (error) {
    console.error("Error getting AI response:", error);
    await ctx.sendText(
      "Sorry, I encountered an error processing your message.",
    );
  }
});

agent.on("start", () => {
  console.log(`Waiting for messages...`);
  console.log(`Address: ${agent.address}`);
  console.log(`🔗${getTestUrl(agent.client)}`);
});

void agent.start();
