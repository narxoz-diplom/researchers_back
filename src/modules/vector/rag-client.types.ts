export type VectorCleanupEventType =
  | 'COURSE_DELETED'
  | 'LESSON_DELETED'
  | 'MEDIA_DELETED';

export interface RagVectorCleanupRequest {
  eventType: VectorCleanupEventType;
  courseId: string;
  lessonId?: string;
  fileId?: string;
  collectionName?: string;
}

export interface RagVectorCleanupResponse {
  status: string;
  request_id?: string | null;
}

export interface RagLlmUsageInfo {
  llm_model_id: string;
  provider: string;
  provider_model_id: string;
  provider_request_id?: string | null;
  finish_reason?: string | null;
  input_tokens?: number | null;
  output_tokens?: number | null;
  cached_tokens?: number | null;
  reasoning_tokens?: number | null;
  total_tokens?: number | null;
  usage_source?: string;
  attempt_number?: number;
  requested_model_id?: string | null;
  used_fallback?: boolean;
  fallback_from_model_id?: string | null;
}

export interface RagGenerateSingleLessonRequest {
  collection_name: string;
  title: string;
  summary?: string;
  lesson_index?: number;
  total_lessons?: number;
  top_k?: number;
  llm_model_id?: string;
  gemini_api_key?: string;
  metadata_filter?: {
    course_id: string;
    lesson_id: string;
  };
  params?: {
    teacher_brief?: string;
    target_audience?: string;
    depth?: string;
    output_format?: string;
    generation_phase?: string;
    approved_outline?: string;
    retrieval_mode?: string;
    retrieval_query?: string;
    output_language?: string;
  };
  callback_url?: string;
}

export interface RagLessonItem {
  title: string;
  content: string;
  order?: number;
}

export interface RagGenerateSingleLessonResponse {
  lessons: RagLessonItem[];
  collection_name: string;
  chunks_used: number;
  request_id?: string | null;
  usage?: RagLlmUsageInfo | null;
}

export interface RagAskRequest {
  question: string;
  collection_name: string;
  metadata_filter: {
    lesson_id: string;
    course_id: string;
  };
  top_k?: number;
  gemini_api_key?: string;
}

export interface RagAskResponse {
  answer: string;
  collection_name: string;
  chunks_used: number;
  request_id?: string | null;
  usage?: RagLlmUsageInfo | null;
}

export interface RagVectorizeTextRequest {
  text: string;
  collection_name: string;
  metadata: {
    course_id: string;
    lesson_id: string;
    content_type: string;
  };
  callback_url?: string;
  gemini_api_key?: string;
}

export interface RagVectorizeTextResponse {
  document_id: string;
  chunks_count: number;
  collection_name: string;
  status: string;
  request_id?: string | null;
}

export interface RagIngestResponse {
  document_id: string;
  chunks_count: number;
  collection_name: string;
  status: string;
  request_id?: string | null;
}

export interface RagAsyncTaskResponse {
  task_id: string;
  status: string;
  request_id?: string | null;
}

export interface RagIngestFileInput {
  buffer: Buffer;
  filename: string;
  metadata: Record<string, string>;
  collectionName: string;
  callbackUrl?: string;
  geminiApiKey?: string;
}
