import 'dotenv/config';
import bcrypt from 'bcryptjs';
import cookieParser from 'cookie-parser';
import Database from 'better-sqlite3';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(directory, '..');
const dataDirectory = path.join(projectDirectory, 'data');
const materialsDirectory = path.join(dataDirectory, 'materials');
const databasePath = path.join(dataDirectory, 'xtzstudy.sqlite');
const port = Number(process.env.PORT || 3001);
const jwtSecret = process.env.JWT_SECRET;
const tokenCookie = 'xtzstudy_session';
const tokenLifetimeMs = 60 * 60 * 1000;
const tokenLifetimeSeconds = tokenLifetimeMs / 1000;
const isProduction = process.env.NODE_ENV === 'production';

if (!jwtSecret || Buffer.byteLength(jwtSecret) < 32) {
  throw new Error('JWT_SECRET is required and must contain at least 32 bytes. See .env.example.');
}

const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const adminPassword = process.env.ADMIN_PASSWORD;

if (Boolean(adminEmail) !== Boolean(adminPassword)) {
  throw new Error('Set both ADMIN_EMAIL and ADMIN_PASSWORD to provision the admin account.');
}

if (adminEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
  throw new Error('ADMIN_EMAIL must be a valid email address.');
}

if (adminPassword && (Buffer.byteLength(adminPassword) < 12 || Buffer.byteLength(adminPassword) > 72)) {
  throw new Error('ADMIN_PASSWORD must contain 12 to 72 bytes.');
}

await mkdir(dataDirectory, { recursive: true });
await mkdir(materialsDirectory, { recursive: true });

const database = new Database(databasePath);
database.pragma('journal_mode = WAL');
database.pragma('foreign_keys = ON');
database.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    identifier TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'student')),
    class_level INTEGER,
    school TEXT,
    active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS study_materials (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    class_level INTEGER NOT NULL CHECK (class_level BETWEEN 1 AND 10),
    subject TEXT NOT NULL,
    chapter TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    file_name TEXT NOT NULL,
    storage_name TEXT NOT NULL UNIQUE,
    published INTEGER NOT NULL DEFAULT 0 CHECK (published IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS courses (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    department TEXT NOT NULL CHECK (department IN ('Computer Science', 'Management')),
    program TEXT NOT NULL CHECK (program IN ('BCA', 'B.Tech', 'BBA', 'MBA')),
    duration TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    published INTEGER NOT NULL DEFAULT 0 CHECK (published IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (
      (department = 'Computer Science' AND program IN ('BCA', 'B.Tech')) OR
      (department = 'Management' AND program IN ('BBA', 'MBA'))
    )
  );
  CREATE TABLE IF NOT EXISTS course_posts (
    id TEXT PRIMARY KEY,
    course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    post_type TEXT NOT NULL CHECK (post_type IN ('PYQ', 'Test', 'Other')),
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    resource_url TEXT NOT NULL DEFAULT '',
    file_name TEXT,
    storage_name TEXT UNIQUE,
    published INTEGER NOT NULL DEFAULT 0 CHECK (published IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

const coursePostColumns = new Set(
  database.pragma('table_info(course_posts)').map((column) => column.name),
);
if (!coursePostColumns.has('file_name')) {
  database.exec('ALTER TABLE course_posts ADD COLUMN file_name TEXT');
}
if (!coursePostColumns.has('storage_name')) {
  database.exec('ALTER TABLE course_posts ADD COLUMN storage_name TEXT');
  database.exec('CREATE UNIQUE INDEX IF NOT EXISTS course_posts_storage_name_unique ON course_posts(storage_name)');
}

const findUserByIdentifier = database.prepare(
  'SELECT id, name, identifier, password_hash, role, class_level, school, active FROM users WHERE identifier = ?',
);
const findUserById = database.prepare(
  'SELECT id, name, identifier, role, class_level, school, active FROM users WHERE id = ?',
);
const listStudyMaterials = database.prepare(`
  SELECT id, title, class_level, subject, chapter, description, file_name, published, created_at
  FROM study_materials
  ORDER BY created_at DESC
`);
const findStudyMaterialById = database.prepare(`
  SELECT id, title, class_level, subject, chapter, description, file_name, storage_name, published, created_at
  FROM study_materials
  WHERE id = ?
`);
const listCourses = database.prepare(`
  SELECT id, title, department, program, duration, description, published, created_at
  FROM courses
  ORDER BY created_at DESC
`);
const findCourseById = database.prepare(`
  SELECT id, title, department, program, duration, description, published, created_at
  FROM courses
  WHERE id = ?
`);
const listCoursePosts = database.prepare(`
  SELECT id, course_id, post_type, title, description, resource_url, file_name, storage_name, published, created_at
  FROM course_posts
  ORDER BY created_at DESC
`);
const findCoursePostById = database.prepare(`
  SELECT id, course_id, post_type, title, description, resource_url, file_name, storage_name, published, created_at
  FROM course_posts
  WHERE id = ?
`);
const timingDummyHash = await bcrypt.hash('invalid-login-timing-protection', 12);

if (adminEmail && adminPassword && !findUserByIdentifier.get(adminEmail)) {
  const passwordHash = await bcrypt.hash(adminPassword, 12);
  database.prepare(
    'INSERT INTO users (name, identifier, password_hash, role) VALUES (?, ?, ?, ?)',
  ).run('XtzStudy Admin', adminEmail, passwordHash, 'admin');
  console.info(`Provisioned the admin account for ${adminEmail}.`);
}

const app = express();
app.disable('x-powered-by');
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
}));
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again in 15 minutes.' },
});
const uploadPdf = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 1 },
});

