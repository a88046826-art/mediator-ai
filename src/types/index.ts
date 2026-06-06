export type CodeType = 'D' | 'O' | 'C' | 'E';

export interface Question {
  id: number;
  code: CodeType;
  text: string;
  sub: string;
}

export interface TypeResult {
  name: string;
  desc: string;
  strengths: string[];
  weaknesses: string[];
  tip: string;
}

export interface TeamMember {
  id: string;
  name: string;
  code: string; // single (D) or combined (DC, OE, etc.)
}

export interface TestResult {
  scores: Record<CodeType, number>;
  primary: CodeType;
  secondary: CodeType;
  typeKey: string;
  type: TypeResult;
}

export interface Message {
  id: string;
  role: 'ai' | 'user';
  content: string;
  timestamp: string;
  isAlert?: boolean;
}
