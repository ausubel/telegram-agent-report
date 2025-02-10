export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  message_content: string | null;
  created_at: string;
}

export interface MessageCount {
  sender_id: string;
  count: number;
}

export interface MedicalAnalytics {
  symptomCategories: { category: string; count: number }[];
  responseTime: number;
  totalConsultations: number;
  activeUsers: number;
  commonSymptoms: string[];
}

export interface TimeAnalytics {
  hour: number;
  consultations: number;
}