function parseSinglePdf(request, response, next) {
  uploadPdf.single('pdf')(request, response, (error) => {
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        response.status(413).json({ error: 'PDF files must be 15 MB or smaller.' });
        return;
      }
      response.status(400).json({ error: 'Upload one PDF file at a time.' });
      return;
    }
    if (error) {
      next(error);
      return;
    }

    next();
  });
}

function publicStudyMaterial(material) {
  return {
    id: material.id,
    title: material.title,
    contentType: 'Study material',
    classLevel: material.class_level,
    subject: material.subject,
    chapter: material.chapter,
    description: material.description,
    fileName: material.file_name,
    resourceUrl: `/api/materials/${material.id}`,
    published: Boolean(material.published),
    createdAt: material.created_at,
  };
}

function publicCourse(course) {
  return {
    id: course.id,
    title: course.title,
    department: course.department,
    program: course.program,
    duration: course.duration,
    description: course.description,
    published: Boolean(course.published),
    createdAt: course.created_at,
  };
}

function publicCoursePost(post) {
  return {
    id: post.id,
    courseId: post.course_id,
    postType: post.post_type,
    title: post.title,
    description: post.description,
    resourceUrl: post.resource_url,
    fileName: post.file_name,
    pdfUrl: post.storage_name ? `/api/course-posts/${post.id}/pdf` : '',
    published: Boolean(post.published),
    createdAt: post.created_at,
  };
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    identifier: user.identifier,
    role: user.role,
    classLevel: user.class_level,
    school: user.school,
  };
}

function normalizeIdentifier(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();

  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return trimmed.toLowerCase();
  }

  if (/^\+?[0-9\s()-]{8,20}$/.test(trimmed)) {
    const digits = trimmed.replace(/\D/g, '');
    return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  }

  return null;
}

function signInCookieOptions() {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    path: '/api',
    maxAge: tokenLifetimeMs,
  };
}

function createSession(user, response) {
  const token = jwt.sign(
    { role: user.role },
    jwtSecret,
    {
      subject: String(user.id),
      issuer: 'xtzstudy',
      audience: 'xtzstudy-web',
      expiresIn: tokenLifetimeSeconds,
    },
  );

  response.cookie(tokenCookie, token, signInCookieOptions());
  return publicUser(user);
}

function requireAuthentication(request, response, next) {
  const token = request.cookies[tokenCookie];
  if (!token) {
    response.status(401).json({ error: 'Please sign in to continue.' });
    return;
  }

  try {
    const payload = jwt.verify(token, jwtSecret, {
      issuer: 'xtzstudy',
      audience: 'xtzstudy-web',
    });
    const user = findUserById.get(Number(payload.sub));

    if (!user || !user.active || user.role !== payload.role) {
      response.clearCookie(tokenCookie, signInCookieOptions());
      response.status(401).json({ error: 'Your session is no longer valid. Please sign in again.' });
      return;
    }

    request.user = user;
    next();
  } catch {
    response.clearCookie(tokenCookie, signInCookieOptions());
    response.status(401).json({ error: 'Your session has expired. Please sign in again.' });
  }
}

function requireRole(role) {
  return (request, response, next) => {
    if (request.user?.role !== role) {
      response.status(403).json({ error: 'You do not have permission to access this resource.' });
      return;
    }

    next();
  };
}

