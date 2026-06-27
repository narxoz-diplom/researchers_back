export const CHAT_MESSAGE_LIMIT_BASIC = 50;
export const CHAT_MESSAGE_LIMIT_PRO = 200;

export const DEFAULT_LLM_MODEL_ID = 'gemini-2.5-flash';
export const DEFAULT_PRO_LLM_MODEL_ID = 'gemini-2.5-pro';

export const LESSON_OUTPUT_FORMATS = [
  'structured',
  'lecture',
  'seminar',
  'expert_brief',
] as const;
export type LessonOutputFormat = (typeof LESSON_OUTPUT_FORMATS)[number];

export interface SelectableLlmModel {
  id: string;
  label: string;
  provider: 'google';
  recommendedForQuality?: boolean;
}

export const SELECTABLE_LLM_MODELS: SelectableLlmModel[] = [
  { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash', provider: 'google' },
  {
    id: 'gemini-3.1-pro-preview',
    label: 'Gemini 3.1 Pro',
    provider: 'google',
    recommendedForQuality: true,
  },
  {
    id: 'gemini-3.1-flash-lite',
    label: 'Gemini 3.1 Flash Lite',
    provider: 'google',
  },
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', provider: 'google' },
  {
    id: 'gemini-2.5-pro',
    label: 'Gemini 2.5 Pro',
    provider: 'google',
    recommendedForQuality: true,
  },
  {
    id: 'gemini-2.5-flash-lite',
    label: 'Gemini 2.5 Flash Lite',
    provider: 'google',
  },
];

export const SELECTABLE_LLM_MODEL_IDS = new Set(
  SELECTABLE_LLM_MODELS.map((model) => model.id),
);

export const LESSON_OUTPUT_LANGUAGES = ['ru', 'en', 'kz'] as const;
export type LessonOutputLanguage = (typeof LESSON_OUTPUT_LANGUAGES)[number];

export const LANGUAGE_INSTRUCTION: Record<LessonOutputLanguage, string> = {
  ru: 'Write the lesson in Russian (ru).',
  en: 'Write the lesson in English (en).',
  kz: 'Write the lesson in Kazakh (kz).',
};
