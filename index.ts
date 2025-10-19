import "dotenv/config";
import { Agent } from "@xmtp/agent-sdk";
import { getTestUrl } from "@xmtp/agent-sdk/debug";
import { createGroq } from "@ai-sdk/groq";
import { generateText, stepCountIs } from "ai";
import { getCryptoPriceTool } from "./tools/crypto-price.js";
import {
  AttachmentCodec,
  ContentTypeRemoteAttachment,
  RemoteAttachmentCodec,
  type Attachment,
} from "@xmtp/content-type-remote-attachment";
import { loadRemoteAttachment } from "./utils/atttachment.js";

/* Initialize the Groq client */
const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

const agent = await Agent.createFromEnv({
  codecs: [new AttachmentCodec(), new RemoteAttachmentCodec()],
});

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

agent.on("attachment", async (ctx) => {
  const senderAddress = await ctx.getSenderAddress();
  const remoteAttachment = ctx.message.content;

  console.log(`Received remote attachment from ${senderAddress}`);
  console.log(`Filename: ${remoteAttachment.filename}`);
  console.log(`URL: ${remoteAttachment.url}`);

  try {
    // Check if it's an image file
    const isImage = remoteAttachment.filename?.match(/\.(jpg|jpeg|png|gif|webp)$/i);

    if (isImage) {
      console.log("Processing image with vision model...");

      const attachment = await loadRemoteAttachment(
        ctx.message.content,
        agent.client,
      ) as Attachment;

      console.log(`Attachment: ${attachment.filename}`);
      console.log(`Attachment size: ${attachment.data.length} bytes`);
      console.log(`Attachment data: ${Buffer.from(attachment.data).toString("base64")}`);

      // Use Groq vision model to analyze the image
      const { text } = await generateText({
        model: groq("meta-llama/llama-4-scout-17b-16e-instruct"),
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "What do you see in this image? Please describe it in detail." },
              { type: "image", image: Buffer.from(attachment.data).toString("base64") },
            ],
          },
        ],
        providerOptions: {
          gateway: {
            order: ["groq"], // Use Groq as first option
          },
        },
      });

      console.log(`Vision AI response: ${text}`);
      await ctx.sendText(text);
    } else {
      // For non-image attachments, just echo back
      await ctx.conversation.send(remoteAttachment, ContentTypeRemoteAttachment);
      console.log(`✅ Echoed attachment back: ${remoteAttachment.filename}`);
    }
  } catch (error) {
    console.error("Error processing attachment:", error);
    await ctx.sendText(
      `❌ Error processing attachment: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
});

agent.on("start", () => {
  console.log(`Waiting for messages...`);
  console.log(`Address: ${agent.address}`);
  console.log(`🔗${getTestUrl(agent.client)}`);
});

void agent.start();