app.post('/api/auth/register', authLimiter, async (request, response, next) => {
  try {
    const name = typeof request.body?.name === 'string' ? request.body.name.trim() : '';
    const identifier = normalizeIdentifier(request.body?.identifier);
    const password = request.body?.password;
    const classLevel = Number(request.body?.classLevel);
    const school = typeof request.body?.school === 'string' ? request.body.school.trim() : '';

    if (name.length < 2 || name.length > 100) {
      response.status(400).json({ error: 'Enter a name between 2 and 100 characters.' });
      return;
    }

    if (!identifier) {
      response.status(400).json({ error: 'Enter a valid email address or mobile number.' });
      return;
    }

    if (typeof password !== 'string' || Buffer.byteLength(password) < 10 || Buffer.byteLength(password) > 72) {
      response.status(400).json({ error: 'Password must contain 10 to 72 bytes.' });
      return;
    }

    if (!Number.isInteger(classLevel) || classLevel < 1 || classLevel > 10) {
      response.status(400).json({ error: 'Choose a class from 1 to 10.' });
      return;
    }

    if (school.length > 120) {
      response.status(400).json({ error: 'School name must be 120 characters or fewer.' });
      return;
    }

    if (findUserByIdentifier.get(identifier)) {
      response.status(409).json({ error: 'An account already exists with that email or mobile number.' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const result = database.prepare(
      'INSERT INTO users (name, identifier, password_hash, role, class_level, school) VALUES (?, ?, ?, ?, ?, ?)',
    ).run(name, identifier, passwordHash, 'student', classLevel, school || null);
    const user = findUserById.get(Number(result.lastInsertRowid));

    response.status(201).json({ user: createSession(user, response) });
  } catch (error) {
    if (error?.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      response.status(409).json({ error: 'An account already exists with that email or mobile number.' });
      return;
    }

    next(error);
  }
});

app.post('/api/auth/login', authLimiter, async (request, response) => {
  const identifier = normalizeIdentifier(request.body?.identifier);
  const password = request.body?.password;
  const requestedRole = request.body?.role;

  if (
    !identifier ||
    typeof password !== 'string' ||
    !['admin', 'student'].includes(requestedRole)
  ) {
    response.status(400).json({ error: 'Enter your account details and choose a portal.' });
    return;
  }

  const user = findUserByIdentifier.get(identifier);
  const validPassword = user
    ? await bcrypt.compare(password, user.password_hash)
    : await bcrypt.compare(password, timingDummyHash);

  if (!user || !user.active || user.role !== requestedRole || !validPassword) {
    response.status(401).json({ error: 'The email/mobile, password, or portal is incorrect.' });
    return;
  }

  response.json({ user: createSession(user, response) });
});

app.get('/api/auth/me', requireAuthentication, (request, response) => {
  response.json({ user: publicUser(request.user) });
});

app.post('/api/auth/logout', requireAuthentication, (_request, response) => {
  response.clearCookie(tokenCookie, signInCookieOptions());
  response.status(204).end();
});

app.get('/api/admin/health', requireAuthentication, requireRole('admin'), (_request, response) => {
  response.json({ status: 'ok' });
});

app.get('/api/materials', requireAuthentication, (request, response) => {
  const materials = listStudyMaterials.all()
    .filter((material) =>
      request.user.role === 'admin' ||
      (material.published && material.class_level === request.user.class_level),
    )
    .map(publicStudyMaterial);
  response.json({ materials });
});

app.get('/api/courses', requireAuthentication, (request, response) => {
  const courses = listCourses.all()
    .filter((course) => request.user.role === 'admin' || course.published)
    .map(publicCourse);
  response.json({ courses });
});

app.get('/api/course-posts', requireAuthentication, (request, response) => {
  const posts = listCoursePosts.all()
    .filter((post) => request.user.role === 'admin' || post.published)
    .map(publicCoursePost);
  response.json({ posts });
});

app.post('/api/admin/courses', requireAuthentication, requireRole('admin'), (request, response) => {
  const title = typeof request.body?.title === 'string' ? request.body.title.trim() : '';
  const department = request.body?.department;
  const program = request.body?.program;
  const duration = typeof request.body?.duration === 'string' ? request.body.duration.trim() : '';
  const description = typeof request.body?.description === 'string' ? request.body.description.trim() : '';
  const published = request.body?.published === true ? 1 : 0;
  const programsByDepartment = {
    'Computer Science': ['BCA', 'B.Tech'],
    Management: ['BBA', 'MBA'],
  };

  if (title.length < 2 || title.length > 120) {
    response.status(400).json({ error: 'Course title must be between 2 and 120 characters.' });
    return;
  }
  if (
    typeof department !== 'string' ||
    !Object.hasOwn(programsByDepartment, department) ||
    !programsByDepartment[department].includes(program)
  ) {
    response.status(400).json({ error: 'Choose a valid department and its matching program.' });
    return;
  }
  if (duration.length < 1 || duration.length > 40) {
    response.status(400).json({ error: 'Enter a course duration of up to 40 characters.' });
    return;
  }
  if (description.length > 500) {
    response.status(400).json({ error: 'Course description must be 500 characters or fewer.' });
    return;
  }

  const id = randomUUID();
  database.prepare(`
    INSERT INTO courses (id, title, department, program, duration, description, published)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, title, department, program, duration, description, published);
  response.status(201).json({ course: publicCourse(findCourseById.get(id)) });
});

app.post(
  '/api/admin/courses/:id/posts',
  requireAuthentication,
  requireRole('admin'),
  parseSinglePdf,
  async (request, response, next) => {
    let savedFilePath;
    const courseId = request.params.id;
    if (!findCourseById.get(courseId)) {
      response.status(404).json({ error: 'Course not found.' });
      return;
    }

    try {
      const postType = request.body?.postType;
      const title = typeof request.body?.title === 'string' ? request.body.title.trim() : '';
      const description = typeof request.body?.description === 'string' ? request.body.description.trim() : '';
      const resourceUrl = typeof request.body?.resourceUrl === 'string' ? request.body.resourceUrl.trim() : '';
      const published = request.body?.published === 'true' || request.body?.published === true ? 1 : 0;
      const file = request.file;

      if (!['PYQ', 'Test', 'Other'].includes(postType)) {
        response.status(400).json({ error: 'Choose PYQ, Test, or Other.' });
        return;
      }
      if (title.length < 1 || title.length > 120) {
        response.status(400).json({ error: 'Post title must be between 1 and 120 characters.' });
        return;
      }
      if (description.length > 1000) {
        response.status(400).json({ error: 'Description must be 1000 characters or fewer.' });
        return;
      }
      if (resourceUrl) {
        try {
          const parsedUrl = new URL(resourceUrl);
          if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error('Invalid protocol.');
        } catch {
          response.status(400).json({ error: 'Enter a valid HTTP or HTTPS resource link.' });
          return;
        }
      }
      if (
        file &&
        (!file.originalname.toLowerCase().endsWith('.pdf') || file.mimetype !== 'application/pdf')
      ) {
        response.status(400).json({ error: 'Choose a PDF file to upload.' });
        return;
      }
      if (file && !file.buffer.subarray(0, 5).equals(Buffer.from('%PDF-'))) {
        response.status(400).json({ error: 'This file is not a valid PDF document.' });
        return;
      }

      const id = randomUUID();
      const storageName = file ? `${id}.pdf` : null;
      if (file) {
        savedFilePath = path.join(materialsDirectory, storageName);
        await writeFile(savedFilePath, file.buffer, { flag: 'wx' });
      }

      database.prepare(`
        INSERT INTO course_posts
          (id, course_id, post_type, title, description, resource_url, file_name, storage_name, published)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        courseId,
        postType,
        title,
        description,
        resourceUrl,
        file ? path.basename(file.originalname).slice(0, 255) : null,
        storageName,
        published,
      );
      response.status(201).json({ post: publicCoursePost(findCoursePostById.get(id)) });
    } catch (error) {
      if (savedFilePath) {
        try {
          await unlink(savedFilePath);
        } catch (cleanupError) {
          if (cleanupError.code !== 'ENOENT') {
            console.error('Could not clean up an incomplete course PDF upload:', cleanupError);
          }
        }
      }
      next(error);
    }
  },
);

app.get('/api/course-posts/:id/pdf', requireAuthentication, async (request, response, next) => {
  try {
    const post = findCoursePostById.get(request.params.id);
    if (!post || !post.storage_name || (!post.published && request.user.role !== 'admin')) {
      response.status(404).json({ error: 'Course post PDF not found.' });
      return;
    }

    const filePath = path.join(materialsDirectory, post.storage_name);
    const contents = await readFile(filePath);
    response.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${post.id}.pdf"`,
      'Content-Length': String(contents.length),
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
    });
    response.send(contents);
  } catch (error) {
    if (error.code === 'ENOENT') {
      response.status(404).json({ error: 'The stored PDF could not be found.' });
      return;
    }
    next(error);
  }
});

