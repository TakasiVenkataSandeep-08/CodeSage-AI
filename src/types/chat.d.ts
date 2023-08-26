export = Chats;
export as namespace Chats;

declare namespace Chats {
  export interface ChatMessage {
    id: string;
    message: string;
    type: string;
    title: string;
  }
  export interface ChatData {
    title: string;
    messages: Array<ChatMessage>;
    createdAt: Date;
  }
  export interface ChatHistory {
    [key: string]: ChatData;
  }
  export interface CustomPrompts {
    [key: string]: { title: string; prompt: string };
  }
}
