-- Data: Asel Kamza on the "About us" block and her personal page (/founders/asel-kamza).
-- Skipped when a founder with this name already exists, so it never overwrites admin edits.
INSERT INTO "Founder" ("id", "fullName", "position", "description", "videoUrl", "previewUrl", "profileUrl", "bio", "gallery", "orderNumber", "isPublished", "updatedAt")
SELECT
  'asel-kamza',
  $txt$Әсел Қамза$txt$,
  $txt$PhD, Almaty Management University (AlmaU) ассистент-профессоры$txt$,
  $txt$Медиа және мәдени саясат, ұлттық кино және онлайн-медиа зерттеушісі. «Болашақ» стипендиясының екі дүркін иегері, Глазго университетінің PhD докторы.$txt$,
  NULL,
  $txt$/images/founders/asel-kamza/portrait.jpg$txt$,
  $txt$https://orcid.org/0000-0001-8372-4378$txt$,
  $txt$Әсел Қамза — PhD, Almaty Management University (AlmaU) Медиа және кино мектебінің ассистент-профессоры. «Болашақ» халықаралық стипендиясының екі дүркін иегері.

2011 жылы Ұлыбританиядағы Ньюкасл университетінің магистратурасын халықаралық мультимедиалық журналистика мамандығы бойынша бітірді. 2021 жылы Шотландиядағы Глазго университетінде медиа және мәдени саясат саласы бойынша «Қазақ киносы және ұлт: сыни талдау» (Kazakh cinema and the nation: a critical analysis) тақырыбында PhD диссертациясын қорғады. Ғылыми жұмысын университеттің Мәдени саясатты зерттеу орталығында (Centre for Cultural Policy Research) жүргізді.

Кәсіби жолы:
• 2006–2010 — «Хабар» арнасы: «Азамат» жастар бағдарламасының редакторы, кейін продюсері, ток-шоудың бас редакторы.
• 2011–2014 — «Қазақстан темір жолы» ҰК» АҚ: жарнама бөлімінің басшысы.
• 2021 жылдан — Сүлейман Демирел университетінің ассистент-профессоры: медиа теориясы, зерттеу әдістері, медиа әлеуметтануы және бейнекомпозиция пәндерін қазақ және ағылшын тілдерінде оқытты.
• Ала-Тоо халықаралық университетінде (Қырғызстан) журналистика және бұқаралық коммуникация бағдарламасын басқарды.
• Қазір — Almaty Management University (AlmaU) ассистент-профессоры.

Ғылыми қызығушылықтары — ұлттық кино және ұлттық бірегейлік, медиа және мәдени саясат, онлайн-медиа және саяси коммуникация, толерантты журналистика, автобиографиялық кино.

Media Asia (2023), Slavonica (2024), «Журналистика хабаршысы» журналдарында жарияланған мақалалардың, Қазақстан киносындағы бірегейлікті қалпына келтіру мен тарихи жарақатты еңсеру туралы ұжымдық кітаптағы тараудың авторы.

Ғылыми профильдері: [ORCID](https://orcid.org/0000-0001-8372-4378) · [Google Scholar](https://scholar.google.com/citations?user=SgEABdIAAAAJ) · [Scopus](https://www.scopus.com/authid/detail.uri?authorId=58418467200)$txt$,
  ARRAY[$txt$/images/founders/asel-kamza/portrait.jpg$txt$]::TEXT[],
  2,
  true,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "Founder" WHERE "fullName" = $txt$Әсел Қамза$txt$);
