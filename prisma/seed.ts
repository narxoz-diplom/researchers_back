import { PrismaClient, Role, SubscriptionStatus } from '@prisma/client';
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

async function seedCategories(): Promise<Record<string, string>> {
  const items = [
    { name: 'Общее', slug: 'general', orderNumber: 0 },
    { name: 'Академическое письмо', slug: 'academic-writing', orderNumber: 1 },
    { name: 'Методология', slug: 'methodology', orderNumber: 2 },
  ];

  const ids: Record<string, string> = {};
  for (const item of items) {
    const category = await prisma.category.upsert({
      where: { slug: item.slug },
      update: { name: item.name, orderNumber: item.orderNumber, isPublished: true },
      create: { ...item, isPublished: true },
    });
    ids[item.slug] = category.id;
  }
  return ids;
}

async function consolidateCategories(): Promise<void> {
  const canonical = await prisma.category.findMany({
    where: { slug: { in: ['general', 'academic-writing', 'methodology'] } },
  });

  for (const target of canonical) {
    const duplicates = await prisma.category.findMany({
      where: { name: target.name, id: { not: target.id } },
    });

    for (const duplicate of duplicates) {
      await prisma.course.updateMany({
        where: { categoryId: duplicate.id },
        data: { categoryId: target.id },
      });
      await prisma.category.delete({ where: { id: duplicate.id } });
    }
  }

  const legacy = await prisma.category.findMany({
    where: { slug: { startsWith: 'cat-' } },
  });

  for (const duplicate of legacy) {
    const target = canonical.find((item) => item.name === duplicate.name);
    if (!target) continue;

    await prisma.course.updateMany({
      where: { categoryId: duplicate.id },
      data: { categoryId: target.id },
    });
    await prisma.category.delete({ where: { id: duplicate.id } });
  }
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

  await seedCategories();
  await consolidateCategories();
  await seedFounders();
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
