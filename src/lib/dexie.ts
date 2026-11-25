import Dexie, { type EntityTable } from 'dexie';
import type {
  ActiveExamSession,
  ExamAttemptRecord,
  Passage,
  Question,
  Subject,
  Topic,
} from '../types/exam.types';

export class JambCbtDatabase extends Dexie {
  subjects!: EntityTable<Subject, 'id'>;
  topics!: EntityTable<Topic, 'id'>;
  passages!: EntityTable<Passage, 'id'>;
  questions!: EntityTable<Question, 'id'>;
  activeSessions!: EntityTable<ActiveExamSession, 'id'>;
  examAttempts!: EntityTable<ExamAttemptRecord, 'client_attempt_id'>;

  constructor() {
    super('jamb_cbt_offline_db');

    this.version(1).stores({
      subjects: 'id, code, is_mandatory, downloaded_version',
      topics: 'id, subject_id, name',
      passages: 'id, subject_id, exam_year',
      questions: 'id, subject_id, topic_id, passage_id, exam_year, question_type, [subject_id+exam_year]',
      activeSessions: 'id',
      examAttempts: 'client_attempt_id, user_id, mode, sync_status, completed_at',
    });
  }
}

export const localDb = new JambCbtDatabase();
