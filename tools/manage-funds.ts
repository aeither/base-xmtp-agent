import { tool } from "ai";
import { z } from "zod";
import { USDCHandler } from "../utils/usdc.js";

/**
 * Tool for managing funds - shows USDC balance and provides top-up options
 */
export const getManageFundsTool = tool({
  description:
    "Show the USDC balance for the group's fund management wallet (0xA830Cd34D83C10Ba3A8bB2F25ff8BBae9BcD0125) and provide top-up options. Use this when users want to manage funds, check the group's balance, or top up the group account.",
  inputSchema: z.object({
    // No input needed - the wallet address is fixed
  }),
  execute: async () => {
    try {
      // Fixed wallet address for fund management
      const fundWalletAddress = "0xA830Cd34D83C10Ba3A8bB2F25ff8BBae9BcD0125";

      // Initialize USDC handler for Base Mainnet
      const usdcHandler = new USDCHandler("base-mainnet");

      // Fetch the current USDC balance
      const balance = await usdcHandler.getUSDCBalance(fundWalletAddress);

      return {
        success: true,
        walletAddress: fundWalletAddress,
        balance,
        network: "Base Mainnet",
        formattedBalance: `${parseFloat(balance).toLocaleString()} USDC`,
        showTopUpAction: true, // Signal to show the top-up action button
      };
    } catch (error) {
      console.error("Error fetching fund balance:", error);
      return {
        success: false,
        error: `Failed to fetch balance: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  },
});
