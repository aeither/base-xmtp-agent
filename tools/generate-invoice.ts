import { tool } from "ai";
import { z } from "zod";

export const getGenerateInvoiceTool = tool({
  description: "Generate an invoice for a payment request. Use this when the user asks to create, generate, or send an invoice.",
  inputSchema: z.object({
    recipientName: z.string().describe("The name of the person or entity to receive the payment"),
    amount: z.number().describe("The amount in USDC to be invoiced"),
    notes: z.string().optional().describe("Optional notes or description for the invoice"),
  }),
  execute: async ({ recipientName, amount, notes }) => {
    return {
      success: true,
      recipientName,
      amount,
      notes: notes || "Payment invoice",
      message: `Invoice generated for ${recipientName} - ${amount} USDC`,
    };
  },
});

