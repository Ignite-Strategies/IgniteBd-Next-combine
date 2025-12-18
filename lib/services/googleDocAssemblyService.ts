/**
 * Google Doc Assembly Service
 * 
 * Pure service for assembling blog content and executing Google Docs API calls.
 * No auth. No Prisma. No routing logic.
 */

import { google } from 'googleapis';

export type GoogleDocAssemblyInput = {
  title: string | null;
  subtitle?: string | null;
  body?: string | null;
  parentFolderId: string;
};

export type GoogleDocAssemblyResult = {
  documentId: string;
  documentUrl: string;
  textLength: number;
};

/**
 * Assemble blog content and create Google Doc
 * 
 * @param input - Blog content to assemble
 * @param authClient - Authenticated Google API client
 * @returns Result with document ID and URL
 * @throws Error if Google API calls fail
 */
export async function assembleAndCreateGoogleDoc(
  input: GoogleDocAssemblyInput,
  authClient: any, // google.auth.JWT
): Promise<GoogleDocAssemblyResult> {
  // 🧠 ASSEMBLY RULES: Build single string
  let documentText = '';
  
  // Title (or "Untitled Blog") + \n
  const documentTitle = input.title || 'Untitled Blog';
  documentText += documentTitle + '\n';
  
  // Subtitle (if present) + \n\n
  if (input.subtitle) {
    documentText += input.subtitle + '\n\n';
  } else {
    documentText += '\n';
  }
  
  // Body (if present)
  if (input.body) {
    // Normalize newlines (\r\n → \n)
    const normalizedBody = input.body.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    documentText += normalizedBody;
  }
  
  // Coerce to non-empty string (Google Docs rejects empty inserts)
  const safeText = documentText || ' ';
  
  // 🧪 OBSERVABILITY: Log what we're sending
  console.log('🧾 GoogleDocAssembly payload', {
    length: safeText.length,
    preview: safeText.slice(0, 200),
  });
  
  // Get Google API clients
  const drive = google.drive({ version: 'v3', auth: authClient });
  const docs = google.docs({ version: 'v1', auth: authClient });
  
  // 📄 DRIVE API: Create the document (minimum contract)
  const createResponse = await drive.files.create({
    requestBody: {
      name: documentTitle,
      mimeType: 'application/vnd.google-apps.document',
      parents: [input.parentFolderId],
    },
    supportsAllDrives: true,
    fields: 'id',
  });
  
  const documentId = createResponse.data.id;
  if (!documentId) {
    throw new Error('Failed to create document: No document ID returned');
  }
  
  // 📄 DOCS API: Insert text (single operation, no formatting)
  await docs.documents.batchUpdate({
    documentId,
    requestBody: {
      requests: [
        {
          insertText: {
            location: { index: 1 },
            text: safeText,
          },
        },
      ],
    },
  });
  
  // 🔁 OWNERSHIP TRANSFER: Move doc to human owner (fixes storage quota)
  const newOwnerEmail = process.env.GOOGLE_DOCS_OWNER_EMAIL;
  
  if (!newOwnerEmail) {
    throw new Error('GOOGLE_DOCS_OWNER_EMAIL is not configured');
  }
  
  console.log(`🔁 Transferring document ownership to ${newOwnerEmail}`);
  
  await drive.permissions.create({
    fileId: documentId,
    supportsAllDrives: true,
    transferOwnership: true,
    requestBody: {
      role: 'owner',
      type: 'user',
      emailAddress: newOwnerEmail,
    },
  });
  
  console.log('✅ Ownership transferred successfully');
  
  // 📤 RETURN VALUE: Clean success payload
  const documentUrl = `https://docs.google.com/document/d/${documentId}/edit`;
  
  return {
    documentId,
    documentUrl,
    textLength: safeText.length,
  };
}
