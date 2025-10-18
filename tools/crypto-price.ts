import { tool } from "ai";
import { z } from "zod";

/**
 * Tool for fetching cryptocurrency prices from CoinGecko API
 */
export const getCryptoPriceTool = tool({
  description:
    "Get the current price of a cryptocurrency in a specified currency. Supports major cryptocurrencies like BTC, ETH, SOL, etc.",
  inputSchema: z.object({
    coinId: z
      .string()
      .describe(
        "The CoinGecko coin ID (e.g., 'bitcoin', 'ethereum', 'solana')",
      ),
    currency: z
      .string()
      .default("usd")
      .describe("The target currency (e.g., 'usd', 'eur', 'gbp')"),
  }),
  execute: async ({ coinId, currency }) => {
    try {
      const response = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=${currency}&include_24hr_change=true&include_market_cap=true`,
      );

      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data[coinId]) {
        return {
          error: `Cryptocurrency '${coinId}' not found. Please use CoinGecko coin IDs (e.g., 'bitcoin', 'ethereum', 'solana')`,
        };
      }

      const priceData = data[coinId];
      const price = priceData[currency];
      const change24h = priceData[`${currency}_24h_change`];
      const marketCap = priceData[`${currency}_market_cap`];

      return {
        coin: coinId,
        currency: currency.toUpperCase(),
        price,
        change24h: change24h?.toFixed(2),
        marketCap,
        formattedPrice: `${currency.toUpperCase()} ${price.toLocaleString()}`,
      };
    } catch (error) {
      console.error("Error fetching crypto price:", error);
      return {
        error: `Failed to fetch price for ${coinId}: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  },
});
