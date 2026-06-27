import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { CoursesModule } from './modules/courses/courses.module';
import { LessonsModule } from './modules/lessons/lessons.module';
import { MediaModule } from './modules/media/media.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { ProgressModule } from './modules/progress/progress.module';
import { EnrollmentsModule } from './modules/enrollments/enrollments.module';
import { FoundersModule } from './modules/founders/founders.module';
import { AiModule } from './modules/ai/ai.module';
import { LandingSectionsModule } from './modules/landing-sections/landing-sections.module';
import { TelegramModule } from './modules/telegram/telegram.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    PrismaModule,
    HealthModule,
    AuthModule,
    UsersModule,
    CoursesModule,
    LessonsModule,
    MediaModule,
    SubscriptionsModule,
    ProgressModule,
    EnrollmentsModule,
    FoundersModule,
    AiModule,
    LandingSectionsModule,
    TelegramModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