app.delete('/api/admin/courses/:id', requireAuthentication, requireRole('admin'), (request, response) => {
  const result = database.prepare('DELETE FROM courses WHERE id = ?').run(request.params.id);
  if (result.changes === 0) {
    response.status(404).json({ error: 'Course not found.' });
    return;
  }

  response.status(204).end();
});

app.post(
  '/api/admin/materials',
  requireAuthentication,
  requireRole('admin'),
  (request, response, next) => {
    uploadPdf.single('pdf')(request, response, (error) => {
      if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
          response.status(413).json({ error: 'PDF files must be 15 MB or smaller.' });
          return;
        }
        response.status(400).json({ error: 'Choose one PDF file to upload.' });
        return;
      }
      if (error) {
        next(error);
        return;
      }

      next();
    });
  },
  async (request, response, next) => {
    let savedFilePath;

    try {
      const title = typeof request.body?.title === 'string' ? request.body.title.trim() : '';
      const subject = typeof request.body?.subject === 'string' ? request.body.subject.trim() : '';
      const chapter = typeof request.body?.chapter === 'string' ? request.body.chapter.trim() : '';
      const description = typeof request.body?.description === 'string' ? request.body.description.trim() : '';
      const classLevel = Number(request.body?.classLevel);
      const published = request.body?.published === 'true' ? 1 : 0;
      const file = request.file;

      if (title.length < 1 || title.length > 120) {
        response.status(400).json({ error: 'Title must be between 1 and 120 characters.' });
        return;
      }
      if (!Number.isInteger(classLevel) || classLevel < 1 || classLevel > 10) {
        response.status(400).json({ error: 'Choose a class from 1 to 10.' });
        return;
      }
      if (subject.length > 80 || chapter.length > 100 || description.length > 500) {
        response.status(400).json({ error: 'Subject, chapter, or description exceeds the allowed length.' });
        return;
      }
      if (!file || !file.originalname.toLowerCase().endsWith('.pdf') || file.mimetype !== 'application/pdf') {
        response.status(400).json({ error: 'Choose a PDF file to upload.' });
        return;
      }
      if (!file.buffer.subarray(0, 5).equals(Buffer.from('%PDF-'))) {
        response.status(400).json({ error: 'This file is not a valid PDF document.' });
        return;
      }

      const id = randomUUID();
      const storageName = `${id}.pdf`;
      savedFilePath = path.join(materialsDirectory, storageName);
      await writeFile(savedFilePath, file.buffer, { flag: 'wx' });

      database.prepare(`
        INSERT INTO study_materials
          (id, title, class_level, subject, chapter, description, file_name, storage_name, published)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        title,
        classLevel,
        subject || 'General',
        chapter || 'General',
        description,
        path.basename(file.originalname).slice(0, 255),
        storageName,
        published,
      );

      const material = findStudyMaterialById.get(id);
      response.status(201).json({ material: publicStudyMaterial(material) });
    } catch (error) {
      if (savedFilePath) {
        try {
          await unlink(savedFilePath);
        } catch (cleanupError) {
          if (cleanupError.code !== 'ENOENT') {
            console.error('Could not clean up an incomplete PDF upload:', cleanupError);
          }
        }
      }
      next(error);
    }
  },
);

app.get('/api/materials/:id', requireAuthentication, async (request, response, next) => {
  try {
    const material = findStudyMaterialById.get(request.params.id);
    if (!material || (!material.published && request.user.role !== 'admin')) {
      response.status(404).json({ error: 'Study material not found.' });
      return;
    }
    if (
      request.user.role === 'student' &&
      request.user.class_level !== material.class_level
    ) {
      response.status(404).json({ error: 'Study material not found.' });
      return;
    }

    const filePath = path.join(materialsDirectory, material.storage_name);
    const contents = await readFile(filePath);
    response.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${material.id}.pdf"`,
      'Content-Length': String(contents.length),
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
    });
    response.send(contents);
  } catch (error) {
    if (error.code === 'ENOENT') {
      response.status(404).json({ error: 'The stored PDF could not be found.' });
      return;
    }
    next(error);
  }
});

app.use('/api', (_request, response) => {
  response.status(404).json({ error: 'API route not found.' });
});

app.use((error, _request, response, _next) => {
  console.error('Request failed:', error);
  response.status(500).json({ error: 'The request could not be completed. Please try again.' });
});

const builtDirectory = path.join(projectDirectory, 'dist');
app.use(express.static(builtDirectory));
app.use((request, response, next) => {
  if (request.method === 'GET' && !request.path.startsWith('/api')) {
    response.sendFile(path.join(builtDirectory, 'index.html'), (error) => {
      if (error) next(error);
    });
    return;
  }

  next();
});

app.listen(port, '0.0.0.0', () => {
  console.info(`XtzStudy API listening on http://localhost:${port}`);
});
