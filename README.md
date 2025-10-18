# XMTP Agent with Groq AI

An XMTP agent powered by Groq's LLM API that provides intelligent responses with tool calling capabilities. This agent can answer questions about cryptocurrency prices, handle file attachments, and send photos on request.

![](./screenshot.png)

## Features

- 🤖 **AI-powered responses** using Groq's Llama model
- 💰 **Cryptocurrency price lookup** via CoinGecko API
- 📎 **File attachment handling** - receive and process attachments
- 📸 **Photo sharing** - send photos when users include `@photo` in their message
- 🔐 **End-to-end encrypted attachments** using XMTP remote attachment protocol

### Requirements

- Node.js v20 or higher
- pnpm v10 or higher

### Environment variables

To run your XMTP agent, you must create a `.env` file with the following variables:

**Required:**
```bash
XMTP_WALLET_KEY= # the private key of the wallet
XMTP_DB_ENCRYPTION_KEY= # a second random 32 bytes encryption key for local db encryption
XMTP_ENV=dev # local, dev, production
GROQ_API_KEY= # your Groq API key from https://console.groq.com
```

**Optional (for photo sharing feature):**

You need at least one of these storage services configured to use the `@photo` feature:

```bash
# Option 1: Pinata (IPFS)
PINATA_API_KEY= # your Pinata API key from https://pinata.cloud
PINATA_API_SECRET= # your Pinata API secret

# Option 2: Web3.Storage (IPFS)
WEB3_STORAGE_TOKEN= # your Web3.Storage token from https://web3.storage
```

### Run the agent locally

```bash
# clone the repository
git clone <your-repo-url>
# navigate to the folder
cd base-xmtp-agent
# install packages
pnpm install
# generate random xmtp keys (optional)
pnpm gen:keys
# run the agent
pnpm dev
```

### Usage

Once your agent is running, you can interact with it through XMTP:

**Ask about crypto prices:**
```
What's the price of bitcoin?
```

**Request a photo:**
```
Show me @photo
```
```
Can you send @photo?
```

**Send attachments:**
Send any file attachment to the agent, and it will:
- Download and decrypt it
- Extract the contents
- For text files, show a preview of the content

### Deploy to Railway

This project is configured for deployment on Railway:

1. Create a new project on [Railway](https://railway.app)
2. Connect your GitHub repository
3. Add the required environment variables in Railway's dashboard:
   - `XMTP_WALLET_KEY`
   - `XMTP_DB_ENCRYPTION_KEY`
   - `XMTP_ENV`
   - `GROQ_API_KEY`
   - Optional: `PINATA_API_KEY` and `PINATA_API_SECRET` or `WEB3_STORAGE_TOKEN`
4. Railway will automatically detect the build configuration and deploy

The agent uses `pnpm` as the package manager and will build using `pnpm build` and start with `pnpm start`.
