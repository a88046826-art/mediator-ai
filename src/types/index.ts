export interface TeamMember {
  id: string;
  name: string;
}

export interface Message {
  id: string;
  role: 'ai' | 'user';
  content: string;
  timestamp: string;
  isAlert?: boolean;
}

export interface TranscriptEntry {
  id: string;
  text: string;
  time: string;
  speaker?: string;
}

export interface MeetingRecord {
  id: string;
  date: string;
  topic: string;
  teamSummary: string;
  transcript: TranscriptEntry[];
  aiMessages: Message[];
}
