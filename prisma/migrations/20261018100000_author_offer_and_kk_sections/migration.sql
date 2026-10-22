-- Author signup with a public offer, reviewed by an admin; Kazakh texts for landing sections.

-- CreateEnum
CREATE TYPE "AuthorStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "authorStatus" "AuthorStatus";

-- Authors who already exist keep managing their courses.
UPDATE "User" SET "authorStatus" = 'APPROVED' WHERE "role" = 'AUTHOR';

-- CreateTable
CREATE TABLE "AuthorApplication" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "iin" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "iban" TEXT NOT NULL,
    "about" TEXT NOT NULL,
    "offerVersion" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL,
    "reviewNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthorApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AuthorApplication_userId_key" ON "AuthorApplication"("userId");

-- AddForeignKey
ALTER TABLE "AuthorApplication" ADD CONSTRAINT "AuthorApplication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthorApplication" ADD CONSTRAINT "AuthorApplication_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "LandingSection" ADD COLUMN "descriptionKk" TEXT NOT NULL DEFAULT '',
ADD COLUMN "pointsKk" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Kazakh texts for the existing sections (same as the site's built-in Kazakh defaults).
UPDATE "LandingSection"
SET "descriptionKk" = $txt$Ғылыми мақалалар, диссертациялар, рецензиялау — идеядан рецензияланатын баспаға дейінгі барлық жол.$txt$,
    "pointsKk" = ARRAY[$txt$Ғылыми жұмыстың құрылымы мен ресімдеуі$txt$, $txt$Журнал таңдау және қолжазба дайындау$txt$, $txt$Рецензиялармен жұмыс және жариялау этикасы$txt$]::TEXT[]
WHERE "slug" = 'publication' AND "descriptionKk" = '';

UPDATE "LandingSection"
SET "descriptionKk" = $txt$Сандық және сапалық тәсілдер, зерттеу дизайны, деректер жинау мен талдау — нақты жобалар мысалдарымен.$txt$,
    "pointsKk" = ARRAY[$txt$Сапалық және сандық әдістер$txt$, $txt$Сауалнама, сұхбат, кейс-стади$txt$, $txt$Валидтілік, сенімділік және зерттеу этикасы$txt$]::TEXT[]
WHERE "slug" = 'methods' AND "descriptionKk" = '';

UPDATE "LandingSection"
SET "descriptionKk" = $txt$Уақытты үнемдейтін бағдарламалар мен сервистер: әдебиетті басқарудан статистикалық талдауға дейін.$txt$,
    "pointsKk" = ARRAY[$txt$Zotero, Mendeley және дереккөзбен жұмыс$txt$, $txt$SPSS, R және статистика негіздері$txt$, $txt$Деректер визуализациясы және нәтижелерді ұсыну$txt$]::TEXT[]
WHERE "slug" = 'tools' AND "descriptionKk" = '';

UPDATE "LandingSection"
SET "descriptionKk" = $txt$Зерттеу — спринт емес, марафон. Академиялық ортада баланс, мотивация мен төзімділікті сақтауды үйренеміз.$txt$,
    "pointsKk" = ARRAY[$txt$Күйзелістің алдын алу және стресс-менеджмент$txt$, $txt$Зерттеуші үшін уақытты басқару$txt$, $txt$Қолдаушы академиялық ортаны құру$txt$]::TEXT[]
WHERE "slug" = 'wellness' AND "descriptionKk" = '';
