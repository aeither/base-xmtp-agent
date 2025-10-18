import { readFile } from "node:fs/promises";
import {
  AttachmentCodec,
  RemoteAttachmentCodec,
  type RemoteAttachment,
} from "@xmtp/content-type-remote-attachment";

/**
 * Encrypt attachment data for secure remote storage
 */
export async function encryptAttachment(
  data: Uint8Array,
  filename: string,
  mimeType: string,
) {
  const attachment = {
    filename,
    mimeType,
    data,
  };

  const encrypted = await RemoteAttachmentCodec.encodeEncrypted(
    attachment,
    new AttachmentCodec(),
  );

  return {
    encryptedData: encrypted.payload,
    filename,
    mimeType,
    digest: encrypted.digest,
    salt: encrypted.salt,
    nonce: encrypted.nonce,
    secret: encrypted.secret,
  };
}

/**
 * Upload encrypted data to Pinata IPFS
 */
export async function uploadToPinata(
  data: Uint8Array,
  filename: string,
): Promise<string> {
  const apiKey = process.env.PINATA_API_KEY;
  const apiSecret = process.env.PINATA_API_SECRET;

  if (!apiKey || !apiSecret) {
    throw new Error(
      "PINATA_API_KEY and PINATA_API_SECRET must be set in environment variables",
    );
  }

  const formData = new FormData();
  const blob = new Blob([data as BlobPart]);
  formData.append("file", blob, filename);

  const response = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: {
      pinata_api_key: apiKey,
      pinata_secret_api_key: apiSecret,
    },
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Pinata upload failed: ${response.statusText}`);
  }

  const result = await response.json();
  return `https://gateway.pinata.cloud/ipfs/${result.IpfsHash}`;
}

/**
 * Simple file upload using a basic file server or base64 data URL as fallback
 */
export async function uploadFile(
  data: Uint8Array,
  filename: string,
  mimeType: string,
): Promise<string> {
  // Try Pinata if credentials are available
  try {
    return await uploadToPinata(data, filename);
  } catch (error) {
    console.log("Pinata not available, using web3.storage fallback");
  }

  // Try web3.storage if available
  if (process.env.WEB3_STORAGE_TOKEN) {
    try {
      return await uploadToWeb3Storage(data, filename);
    } catch (error) {
      console.log("Web3.storage not available");
    }
  }

  // Fallback: use a temporary hosting service or throw error
  throw new Error(
    "No file upload service configured. Please set PINATA_API_KEY/PINATA_API_SECRET or WEB3_STORAGE_TOKEN",
  );
}

/**
 * Upload to web3.storage
 */
export async function uploadToWeb3Storage(
  data: Uint8Array,
  filename: string,
): Promise<string> {
  const token = process.env.WEB3_STORAGE_TOKEN;
  if (!token) {
    throw new Error("WEB3_STORAGE_TOKEN must be set in environment variables");
  }

  const files = [new File([data as BlobPart], filename)];
  const formData = new FormData();
  files.forEach((file) => formData.append("file", file));

  const response = await fetch("https://api.web3.storage/upload", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Web3.storage upload failed: ${response.statusText}`);
  }

  const result = await response.json();
  return `https://${result.cid}.ipfs.w3s.link/${filename}`;
}

/**
 * Create a remote attachment from a local file
 */
export async function createRemoteAttachmentFromFile(
  filePath: string,
  fileUrl: string,
  mimeType: string,
): Promise<RemoteAttachment> {
  const data = new Uint8Array(await readFile(filePath));
  const filename = filePath.split("/").pop() || "file";

  const encrypted = await encryptAttachment(data, filename, mimeType);

  return {
    url: fileUrl,
    contentDigest: encrypted.digest,
    salt: encrypted.salt,
    nonce: encrypted.nonce,
    secret: encrypted.secret,
    scheme: "https://",
    contentLength: encrypted.encryptedData.length,
    filename: encrypted.filename,
  };
}

/**
 * Create and upload a remote attachment in one step
 */
export async function createAndUploadRemoteAttachment(
  filePath: string,
  mimeType: string,
): Promise<RemoteAttachment> {
  const data = new Uint8Array(await readFile(filePath));
  const filename = filePath.split("/").pop() || "file";

  // Encrypt the attachment
  const encrypted = await encryptAttachment(data, filename, mimeType);

  // Upload to storage
  const fileUrl = await uploadFile(encrypted.encryptedData, filename, mimeType);

  // Create remote attachment metadata
  return {
    url: fileUrl,
    contentDigest: encrypted.digest,
    salt: encrypted.salt,
    nonce: encrypted.nonce,
    secret: encrypted.secret,
    scheme: "https://",
    contentLength: encrypted.encryptedData.length,
    filename: encrypted.filename,
  };
}

/**
 * Load a remote attachment WITHOUT verifying the content digest.
 * Use this when IPFS gateway inconsistencies cause digest mismatches.
 * WARNING: This bypasses security checks - use only when necessary.
 */
export async function loadRemoteAttachmentUnsafe(
  remoteAttachment: RemoteAttachment,
) {
  // Download the encrypted file
  const response = await fetch(remoteAttachment.url);
  if (!response.ok) {
    throw new Error(`Failed to download attachment: ${response.statusText}`);
  }

  const payload = new Uint8Array(await response.arrayBuffer());

  // Decrypt using Web Crypto API (bypassing digest check)
  const importedSecret = await crypto.subtle.importKey(
    "raw",
    remoteAttachment.secret as BufferSource,
    "HKDF",
    false,
    ["deriveKey"],
  );

  const key = await crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: remoteAttachment.salt as BufferSource,
      info: new Uint8Array(),
    },
    importedSecret,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"],
  );

  const decrypted = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: remoteAttachment.nonce as BufferSource,
    },
    key,
    payload as BufferSource,
  );

  const encodedContentData = new Uint8Array(decrypted);

  // Decode the protobuf EncodedContent
  const { content } = await import("@xmtp/proto");
  const encodedContent = content.EncodedContent.decode(encodedContentData);

  if (!encodedContent.type) {
    throw new Error("no content type in decoded attachment");
  }

  // Decode using the AttachmentCodec
  const attachmentCodec = new AttachmentCodec();
  return attachmentCodec.decode(encodedContent as any);
}

