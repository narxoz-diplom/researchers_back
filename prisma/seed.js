"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcrypt = __importStar(require("bcrypt"));
const prisma = new client_1.PrismaClient();
const USERS = [
    {
        email: process.env.SEED_ADMIN_EMAIL ?? 'admin@researchers.local',
        password: process.env.SEED_ADMIN_PASSWORD ?? 'Admin123!',
        fullName: 'Platform Admin',
        role: client_1.Role.ADMIN,
    },
    {
        email: 'author@researchers.local',
        password: 'Author123!',
        fullName: 'Анна Авторова',
        role: client_1.Role.AUTHOR,
    },
    {
        email: 'subscriber@researchers.local',
        password: 'Subscriber123!',
        fullName: 'Сергей Подписчиков',
        role: client_1.Role.SUBSCRIBER,
    },
];
async function upsertUser(data) {
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
async function seedDemoCourses(authorId) {
    const existing = await prisma.course.count({ where: { authorId } });
    if (existing > 0)
        return;
    await prisma.course.create({
        data: {
            authorId,
            title: 'Введение в академическое письмо',
            description: 'Базовый курс о структуре научной статьи, работе с источниками и стиле изложения.',
            category: 'publication',
            ratingAvg: 4.8,
            ratingCount: 124,
            priceCents: 499000,
            status: client_1.CourseStatus.PUBLISHED,
            lessons: {
                create: [
                    {
                        title: 'Зачем нужна структура',
                        content: 'В этом уроке разберём, почему чёткая структура статьи помогает читателю и автору.',
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
            category: 'methods',
            status: client_1.CourseStatus.DRAFT,
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
async function seedApprovedEnrollment(subscriberId, authorId) {
    const course = await prisma.course.findFirst({
        where: { authorId, status: client_1.CourseStatus.PUBLISHED },
    });
    if (!course)
        return;
    const now = new Date();
    await prisma.courseEnrollment.upsert({
        where: {
            courseId_userId: { courseId: course.id, userId: subscriberId },
        },
        update: {
            status: client_1.CourseEnrollmentStatus.APPROVED,
            paidAt: now,
            approvedAt: now,
            approvedById: authorId,
        },
        create: {
            courseId: course.id,
            userId: subscriberId,
            status: client_1.CourseEnrollmentStatus.APPROVED,
            paidAt: now,
            approvedAt: now,
            approvedById: authorId,
        },
    });
}
async function seedFounders() {
    const existing = await prisma.founder.count();
    if (existing > 0)
        return;
    const sampleVideo = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4';
    await prisma.founder.createMany({
        data: [
            {
                fullName: 'Айгуль Нурланова',
                position: 'Сооснователь, CEO',
                description: 'Более 10 лет в EdTech. Создала ACADEMIS, чтобы сделать академические навыки доступными каждому исследователю.',
                videoUrl: sampleVideo,
                previewUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&h=400&fit=crop',
                orderNumber: 1,
            },
            {
                fullName: 'Дмитрий Касымов',
                position: 'Сооснователь, Head of Science',
                description: 'Кандидат наук, методолог. Отвечает за качество программ и работу с авторами курсов.',
                videoUrl: sampleVideo,
                previewUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop',
                orderNumber: 2,
            },
        ],
    });
}
async function grantActiveSubscription(subscriberId, adminId) {
    const active = await prisma.subscription.findFirst({
        where: { userId: subscriberId, status: client_1.SubscriptionStatus.ACTIVE },
    });
    if (active)
        return;
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
async function main() {
    const ids = {
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
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(() => void prisma.$disconnect());
//# sourceMappingURL=seed.js.map