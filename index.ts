import { createGroq } from "@ai-sdk/groq";
import { Agent } from "@xmtp/agent-sdk";
import { getTestUrl } from "@xmtp/agent-sdk/debug";
import {
  AttachmentCodec,
  ContentTypeRemoteAttachment,
  RemoteAttachmentCodec
} from "@xmtp/content-type-remote-attachment";
import {
  ContentTypeWalletSendCalls,
  WalletSendCallsCodec,
} from "@xmtp/content-type-wallet-send-calls";
import { generateText, stepCountIs } from "ai";
import "dotenv/config";
import { getCryptoPriceTool } from "./tools/crypto-price.js";
import { getWebAppLinkTool } from "./tools/web-app-link.js";
import { getGenerateInvoiceTool } from "./tools/generate-invoice.js";
import {
  ActionBuilder,
  inlineActionsMiddleware,
  registerAction
} from "./utils/inline-actions/inline-actions.js";
import { ActionsCodec } from "./utils/inline-actions/types/ActionsContent.js";
import { IntentCodec } from "./utils/inline-actions/types/IntentContent.js";
import { USDCHandler } from "./utils/usdc.js";

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
  env: process.env.XMTP_ENV as "local" | "dev" | "production",
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
        generateInvoice: getGenerateInvoiceTool,
      },
      stopWhen: stepCountIs(5), // Allow up to 5 steps for multi-step reasoning
      system:
        "You are a helpful small business assistant that helps clients make payments to freelancers easily. " +
        "You can help with checking cryptocurrency prices for payments using the getCryptoPrice tool. " +
        "When users ask about the web app, mini app, or opening the app, use the getWebAppLink tool to provide them with the link. " +
        "When users ask to generate, create, or send an invoice, use the generateInvoice tool. " +
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

    // Check if invoice was generated and send the remote attachment
    const invoiceToolCall = toolCalls.find((tc) => tc.toolName === "generateInvoice");
    if (invoiceToolCall) {
      console.log("Invoice generated, sending remote attachment...");
      
      // Construct RemoteAttachment
      const remoteAttachment = {
        url: "https://b891d14d436694bb9a7feeba91730b95.ipfscdn.io/ipfs/QmYxTz1anYunf5bdcH2mbKUqEJVVwTBQetikLC7QKCng6g",
        contentDigest: "fe971730028e05d8debdb5cdb09d1fb1a744cd7623031f97ddeb43e9b9f59a80",
        salt: new Uint8Array([249,253,253,160,166,33,141,85,1,207,14,232,102,217,169,110,45,66,108,235,237,6,52,120,74,197,75,239,130,8,19,247]),
        nonce: new Uint8Array([96,65,200,188,87,43,87,243,112,53,250,239]),
        secret: new Uint8Array([245,208,53,70,99,7,243,2,172,118,214,74,216,34,111,5,254,186,78,197,174,110,126,175,192,118,204,169,39,184,1,182]),
        scheme: "https" as const,
        contentLength: 125441,
        filename: "B2F74090-9740-4CF9-8F38-AB50A9F6261C.png"
      };

      await ctx.conversation.send(remoteAttachment, ContentTypeRemoteAttachment);
      console.log(`Remote attachment sent for invoice`);
    }
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
  console.log(`Received attachment from ${senderAddress}`);
  
  // Handle attachments as needed
  await ctx.sendText("📎 Attachment received!");
});

agent.on("start", () => {
  console.log(`Waiting for messages...`);
  console.log(`Address: ${agent.address}`);
  console.log(`🔗${getTestUrl(agent.client)}`);
});

void agent.start();
