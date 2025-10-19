import "dotenv/config";
import { Agent } from "@xmtp/agent-sdk";
import { getTestUrl } from "@xmtp/agent-sdk/debug";
import { createGroq } from "@ai-sdk/groq";
import { generateText, stepCountIs } from "ai";
import { getCryptoPriceTool } from "./tools/crypto-price.js";
import { getWebAppLinkTool } from "./tools/web-app-link.js";
import {
  AttachmentCodec,
  ContentTypeRemoteAttachment,
  RemoteAttachmentCodec,
  type Attachment,
} from "@xmtp/content-type-remote-attachment";
import { loadRemoteAttachment } from "./utils/atttachment.js";
import {
  WalletSendCallsCodec,
  ContentTypeWalletSendCalls,
} from "@xmtp/content-type-wallet-send-calls";
import { USDCHandler } from "./utils/usdc.js";
import {
  inlineActionsMiddleware,
  registerAction,
  ActionBuilder,
  sendActions,
} from "./utils/inline-actions/inline-actions.js";
import { ActionsCodec } from "./utils/inline-actions/types/ActionsContent.js";
import { IntentCodec } from "./utils/inline-actions/types/IntentContent.js";

/* Initialize the Groq client */
const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

/* Initialize USDC handler for Base Mainnet */
const usdcHandler = new USDCHandler("base-mainnet");
const networkConfig = usdcHandler.getNetworkConfig();

const agent = await Agent.createFromEnv({
  codecs: [
    new AttachmentCodec(),
    new RemoteAttachmentCodec(),
    new WalletSendCallsCodec(),
    new ActionsCodec(),
    new IntentCodec(),
  ],
});

/* Use the inline actions middleware */
agent.use(inlineActionsMiddleware);

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
        getWebAppLink: getWebAppLinkTool,
      },
      stopWhen: stepCountIs(5), // Allow up to 5 steps for multi-step reasoning
      system:
        "You are a helpful small business assistant that helps clients make payments to freelancers easily. " +
        "You can help with checking cryptocurrency prices for payments using the getCryptoPrice tool. " +
        "When users ask about the web app, mini app, or opening the app, use the getWebAppLink tool to provide them with the link. " +
        "Be professional, friendly, and focus on making the payment process simple and straightforward. " +
        "Be concise and to the point. " +
        "Provide clear instructions and helpful information about crypto payments when needed.",
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

/* Register payment action handler */
registerAction("pay-receipt", async (ctx) => {
  const senderAddress = await ctx.getSenderAddress();
  if (!senderAddress) return;

  // Extract payment details (in a real implementation, these would come from vision AI analysis)
  const recipientAddress = "0x2191433264B3E4F50439b3822323EC14448B192c";
  const amount = 0.01;
  const amountInDecimals = Math.floor(amount * Math.pow(10, networkConfig.decimals));

  // Create USDC transfer calls
  const transferCalls = usdcHandler.createUSDCTransferCalls(
    senderAddress,
    recipientAddress,
    amountInDecimals,
  );

  // Add rich metadata
  transferCalls.calls[0].metadata = {
    description: `Pay receipt: ${amount} USDC`,
    transactionType: "transfer",
    currency: "USDC",
    amount: amountInDecimals.toString(),
    decimals: networkConfig.decimals.toString(),
    networkId: networkConfig.networkId,
  };

  // Send the payment transaction
  await ctx.conversation.send(transferCalls, ContentTypeWalletSendCalls);
  await ctx.sendText(`💸 Please approve the ${amount} USDC payment to ${recipientAddress.slice(0, 6)}...${recipientAddress.slice(-4)} in your wallet!`);
});

agent.on("attachment", async (ctx) => {
  const senderAddress = await ctx.getSenderAddress();
  const remoteAttachment = ctx.message.content;

  console.log(`Received remote attachment from ${senderAddress}`);
  console.log(`Filename: ${remoteAttachment.filename}`);
  console.log(`URL: ${remoteAttachment.url}`);

  // Send analyzing message
  await ctx.sendText("🔍 Analyzing receipt...");

  // Wait 3 seconds before processing
  await new Promise(resolve => setTimeout(resolve, 3000));

  await ActionBuilder.create(
    "pay-receipt",
    "📄 Receipt Details:\n\n" +
    "👤 Receiver: 0x2191433264B3E4F50439b3822323EC14448B192c\n" +
    "💰 Amount: 0.01 USDC\n" +
    "📝 Notes: discord community management September"
  )
    .add("pay-receipt", "💸 Pay Now")
    .send(ctx);

});

agent.on("start", () => {
  console.log(`Waiting for messages...`);
  console.log(`Address: ${agent.address}`);
  console.log(`🔗${getTestUrl(agent.client)}`);
});

void agent.start();
