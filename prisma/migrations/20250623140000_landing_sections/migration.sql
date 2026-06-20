-- Landing section descriptions editable by authors (publication, methods, tools, wellness)
CREATE TABLE "LandingSection" (
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "points" TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LandingSection_pkey" PRIMARY KEY ("slug")
);

INSERT INTO "LandingSection" ("slug", "description", "points", "updatedAt") VALUES
(
  'publication',
  'Научные статьи, диссертации, рецензирование — разберём весь путь от идеи до публикации в рецензируемом издании.',
  ARRAY[
    'Структура и оформление научной работы',
    'Выбор журнала и подготовка рукописи',
    'Работа с рецензиями и этика публикаций'
  ],
  CURRENT_TIMESTAMP
),
(
  'methods',
  'Количественные и качественные подходы, дизайн исследования, сбор и анализ данных — с понятными примерами из реальных проектов.',
  ARRAY[
    'Качественные и количественные методы',
    'Опросы, интервью, кейс-стади',
    'Валидность, надёжность и этика исследования'
  ],
  CURRENT_TIMESTAMP
),
(
  'tools',
  'Программы и сервисы, которые экономят время: от управления литературой до статистического анализа.',
  ARRAY[
    'Zotero, Mendeley и работа с источниками',
    'SPSS, R и основы статистики',
    'Визуализация данных и презентация результатов'
  ],
  CURRENT_TIMESTAMP
),
(
  'wellness',
  'Исследование — марафон, а не спринт. Учимся сохранять баланс, мотивацию и устойчивость в академической среде.',
  ARRAY[
    'Профилактика выгорания и стресс-менеджмент',
    'Тайм-менеджмент для исследователя',
    'Построение поддерживающего академического окружения'
  ],
  CURRENT_TIMESTAMP
);
