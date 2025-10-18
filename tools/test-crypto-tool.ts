import "dotenv/config";
import { createGroq } from "@ai-sdk/groq";
import { generateText, stepCountIs } from "ai";
import { getCryptoPriceTool } from "./crypto-price.js";

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

console.log("Testing crypto price tool...\n");

const testQueries = [
  "What's the current price of Bitcoin?",
  "How much is ETH worth?",
  "Tell me the price of Solana in USD",
];

for (const query of testQueries) {
  console.log(`\nQuery: ${query}`);
  console.log("---");

  try {
    const { text, toolCalls, steps } = await generateText({
      model: groq("llama-3.3-70b-versatile"),
      tools: {
        getCryptoPrice: getCryptoPriceTool,
      },
      stopWhen: stepCountIs(5),
      system:
        "You are a helpful crypto assistant. When users ask about cryptocurrency prices, use the getCryptoPrice tool. " +
        "Common coin IDs: bitcoin, ethereum, solana, cardano, polkadot, avalanche-2, chainlink, uniswap. " +
        "Always provide context and format prices nicely in your response.",
      messages: [{ role: "user", content: query }],
    });

    console.log(`Steps: ${steps.length}`);
    if (toolCalls.length > 0) {
      console.log(
        `Tools called: ${toolCalls.map((tc) => tc.toolName).join(", ")}`,
      );
      console.log("Tool inputs:", JSON.stringify(toolCalls[0].input, null, 2));
    }
    console.log(`Response: ${text}`);
  } catch (error) {
    console.error("Error:", error);
  }
}

console.log("\n✅ Test complete!");
