import {
  CourseEnrollmentStatus,
  CourseStatus,
  PrismaClient,
  Role,
  SubscriptionStatus,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

interface SeedUser {
  email: string;
  password: string;
  fullName: string;
  role: Role;
}

const USERS: SeedUser[] = [
  {
    email: process.env.SEED_ADMIN_EMAIL ?? 'admin@researchers.local',
    password: process.env.SEED_ADMIN_PASSWORD ?? 'Admin123!',
    fullName: 'Platform Admin',
    role: Role.ADMIN,
  },
  {
    email: 'author@researchers.local',
    password: 'Author123!',
    fullName: 'Анна Авторова',
    role: Role.AUTHOR,
  },
  {
    email: 'subscriber@researchers.local',
    password: 'Subscriber123!',
    fullName: 'Сергей Подписчиков',
    role: Role.SUBSCRIBER,
  },
];

async function upsertUser(data: SeedUser): Promise<string> {
  const passwordHash = await bcrypt.hash(data.password, 12);
  const user = await prisma.user.upsert({
    where: { email: data.email },
    update: { passwordHash, role: data.role, fullName: data.fullName, emailVerified: true },
    create: {
      email: data.email,
      passwordHash,
      fullName: data.fullName,
      role: data.role,
      emailVerified: true,
    },
  });
  return user.id;
}

async function seedDemoCourses(authorId: string): Promise<void> {
  const existing = await prisma.course.count({ where: { authorId } });
  if (existing > 0) return;

  await prisma.course.create({
    data: {
      authorId,
      title: 'Введение в академическое письмо',
      description:
        'Базовый курс о структуре научной статьи, работе с источниками и стиле изложения.',
      category: 'Академическое письмо',
      ratingAvg: 4.8,
      ratingCount: 124,
      priceCents: 499000,
      status: CourseStatus.PUBLISHED,
      lessons: {
        create: [
          {
            title: 'Зачем нужна структура',
            content:
              'В этом уроке разберём, почему чёткая структура статьи помогает читателю и автору.',
            orderNumber: 1,
          },
          {
            title: 'Работа с источниками',
            content: 'Как искать, оценивать и цитировать научные источники.',
            orderNumber: 2,
          },
          {
            title: 'Стиль и тон',
            content: 'Принципы научного стиля: точность, нейтральность, краткость.',
            orderNumber: 3,
          },
        ],
      },
    },
  });

  await prisma.course.create({
    data: {
      authorId,
      title: 'Методология исследований (черновик)',
      description: 'Курс о выборе методов исследования. Пока в работе.',
      status: CourseStatus.DRAFT,
      lessons: {
        create: [
          {
            title: 'Качественные vs количественные методы',
            content: 'Сравнение подходов и сферы применения.',
            orderNumber: 1,
          },
        ],
      },
    },
  });
}

async function seedApprovedEnrollment(
  subscriberId: string,
  authorId: string,
): Promise<void> {
  const course = await prisma.course.findFirst({
    where: { authorId, status: CourseStatus.PUBLISHED },
  });
  if (!course) return;

  const now = new Date();
  await prisma.courseEnrollment.upsert({
    where: {
      courseId_userId: { courseId: course.id, userId: subscriberId },
    },
    update: {
      status: CourseEnrollmentStatus.APPROVED,
      paidAt: now,
      approvedAt: now,
      approvedById: authorId,
    },
    create: {
      courseId: course.id,
      userId: subscriberId,
      status: CourseEnrollmentStatus.APPROVED,
      paidAt: now,
      approvedAt: now,
      approvedById: authorId,
    },
  });
}

async function seedFounders(): Promise<void> {
  const existing = await prisma.founder.count();
  if (existing > 0) return;

  const sampleVideo =
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4';

  await prisma.founder.createMany({
    data: [
      {
        fullName: 'Айгуль Нурланова',
        position: 'Сооснователь, CEO',
        description:
          'Более 10 лет в EdTech. Создала ACADEMIS, чтобы сделать академические навыки доступными каждому исследователю.',
        videoUrl: sampleVideo,
        previewUrl:
          'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&h=400&fit=crop',
        orderNumber: 1,
      },
      {
        fullName: 'Дмитрий Касымов',
        position: 'Сооснователь, Head of Science',
        description:
          'Кандидат наук, методолог. Отвечает за качество программ и работу с авторами курсов.',
        videoUrl: sampleVideo,
        previewUrl:
          'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop',
        orderNumber: 2,
      },
    ],
  });
}

async function grantActiveSubscription(
  subscriberId: string,
  adminId: string,
): Promise<void> {
  const active = await prisma.subscription.findFirst({
    where: { userId: subscriberId, status: SubscriptionStatus.ACTIVE },
  });
  if (active) return;

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  await prisma.subscription.create({
    data: {
      userId: subscriberId,
      grantedById: adminId,
      startsAt: now,
      expiresAt,
    },
  });
}

async function main(): Promise<void> {
  const ids: Record<Role, string> = {
    ADMIN: '',
    AUTHOR: '',
    SUBSCRIBER: '',
  };

  for (const user of USERS) {
    ids[user.role] = await upsertUser(user);
  }

  await seedDemoCourses(ids.AUTHOR);
  await seedFounders();
  await seedApprovedEnrollment(ids.SUBSCRIBER, ids.AUTHOR);
  await grantActiveSubscription(ids.SUBSCRIBER, ids.ADMIN);

  console.log('\nSeed completed. Demo accounts:');
  for (const user of USERS) {
    console.log(`  [${user.role.padEnd(10)}] ${user.email}  /  ${user.password}`);
  }
}

main()
  .catch((e: unknown) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
