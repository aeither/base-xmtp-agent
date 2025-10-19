## Persist DB

RAILWAY_VOLUME_MOUNT_PATH="." # custom db path with persistent data volume (set to /app/data/ to deploy to railway)

## receive and prep for ai

  // Load and decode the received attachment
  const receivedAttachment = await loadRemoteAttachment(
    ctx.message.content,
    agent.client,
  );

  const pinataFileUrl = await uploadToPinata(
    receivedAttachment.data,
    receivedAttachment.filename,
  );
  console.log("File URL:", pinataFileUrl);

## file from ai to RemoteAttachment for sending back

// export const uploadAttachment = async (
//   file: File,
// ): Promise<RemoteAttachment> => {
//   // Convert file to array buffer for encryption
//   const arrayBuffer = await file.arrayBuffer();
//   const attachment = new Uint8Array(arrayBuffer);

//   // Use RemoteAttachmentCodec to encrypt the attachment
//   const attachmentData: Attachment = {
//     mimeType: file.type,
//     filename: file.name,
//     data: attachment,
//   };

//   const encryptedAttachment = await RemoteAttachmentCodec.encodeEncrypted(
//     attachmentData,
//     new AttachmentCodec(),
//   );

//   // Upload the encrypted payload to Pinata
//   const encryptedBlob = new Blob(
//     [encryptedAttachment.payload as Uint8Array<ArrayBuffer>],
//     {
//       type: "application/octet-stream",
//     },
//   );
//   const encryptedFile = new File([encryptedBlob], file.name, {
//     type: "application/octet-stream",
//   });

//   const presignedUrl = await getPresignedUrl();
//   const upload = await pinata.upload.public
//     .file(encryptedFile)
//     .url(presignedUrl);
//   const url = `https://${import.meta.env.VITE_PINATA_GATEWAY}/ipfs/${upload.cid}`;

//   // Return the RemoteAttachment with encryption metadata
//   return {
//     url,
//     contentDigest: encryptedAttachment.digest,
//     salt: encryptedAttachment.salt,
//     nonce: encryptedAttachment.nonce,
//     secret: encryptedAttachment.secret,
//     scheme: "https://",
//     contentLength: file.size,
//     filename: file.name,
//   };
// };

