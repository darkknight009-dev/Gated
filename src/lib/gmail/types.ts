export interface GmailHeader { name: string; value: string }
export interface GmailPart {
  partId?: string;
  mimeType?: string;
  filename?: string;
  headers?: GmailHeader[];
  body?: { attachmentId?: string; size?: number; data?: string };
  parts?: GmailPart[];
}
export interface GmailMessage {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  historyId?: string;
  internalDate?: string;
  sizeEstimate?: number;
  payload?: GmailPart;
}
export interface GmailListResponse { messages?: Array<{ id: string; threadId: string }>; nextPageToken?: string; resultSizeEstimate?: number }
export interface GmailHistoryResponse {
  history?: Array<{
    id: string;
    messagesAdded?: Array<{ message: { id: string; threadId: string } }>;
    messagesDeleted?: Array<{ message: { id: string; threadId: string } }>;
    labelsAdded?: Array<{ message: { id: string; threadId: string }; labelIds: string[] }>;
    labelsRemoved?: Array<{ message: { id: string; threadId: string }; labelIds: string[] }>;
  }>;
  nextPageToken?: string;
  historyId?: string;
}
