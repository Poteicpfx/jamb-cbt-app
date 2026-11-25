export type UserRole = 'student' | 'admin';
export type OptionKey = 'A' | 'B' | 'C' | 'D';
export type QuestionType = 'past' | 'practice';
export type ExamMode = 'mock' | 'practice' | 'past_question';
export type SyncStatus = 'pending' | 'synced';

export interface UserProfile {
  id: string;
  full_name: string;
  role: UserRole;
  target_score: number;
  selected_subjects: string[];
  created_at: string;
  updated_at: string;
}

export interface Subject {
  id: string;
  code: string;
  name: string;
  is_mandatory: boolean;
  default_exam_count: number;
  is_active: boolean;
  downloaded_version?: number;
  last_synced_at?: string;
}

export interface Topic {
  id: string;
  subject_id: string;
  name: string;
}

export interface Passage {
  id: string;
  subject_id: string;
  title: string;
  content: string;
  exam_year?: number | null;
}

export interface QuestionOption {
  key: OptionKey;
  text: string;
}

export interface Question {
  id: string;
  subject_id: string;
  topic_id?: string | null;
  passage_id?: string | null;
  exam_year?: number | null;
  question_type: QuestionType;
  stem: string;
  image_url?: string | null;
  options: QuestionOption[];
  correct_option: OptionKey;
  explanation: string;
  is_published: boolean;
  version: number;
  updated_at: string;
}

export interface AttemptAnswerRecord {
  question_id: string;
  subject_id: string;
  selected_option: OptionKey | null;
  is_correct: boolean;
  time_spent_seconds: number;
}

export interface ExamAttemptRecord {
  client_attempt_id: string;
  user_id: string;
  mode: ExamMode;
  subject_ids: string[];
  total_questions: number;
  score: number;
  jamb_scaled_score: number | null;
  duration_seconds: number;
  started_at: string;
  completed_at: string;
  answers: AttemptAnswerRecord[];
  sync_status: SyncStatus;
}

export interface ActiveExamSession {
  id: string;
  mode: ExamMode;
  subject_ids: string[];
  question_ids: string[];
  answers: Record<string, OptionKey>;
  flagged_ids: string[];
  current_index: number;
  started_at: string;
  end_timestamp: number;
}
