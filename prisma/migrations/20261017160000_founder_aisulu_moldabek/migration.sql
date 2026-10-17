-- Data: Aisulu Moldabek on the "About us" block and her personal page (/founders/aisulu-moldabek).
-- Skipped when a founder with this name already exists, so it never overwrites admin edits.
INSERT INTO "Founder" ("id", "fullName", "position", "description", "videoUrl", "previewUrl", "profileUrl", "bio", "gallery", "orderNumber", "isPublished", "updatedAt")
SELECT
  'aisulu-moldabek',
  $txt$Айсұлу Молдабек$txt$,
  $txt$PhD, «Zertteu LAB» зертханасының меңгерушісі$txt$,
  $txt$Экономика институтының аға ғылыми қызметкері, ҚазҰУ оқытушысы. «Болашақ» түлегі, «Дарын» мемлекеттік жастар сыйлығының лауреаты (2024).$txt$,
  NULL,
  $txt$/founders/aisulu-moldabek/portrait.jpg$txt$,
  $txt$https://pps.kaznu.kz/ru/Main/Personal/637/446/15801/%D0%9C%D0%BE%D0%BB%D0%B4%D0%B0%D0%B1%D0%B5%D0%BA%D0%BE%D0%B2%D0%B0%20%D0%90%D0%B9%D1%81%D1%83%D0%BB%D1%83%20%D0%A2%D1%83%D1%80%D1%81%D1%8B%D0%BD%D0%B1%D0%B0%D0%B5%D0%B2%D0%BD%D0%B0$txt$,
  $txt$Айсұлу Тұрсынбайқызы Молдабекова — PhD, ҚР ҒЖБМ Ғылым комитеті Экономика институтындағы «Zertteu LAB» зерттеу зертханасының меңгерушісі, әл-Фараби атындағы ҚазҰУ бизнес-технологиялар кафедрасының аға оқытушысы.

Мектепте жүріп-ақ 200-ден астам мақала жазған. Университетте әлеуметтану мамандығын таңдап, пікірсайыспен айналысты, «Хабар» арнасында тілші болды. «Болашақ» бағдарламасы бойынша М.В. Ломоносов атындағы Мәскеу мемлекеттік университетінің магистратурасын бітірді (2011–2013). 2022 жылы логистика бойынша PhD диссертациясын қорғады: Еуразиялық көлік дәліздеріндегі құрғақ порттардың логистикалық қызметін жетілдіру («Қорғас» мысалында).

2013 жылдан бері Экономика институтында жұмыс істейді. Ғылыми қызығушылықтары — бағдарламалар мен жобалардың тиімділігін бағалау, логистикалық сервис сапасы, әлеуметтік зерттеулер әдіснамасы және деректерді талдау. «Zertteu LAB» зертханасы зерттеушілердің академиялық дағдыларын арттыруға, деректерді талдаудың заманауи әдістері бойынша әдістемелік мектептер мен семинарлар өткізуге бағытталған. Айсұлу «Central Asia Research Club» кеңесші-тренері ретінде де жас зерттеушілерді оқытады.

2020 жылы DAAD стипендиясымен Висмар қолданбалы ғылымдар университетінде (Германия) ғылыми тағылымдамадан өтті. 2024 жылы «Дарын» мемлекеттік жастар сыйлығының «Ғылым» номинациясы бойынша лауреаты атанды. ҚР Президенті жанындағы Жас ғалымдар кеңесі Президиумының мүшесі.

Ғылыми профильдері: [ORCID](https://orcid.org/0000-0003-4330-5595) · [Google Scholar](https://scholar.google.com/citations?user=BgMamhUAAAAJ)$txt$,
  ARRAY[$txt$/founders/aisulu-moldabek/portrait.jpg$txt$, $txt$/founders/aisulu-moldabek/interview-2015.jpg$txt$, $txt$/founders/aisulu-moldabek/portrait-white.jpg$txt$]::TEXT[],
  0,
  true,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "Founder" WHERE "fullName" = $txt$Айсұлу Молдабек$txt$);
