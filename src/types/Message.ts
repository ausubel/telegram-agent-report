export interface Message {
  id: string;
  uuid: string;
  sender_id: string;
  receiver_id: string;
  message_content: string | null;
  created_at: string;
}

export interface MessageStats {
  totalMessages: number;
  uniqueUsers: number;
  averageResponseTime: number;
  messagesByHour: Record<string, number>;
}
