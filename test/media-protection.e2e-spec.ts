import { INestApplication, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test, TestingModule } from '@nestjs/testing';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { GlobalExceptionFilter } from './../src/common/filters/global-exception.filter';
import { setupUploadsStatic } from './../src/common/static-uploads';
import { MediaTokenService } from './../src/modules/media/media-token.service';
import { PrismaService } from './../src/prisma/prisma.service';
import {
  registerVerified,
  SEED_ADMIN_EMAIL,
  tokensFor,
  uniqueEmail,
} from './helpers';

const VIDEO_BYTES = Buffer.from('FAKE-MP4-BYTES-0123456789abcdef');
const PDF_BYTES = Buffer.from('%PDF-1.4 fake pdf for e2e');

interface LessonBody {
  content: string;
  videos: {
    id: string;
    source: string;
    url?: string;
    streamUrl?: string;
    youtubeVideoId?: string;
  }[];
  materials: {
    id: string;
    url?: string;
    viewUrl?: string;
    htmlUrl?: string;
  }[];
}

describe('Lesson media is view-only on the site (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let mediaTokens: MediaTokenService;
  let adminToken: string;
  let authorToken: string;
  let authorId: string;
  let courseId: string;
  let lessonId: string;
  let otherLessonId: string;
  let videoId: string;
  let materialId: string;
  let relativeVideoPath: string;
  let relativePdfPath: string;
  let uploadDir: string;

  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestExpressApplication>();
    setupUploadsStatic(app as NestExpressApplication);
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);
    mediaTokens = app.get(MediaTokenService);

    adminToken = (await tokensFor(app, SEED_ADMIN_EMAIL)).accessToken;
    const author = await registerVerified(app, {
      email: uniqueEmail('media-author'),
      password: 'Password1!',
      fullName: 'Media Author',
      role: 'AUTHOR',
    });
    authorToken = (author.body as { accessToken: string }).accessToken;
    authorId = (author.body as { user: { id: string } }).user.id;

    const course = await http()
      .post('/api/v1/courses')
      .set('Authorization', `Bearer ${authorToken}`)
      .send({
        title: 'Protected media',
        description: 'x',
        category: 'tools',
        priceCents: 100_000,
      })
      .expect(201);
    courseId = (course.body as { id: string }).id;
    await http()
      .post(`/api/v1/courses/${courseId}/publish`)
      .set('Authorization', `Bearer ${authorToken}`)
      .expect(200);

    const lesson = await http()
      .post(`/api/v1/courses/${courseId}/lessons`)
      .set('Authorization', `Bearer ${authorToken}`)
      .send({
        title: 'Video lesson',
        content: 'PAID_TEXT',
        orderNumber: 1,
        isPublished: true,
      })
      .expect(201);
    lessonId = (lesson.body as { id: string }).id;
    const other = await http()
      .post(`/api/v1/courses/${courseId}/lessons`)
      .set('Authorization', `Bearer ${authorToken}`)
      .send({ title: 'Other', orderNumber: 2, isPublished: true })
      .expect(201);
    otherLessonId = (other.body as { id: string }).id;

    // Local-upload layout: uploads/courses/<course>/lessons/<lesson>/...
    const lessonFolder = `courses/${courseId}/lessons/${lessonId}`;
    uploadDir = join(process.cwd(), 'uploads', lessonFolder);
    mkdirSync(join(uploadDir, 'videos'), { recursive: true });
    mkdirSync(join(uploadDir, 'materials'), { recursive: true });
    relativeVideoPath = `${lessonFolder}/videos/e2e-clip.mp4`;
    relativePdfPath = `${lessonFolder}/materials/e2e-notes.pdf`;
    writeFileSync(
      join(process.cwd(), 'uploads', relativeVideoPath),
      VIDEO_BYTES,
    );
    writeFileSync(join(process.cwd(), 'uploads', relativePdfPath), PDF_BYTES);

    const video = await http()
      .post(`/api/v1/lessons/${lessonId}/videos`)
      .set('Authorization', `Bearer ${authorToken}`)
      .send({
        title: 'Clip',
        cloudinaryPublicId: `${lessonFolder}/videos/e2e-clip-${Date.now()}`,
        url: `http://localhost:8080/api/v1/media/files/${relativeVideoPath}`,
        durationSeconds: 12,
        sizeBytes: VIDEO_BYTES.length,
      })
      .expect(201);
    videoId = (video.body as { id: string }).id;

    await http()
      .post(`/api/v1/lessons/${lessonId}/videos/youtube`)
      .set('Authorization', `Bearer ${authorToken}`)
      .send({ title: 'Talk', youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ' })
      .expect(201);

    const material = await http()
      .post(`/api/v1/lessons/${lessonId}/materials`)
      .set('Authorization', `Bearer ${authorToken}`)
      .send({
        title: 'Notes.pdf',
        cloudinaryPublicId: `${lessonFolder}/materials/e2e-notes-${Date.now()}`,
        url: `http://localhost:8080/api/v1/media/files/${relativePdfPath}`,
        mimeType: 'application/pdf',
        sizeBytes: PDF_BYTES.length,
      })
      .expect(201);
    materialId = (material.body as { id: string }).id;
  });

  afterAll(async () => {
    rmSync(join(process.cwd(), 'uploads', 'courses', courseId), {
      recursive: true,
      force: true,
    });
    await app.close();
  });

  async function approvedStudent() {
    const reg = await registerVerified(app, {
      email: uniqueEmail('media-student'),
      password: 'Password1!',
      fullName: 'Media Student',
      role: 'SUBSCRIBER',
    });
    const body = reg.body as { accessToken: string; user: { id: string } };
    const paid = await http()
      .post(`/api/v1/courses/${courseId}/enrollments/purchase`)
      .set('Authorization', `Bearer ${body.accessToken}`)
      .send({ paidAmountCents: 100_000 })
      .expect(200);
    await http()
      .post(
        `/api/v1/courses/${courseId}/enrollments/${(paid.body as { id: string }).id}/approve`,
      )
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    return { token: body.accessToken, id: body.user.id };
  }

  async function lessonFor(token: string): Promise<LessonBody> {
    const res = await http()
      .get(`/api/v1/lessons/${lessonId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    return res.body as LessonBody;
  }

  it('direct links to lesson files are closed; covers stay public', async () => {
    await http().get(`/api/v1/media/files/${relativeVideoPath}`).expect(404);
    await http().get(`/api/v1/media/files/${relativePdfPath}`).expect(404);

    const coverDir = join(
      process.cwd(),
      'uploads',
      'courses',
      courseId,
      'cover',
    );
    mkdirSync(coverDir, { recursive: true });
    writeFileSync(join(coverDir, 'c.png'), Buffer.from('png'));
    await http()
      .get(`/api/v1/media/files/courses/${courseId}/cover/c.png`)
      .expect(200);
  });

  it('students get stream/view links, never the origin URL or the YouTube link', async () => {
    const student = await approvedStudent();
    const lesson = await lessonFor(student.token);
    expect(lesson.content).toBe('PAID_TEXT');

    const uploaded = lesson.videos.find((v) => v.source === 'CLOUDINARY')!;
    const youtube = lesson.videos.find((v) => v.source === 'YOUTUBE')!;
    expect(uploaded.url).toBeUndefined();
    expect(uploaded.streamUrl).toMatch(/^\/videos\/.+\/stream\?t=/);
    expect(youtube.url).toBeUndefined();
    expect(youtube.streamUrl).toBeUndefined();
    expect(youtube.youtubeVideoId).toBe('dQw4w9WgXcQ');
    expect(JSON.stringify(lesson)).not.toContain('youtube.com/watch');
    expect(JSON.stringify(lesson)).not.toContain('/media/files/');

    expect(lesson.materials[0].url).toBeUndefined();
    expect(lesson.materials[0].viewUrl).toBe(`/materials/${materialId}/view`);
    expect(lesson.materials[0].htmlUrl).toBeUndefined();

    // The course page lists the program but hands out no file links either.
    const course = await http()
      .get(`/api/v1/courses/${courseId}`)
      .set('Authorization', `Bearer ${student.token}`)
      .expect(200);
    expect(JSON.stringify(course.body)).not.toContain('/media/files/');
    expect(JSON.stringify(course.body)).not.toContain('youtube.com');
  });

  it('the author and admins still see the origin URLs', async () => {
    const lesson = await lessonFor(authorToken);
    const uploaded = lesson.videos.find((v) => v.source === 'CLOUDINARY')!;
    expect(uploaded.url).toContain('/media/files/');
    expect(uploaded.streamUrl).toBeDefined();
    expect(lesson.materials[0].url).toContain('/media/files/');

    const asAdmin = await lessonFor(adminToken);
    expect(asAdmin.videos.find((v) => v.source === 'YOUTUBE')!.url).toContain(
      'youtube.com/watch',
    );
  });

  it('the stream link plays for its viewer (with ranges) and refuses everyone else', async () => {
    const student = await approvedStudent();
    const lesson = await lessonFor(student.token);
    const streamUrl = lesson.videos.find(
      (v) => v.source === 'CLOUDINARY',
    )!.streamUrl!;

    // No Authorization header: this is what a <video> tag sends.
    const full = await http().get(`/api/v1${streamUrl}`).expect(200);
    expect(full.headers['content-type']).toBe('video/mp4');
    expect(full.headers['content-disposition']).toMatch(/^inline/);
    expect(full.headers['cache-control']).toBe('private, no-store');
    expect(Buffer.from(full.body as Buffer)).toEqual(VIDEO_BYTES);

    const partial = await http()
      .get(`/api/v1${streamUrl}`)
      .set('Range', 'bytes=5-9')
      .expect(206);
    expect(partial.headers['content-range']).toBe(
      `bytes 5-9/${VIDEO_BYTES.length}`,
    );
    expect(Buffer.from(partial.body as Buffer)).toEqual(
      VIDEO_BYTES.subarray(5, 10),
    );
    await http()
      .get(`/api/v1${streamUrl}`)
      .set('Range', 'bytes=999-')
      .expect(416);

    // Without a token or a bearer, and with a forged/foreign token: closed.
    await http().get(`/api/v1/videos/${videoId}/stream`).expect(403);
    await http().get(`/api/v1/videos/${videoId}/stream?t=abc.def`).expect(403);
    const otherLessonToken = mediaTokens.sign({
      userId: student.id,
      lessonId: otherLessonId,
    });
    await http()
      .get(`/api/v1/videos/${videoId}/stream?t=${otherLessonToken}`)
      .expect(403);
    const expired = mediaTokens.sign({ userId: student.id, lessonId }, -1);
    await http()
      .get(`/api/v1/videos/${videoId}/stream?t=${expired}`)
      .expect(403);

    // A bearer token works too, but only with access.
    await http()
      .get(`/api/v1/videos/${videoId}/stream`)
      .set('Authorization', `Bearer ${student.token}`)
      .expect(200);
    const stranger = await registerVerified(app, {
      email: uniqueEmail('media-stranger'),
      password: 'Password1!',
      fullName: 'No Access',
      role: 'SUBSCRIBER',
    });
    const strangerToken = (stranger.body as { accessToken: string })
      .accessToken;
    await http()
      .get(`/api/v1/videos/${videoId}/stream`)
      .set('Authorization', `Bearer ${strangerToken}`)
      .expect(403);
    const strangerMediaToken = mediaTokens.sign({
      userId: (stranger.body as { user: { id: string } }).user.id,
      lessonId,
    });
    await http()
      .get(`/api/v1/videos/${videoId}/stream?t=${strangerMediaToken}`)
      .expect(403);
  });

  it('a revoked enrollment closes the stream link at once', async () => {
    const student = await approvedStudent();
    const lesson = await lessonFor(student.token);
    const streamUrl = lesson.videos.find(
      (v) => v.source === 'CLOUDINARY',
    )!.streamUrl!;
    await http().get(`/api/v1${streamUrl}`).expect(200);

    await prisma.courseEnrollment.update({
      where: { courseId_userId: { courseId, userId: student.id } },
      data: { status: 'REJECTED' },
    });
    await http().get(`/api/v1${streamUrl}`).expect(403);
  });

  it('materials open inline for students and download only for the author/admin', async () => {
    const student = await approvedStudent();

    const view = await http()
      .get(`/api/v1/materials/${materialId}/view`)
      .set('Authorization', `Bearer ${student.token}`)
      .expect(200);
    expect(view.headers['content-type']).toBe('application/pdf');
    expect(view.headers['content-disposition']).toMatch(/^inline/);
    expect(Buffer.from(view.body as Buffer)).toEqual(PDF_BYTES);

    await http()
      .get(`/api/v1/materials/${materialId}/download`)
      .set('Authorization', `Bearer ${student.token}`)
      .expect(403);
    await http()
      .get(`/api/v1/materials/${materialId}/html`)
      .set('Authorization', `Bearer ${student.token}`)
      .expect(400);

    const stranger = await registerVerified(app, {
      email: uniqueEmail('material-stranger'),
      password: 'Password1!',
      fullName: 'No Access',
      role: 'SUBSCRIBER',
    });
    await http()
      .get(`/api/v1/materials/${materialId}/view`)
      .set(
        'Authorization',
        `Bearer ${(stranger.body as { accessToken: string }).accessToken}`,
      )
      .expect(403);
    await http().get(`/api/v1/materials/${materialId}/view`).expect(403);

    const download = await http()
      .get(`/api/v1/materials/${materialId}/download`)
      .set('Authorization', `Bearer ${authorToken}`)
      .expect(200);
    expect(download.headers['content-disposition']).toMatch(/^attachment/);

    const otherAuthor = await registerVerified(app, {
      email: uniqueEmail('other-author'),
      password: 'Password1!',
      fullName: 'Other',
      role: 'AUTHOR',
    });
    await http()
      .get(`/api/v1/materials/${materialId}/download`)
      .set(
        'Authorization',
        `Bearer ${(otherAuthor.body as { accessToken: string }).accessToken}`,
      )
      .expect(403);
    expect(authorId).toBeTruthy();
  });

  it('a DOCX material is rendered as HTML for reading on the page', async () => {
    const student = await approvedStudent();
    // A one-paragraph .docx assembled by hand (see zipStored below).
    const docx = buildMinimalDocx('Hello from DOCX');
    const relative = `courses/${courseId}/lessons/${lessonId}/materials/e2e.docx`;
    writeFileSync(join(process.cwd(), 'uploads', relative), docx);
    const attached = await http()
      .post(`/api/v1/lessons/${lessonId}/materials`)
      .set('Authorization', `Bearer ${authorToken}`)
      .send({
        title: 'Handout.docx',
        cloudinaryPublicId: `${relative}-${Date.now()}`,
        url: `http://localhost:8080/api/v1/media/files/${relative}`,
        mimeType:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        sizeBytes: docx.length,
      })
      .expect(201);
    const id = (attached.body as { id: string }).id;

    const lesson = await lessonFor(student.token);
    expect(lesson.materials.find((m) => m.id === id)?.htmlUrl).toBe(
      `/materials/${id}/html`,
    );
    const html = await http()
      .get(`/api/v1/materials/${id}/html`)
      .set('Authorization', `Bearer ${student.token}`)
      .expect(200);
    expect((html.body as { html: string }).html).toContain('Hello from DOCX');
  });
});

/** A one-paragraph .docx assembled from the minimal OOXML parts (stored, uncompressed zip). */
function buildMinimalDocx(text: string): Buffer {
  const files: Record<string, string> = {
    '[Content_Types].xml':
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
      '</Types>',
    '_rels/.rels':
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
      '</Relationships>',
    'word/document.xml':
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
      `<w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:body></w:document>`,
  };
  return zipStored(files);
}

function crc32(buf: Buffer): number {
  let crc = ~0;
  for (const byte of buf) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return ~crc >>> 0;
}

function zipStored(files: Record<string, string>): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const nameBuf = Buffer.from(name, 'utf8');
    const data = Buffer.from(content, 'utf8');
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, nameBuf, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBuf);
    offset += local.length + nameBuf.length + data.length;
  }
  const centralSize = centrals.reduce((n, b) => n + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(Object.keys(files).length, 8);
  end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...locals, ...centrals, end]);
}
