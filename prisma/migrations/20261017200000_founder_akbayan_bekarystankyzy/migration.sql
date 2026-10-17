-- Data: Akbayan Bekarystankyzy on the "About us" block and her personal page (/founders/akbayan-bekarystankyzy).
-- Skipped when a founder with this name already exists, so it never overwrites admin edits.
INSERT INTO "Founder" ("id", "fullName", "position", "description", "videoUrl", "previewUrl", "profileUrl", "bio", "gallery", "orderNumber", "isPublished", "updatedAt")
SELECT
  'akbayan-bekarystankyzy',
  $txt$Ақбаян Бекарыстанқызы$txt$,
  $txt$PhD, Satbayev University қауымдастырылған профессоры$txt$,
  $txt$Сөйлеуді автоматты тану, табиғи тілді өңдеу (NLP) және машиналық оқыту саласының зерттеушісі. Narxoz University аға оқытушысы.$txt$,
  NULL,
  $txt$/images/founders/akbayan-bekarystankyzy/portrait.jpg$txt$,
  $txt$https://orcid.org/0000-0003-3984-2718$txt$,
  $txt$Ақбаян Бекарыстанқызы — PhD, Satbayev University қауымдастырылған профессоры, 2021 жылдан бері Narxoz University аға оқытушысы. ҚР ҒЖБМ Ғылым комитеті Ақпараттық және есептеуіш технологиялар институтының кіші ғылыми қызметкері.

2009 жылы Қазақстан-Британ техникалық университетін «Computer Science and Software Engineering» мамандығы бойынша бітіріп, 2010 жылы сол университетте «Ақпараттық жүйелер» мамандығы бойынша магистратураны аяқтады. 2020–2023 жылдары Satbayev University-де «Басқарудың ақпараттық жүйелері» (8D06103) мамандығы бойынша докторантурада оқып, «Агглютинативті тілдерде сөйлеуді автоматты танудың end-to-end жүйесін әзірлеу» тақырыбында PhD диссертациясын ағылшын тілінде қорғады. Ғылыми кеңесшілері — PhD О.Ж. Мамырбаев және PhD Матеус Мендес (Коимбра политехникалық университеті, Португалия).

Ғылыми қызығушылықтары — сөйлеуді автоматты тану, қазақ тіліне арналған табиғи тілді өңдеу, машиналық аударма, үлкен тілдік модельдер және машиналық оқыту. 2020–2022 жылдары Ақпараттық және есептеуіш технологиялар институтында «Агглютинативті тілдер үшін end-to-end сөйлеуді автоматты тану жүйесін әзірлеу» (AP08855743) гранттық жобасына қатысты. IEEE Access, Algorithms, Sustainability, Eastern-European Journal of Enterprise Technologies және басқа да журналдарда жарияланған мақалалардың, агглютинативті тілдерге арналған сөйлеуді тану жүйесі туралы ұжымдық монографияның (2022) авторы. «UniCodeKaz» бағдарламалық жасақтамасына авторлық куәлігі бар (2023).

Ғылыми профильдері: [ORCID](https://orcid.org/0000-0003-3984-2718) · [Google Scholar](https://scholar.google.com/citations?user=e6v4eTYAAAAJ) · [Scopus](https://www.scopus.com/authid/detail.uri?authorId=57226655446)$txt$,
  ARRAY[$txt$/images/founders/akbayan-bekarystankyzy/portrait.jpg$txt$]::TEXT[],
  1,
  true,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "Founder" WHERE "fullName" = $txt$Ақбаян Бекарыстанқызы$txt$);
