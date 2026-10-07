import { useEffect, useMemo, useState, type FormEvent } from 'react';

type Portal = 'admin' | 'student';
type AuthUser = {
  id: number;
  name: string;
  identifier: string;
  role: Portal;
  classLevel: number | null;
  school: string | null;
};
type ContentType = 'Course' | 'Video lecture' | 'Study material' | 'Quiz / Test' | 'Assignment' | 'Announcement';

type SearchResult = {
  title: string;
  type: string;
  category: string;
  meta: string;
};

type AddedContent = {
  id: number;
  title: string;
  contentType: ContentType;
  classLevel: number;
  subject: string;
  chapter: string;
  description: string;
  resourceUrl: string;
  fileName?: string;
  published: boolean;
};

type ManagedCourse = {
  id: string;
  title: string;
  department: string;
  program: string;
  duration: string;
  description: string;
  published: boolean;
};

type CoursePost = {
  id: string;
  courseId: string;
  postType: 'PYQ' | 'Test' | 'Other';
  title: string;
  description: string;
  resourceUrl: string;
  fileName: string | null;
  pdfUrl: string;
  published: boolean;
};

type ApiResponse<T> = {
  user?: T;
  material?: T;
  materials?: T[];
  course?: T;
  courses?: T[];
  post?: T;
  posts?: T[];
  error?: string;
};

async function readApiResponse<T>(response: Response): Promise<ApiResponse<T>> {
  const responseText = await response.text();

  if (!responseText.trim()) {
    throw new Error(`The authentication service returned an empty response (HTTP ${response.status}).`);
  }

  if (!response.headers.get('content-type')?.includes('application/json')) {
    throw new Error(`The authentication service returned an unexpected response (HTTP ${response.status}).`);
  }

  try {
    return JSON.parse(responseText) as ApiResponse<T>;
  } catch {
    throw new Error('The authentication service returned invalid data. Please try again.');
  }
}

const classOptions = Array.from({ length: 10 }, (_, index) => index + 1);
const contentTypes: ContentType[] = [
  'Course',
  'Video lecture',
  'Study material',
  'Quiz / Test',
  'Assignment',
  'Announcement',
];
const programsByDepartment: Record<string, string[]> = {
  'Computer Science': ['BCA', 'B.Tech'],
  Management: ['BBA', 'MBA'],
};

const students = [
  { name: 'Aarav Sharma', className: 8, course: 'Mathematics', progress: 86, status: 'Active' },
  { name: 'Diya Verma', className: 6, course: 'Science', progress: 74, status: 'Active' },
  { name: 'Kabir Singh', className: 9, course: 'Physics', progress: 91, status: 'Active' },
  { name: 'Meher Ali', className: 5, course: 'English', progress: 62, status: 'Inactive' },
  { name: 'Rahul Nair', className: 7, course: 'Biology', progress: 77, status: 'Active' },
];

const studentProgressCards = [
  { label: 'Completion', value: '76%', accent: 'blue' },
  { label: 'Tests Taken', value: '18', accent: 'purple' },
  { label: 'Avg Score', value: '88%', accent: 'orange' },
  { label: 'Streak', value: '12 days', accent: 'green' },
];

const classSubjects: Record<number, { name: string; chapters: string[]; progress: number }[]> = {
  5: [
    { name: 'Mathematics', chapters: ['Fractions', 'Decimals', 'Geometry', 'Patterns'], progress: 82 },
    { name: 'Science', chapters: ['Plants', 'Air and Water', 'Earth', 'Forces'], progress: 74 },
    { name: 'English', chapters: ['Grammar', 'Reading Skills', 'Writing', 'Poetry'], progress: 68 },
  ],
  6: [
    { name: 'Mathematics', chapters: ['Integers', 'Ratios', 'Basic Algebra', 'Mensuration'], progress: 76 },
    { name: 'Science', chapters: ['Nutrition', 'Electricity', 'Light', 'Weather'], progress: 81 },
    { name: 'Social Studies', chapters: ['History', 'Geography', 'Civics', 'Maps'], progress: 65 },
  ],
  8: [
    { name: 'Mathematics', chapters: ['Linear Equations', 'Rational Numbers', 'Data Handling', 'Squares'], progress: 88 },
    { name: 'Science', chapters: ['Photosynthesis', 'Force and Pressure', 'Metals', 'Reproduction'], progress: 84 },
    { name: 'English', chapters: ['Grammar', 'Comprehension', 'Essay Writing', 'Literature'], progress: 79 },
  ],
};

const recentMaterials = [
  { title: 'Algebra Practice Sheet', type: 'PDF', chapter: 'Linear Equations', date: 'Today' },
  { title: 'Photosynthesis Quiz', type: 'Quiz', chapter: 'Biology', date: 'Yesterday' },
  { title: 'Geometry Video Lecture', type: 'Video', chapter: 'Math Basics', date: '2 days ago' },
  { title: 'Important Questions', type: 'Notes', chapter: 'Science', date: '3 days ago' },
];

const announcements = [
  { title: 'New Course Added', detail: 'Class 8 Mathematics basics course published.', className: 'Class 8' },
  { title: 'Mock Test Scheduled', detail: 'Science unit test on Sunday, 10:00 AM.', className: 'Class 6' },
  { title: 'Important Notice', detail: 'Revision worksheets are now live for all classes.', className: 'All classes' },
];

const upcomingTests = [
  { title: 'Fractions Mastery', subject: 'Mathematics', score: '30 marks', duration: '20 mins' },
  { title: 'Plant Life Cycle', subject: 'Science', score: '25 marks', duration: '15 mins' },
  { title: 'Reading Comprehension', subject: 'English', score: '20 marks', duration: '15 mins' },
];

const courses = [
  { title: 'Foundation Mathematics', className: 5, lessons: 18, level: 'Beginner' },
  { title: 'Science Explorer', className: 6, lessons: 22, level: 'Intermediate' },
  { title: 'Algebra Pro', className: 8, lessons: 26, level: 'Advanced' },
  { title: 'Writing Skills', className: 7, lessons: 14, level: 'Intermediate' },
];

const searchIndex: SearchResult[] = [
  { title: 'Fractions', type: 'Subject', category: 'Mathematics', meta: 'Class 5' },
  { title: 'Linear Equations', type: 'Chapter', category: 'Mathematics', meta: 'Class 8' },
  { title: 'Photosynthesis', type: 'Topic', category: 'Science', meta: 'Class 7' },
  { title: 'Algebra Practice Sheet', type: 'Notes', category: 'Study Material', meta: 'Class 8' },
  { title: 'Plant Life Cycle Quiz', type: 'Test', category: 'Assessment', meta: 'Class 6' },
  { title: 'Video Lecture: Geometry', type: 'Video', category: 'Learning', meta: 'Class 5' },
  { title: 'Science Explorer', type: 'Course', category: 'Course', meta: 'Class 6' },
];

function App() {
  const [portal, setPortal] = useState<Portal>('student');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authError, setAuthError] = useState('');
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [selectedClass, setSelectedClass] = useState<number>(8);
  const [adminClass, setAdminClass] = useState<number>(8);
  const [query, setQuery] = useState('');
  const [isContentFormOpen, setIsContentFormOpen] = useState(false);
  const [addedContent, setAddedContent] = useState<AddedContent[]>([]);
  const [contentType, setContentType] = useState<ContentType>('Study material');
  const [contentError, setContentError] = useState('');
  const [contentSubmitting, setContentSubmitting] = useState(false);
  const [managedCourses, setManagedCourses] = useState<ManagedCourse[]>([]);
  const [courseDepartment, setCourseDepartment] = useState('Computer Science');
  const [courseError, setCourseError] = useState('');
  const [courseSubmitting, setCourseSubmitting] = useState(false);
  const [coursePosts, setCoursePosts] = useState<CoursePost[]>([]);
  const [selectedCoursePost, setSelectedCoursePost] = useState<{
    course: ManagedCourse;
    postType: CoursePost['postType'];
  } | null>(null);
  const [coursePostError, setCoursePostError] = useState('');
  const [coursePostSubmitting, setCoursePostSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/auth/me', { credentials: 'include' })
      .then(async (response) => {
        if (response.status === 401) return null;
        const result = await readApiResponse<AuthUser>(response);
        if (!response.ok) throw new Error(result.error || 'Unable to verify your session.');
        return result.user as AuthUser;
      })
      .then((currentUser) => {
        if (!cancelled && currentUser) {
          setUser(currentUser);
          setPortal(currentUser.role);
          if (currentUser.classLevel) setSelectedClass(currentUser.classLevel);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setAuthError(error instanceof Error ? error.message : 'Unable to connect to the sign-in service.');
        }
      })
      .finally(() => {
        if (!cancelled) setAuthLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setAddedContent([]);
      return;
    }

    let cancelled = false;
    fetch('/api/materials', { credentials: 'include' })
      .then(async (response) => {
        const result = await readApiResponse<AddedContent>(response);
        if (!response.ok) throw new Error(result.error || 'Unable to load study materials.');
        return result.materials ?? [];
      })
      .then((materials) => {
        if (!cancelled) setAddedContent(materials);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setContentError(error instanceof Error ? error.message : 'Unable to load study materials.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!user) {
      setCoursePosts([]);
      return;
    }

    let cancelled = false;
    fetch('/api/course-posts', { credentials: 'include' })
      .then(async (response) => {
        const result = await readApiResponse<CoursePost>(response);
        if (!response.ok) throw new Error(result.error || 'Unable to load course posts.');
        return result.posts ?? [];
      })
      .then((posts) => {
        if (!cancelled) setCoursePosts(posts);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setCoursePostError(error instanceof Error ? error.message : 'Unable to load course posts.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!user) {
      setManagedCourses([]);
      return;
    }

    let cancelled = false;
    fetch('/api/courses', { credentials: 'include' })
      .then(async (response) => {
        const result = await readApiResponse<ManagedCourse>(response);
        if (!response.ok) throw new Error(result.error || 'Unable to load courses.');
        return result.courses ?? [];
      })
      .then((loadedCourses) => {
        if (!cancelled) setManagedCourses(loadedCourses);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setCourseError(error instanceof Error ? error.message : 'Unable to load courses.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  const searchResults = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return [];

    const allResults = [
      ...searchIndex,
      ...addedContent.map((item) => ({
        title: item.title,
        type: item.contentType,
        category: item.subject || item.contentType,
        meta: `Class ${item.classLevel}`,
      })),
    ];

    return allResults.filter(
      (item) =>
        item.title.toLowerCase().includes(value) ||
        item.category.toLowerCase().includes(value) ||
        item.meta.toLowerCase().includes(value),
    );
  }, [addedContent, query]);

  const subjects = classSubjects[selectedClass] ?? classSubjects[8];
  const availablePrograms = managedCourses.filter((course) => course.published);

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const endpoint = authMode === 'register' ? '/api/auth/register' : '/api/auth/login';
    const body = authMode === 'register'
      ? {
          name: String(formData.get('name') ?? ''),
          identifier: String(formData.get('identifier') ?? ''),
          password: String(formData.get('password') ?? ''),
          classLevel: Number(formData.get('classLevel')),
          school: String(formData.get('school') ?? ''),
        }
      : {
          identifier: String(formData.get('identifier') ?? ''),
          password: String(formData.get('password') ?? ''),
          role: portal,
        };

    setAuthError('');
    setAuthSubmitting(true);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await readApiResponse<AuthUser>(response);

      if (!response.ok) {
        throw new Error(result.error || 'Sign-in failed. Please try again.');
      }

      const authenticatedUser = result.user as AuthUser;
      setUser(authenticatedUser);
      setPortal(authenticatedUser.role);
      if (authenticatedUser.classLevel) setSelectedClass(authenticatedUser.classLevel);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Unable to connect to the sign-in service.');
    } finally {
      setAuthSubmitting(false);
    }
  }

  async function handleLogout() {
    setAuthError('');

    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) {
        const result = await readApiResponse<AuthUser>(response);
        throw new Error(result.error || 'Unable to sign out.');
      }
      setUser(null);
      setPortal('student');
      setAuthMode('login');
      setQuery('');
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Unable to sign out. Please try again.');
    }
  }

  async function handleAddContent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const title = String(formData.get('title') ?? '').trim();

    if (!title) return;

    setContentError('');
    setContentSubmitting(true);

    try {
      if (contentType === 'Study material') {
        formData.set('published', formData.get('published') === 'on' ? 'true' : 'false');
        const response = await fetch('/api/admin/materials', {
          method: 'POST',
          credentials: 'include',
          body: formData,
        });
        const result = await readApiResponse<AddedContent>(response);
        if (!response.ok || !result.material) {
          throw new Error(result.error || 'Unable to save this PDF study material.');
        }
        setAddedContent((current) => [result.material!, ...current]);
      } else {
        const newContent: AddedContent = {
          id: Date.now(),
          title,
          contentType,
          classLevel: Number(formData.get('classLevel')),
          subject: String(formData.get('subject') ?? '').trim(),
          chapter: String(formData.get('chapter') ?? '').trim(),
          description: String(formData.get('description') ?? '').trim(),
          resourceUrl: String(formData.get('resourceUrl') ?? '').trim(),
          published: formData.get('published') === 'on',
        };
        setAddedContent((current) => [newContent, ...current]);
      }

      setIsContentFormOpen(false);
      setContentType('Study material');
      form.reset();
    } catch (error) {
      setContentError(error instanceof Error ? error.message : 'Unable to save this content.');
    } finally {
      setContentSubmitting(false);
    }
  }

  async function handleAddCourse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const course = {
      title: String(formData.get('title') ?? '').trim(),
      department: courseDepartment,
      program: String(formData.get('program') ?? ''),
      duration: String(formData.get('duration') ?? '').trim(),
      description: String(formData.get('description') ?? '').trim(),
      published: formData.get('published') === 'on',
    };

    setCourseError('');
    setCourseSubmitting(true);

    try {
      const response = await fetch('/api/admin/courses', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(course),
      });
      const result = await readApiResponse<ManagedCourse>(response);
      if (!response.ok || !result.course) {
        throw new Error(result.error || 'Unable to save this course.');
      }

      setManagedCourses((current) => [result.course!, ...current]);
      form.reset();
    } catch (error) {
      setCourseError(error instanceof Error ? error.message : 'Unable to save this course.');
    } finally {
      setCourseSubmitting(false);
    }
  }

  async function handleDeleteCourse(course: ManagedCourse) {
    if (!window.confirm(`Delete "${course.title}"? This cannot be undone.`)) return;

    setCourseError('');
    try {
      const response = await fetch(`/api/admin/courses/${encodeURIComponent(course.id)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) {
        const result = await readApiResponse<ManagedCourse>(response);
        throw new Error(result.error || 'Unable to delete this course.');
      }

      setManagedCourses((current) => current.filter((item) => item.id !== course.id));
    } catch (error) {
      setCourseError(error instanceof Error ? error.message : 'Unable to delete this course.');
    }
  }

  async function handleAddCoursePost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCoursePost) return;

    const form = event.currentTarget;
    const formData = new FormData(form);
    const post = {
      postType: selectedCoursePost.postType,
      title: String(formData.get('title') ?? '').trim(),
      description: String(formData.get('description') ?? '').trim(),
      resourceUrl: String(formData.get('resourceUrl') ?? '').trim(),
    };

    formData.set('postType', post.postType);
    formData.set('title', post.title);
    formData.set('description', post.description);
    formData.set('resourceUrl', post.resourceUrl);
    formData.set('published', formData.get('published') === 'on' ? 'true' : 'false');
    setCoursePostError('');
    setCoursePostSubmitting(true);
    try {
      const response = await fetch(`/api/admin/courses/${encodeURIComponent(selectedCoursePost.course.id)}/posts`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      const result = await readApiResponse<CoursePost>(response);
      if (!response.ok || !result.post) {
        throw new Error(result.error || 'Unable to publish this course post.');
      }

      setCoursePosts((current) => [result.post!, ...current]);
      setSelectedCoursePost(null);
    } catch (error) {
      setCoursePostError(error instanceof Error ? error.message : 'Unable to publish this course post.');
    } finally {
      setCoursePostSubmitting(false);
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-wrap">
          <div className="brand-mark">X</div>
          <div>
            <div className="brand-name">XtzStudy</div>
            <div className="brand-tag">smart learning for every child</div>
          </div>
        </div>

        {user ? (
          <div className="account-controls">
            <span className="account-name">{user.name} · {user.role === 'admin' ? 'Admin' : `Class ${user.classLevel}`}</span>
            <button type="button" className="secondary-button" onClick={handleLogout}>Sign out</button>
          </div>
        ) : (
          <div className="portal-toggle" aria-label="Choose portal">
            <button
              type="button"
              className={portal === 'admin' ? 'active' : ''}
              onClick={() => {
                setPortal('admin');
                setAuthMode('login');
                setAuthError('');
              }}
            >
              Admin Portal
            </button>
            <button
              type="button"
              className={portal === 'student' ? 'active' : ''}
              onClick={() => {
                setPortal('student');
                setAuthMode('login');
                setAuthError('');
              }}
            >
              Student Portal
            </button>
          </div>
        )}

        {user && (
          <label className="search-box" aria-label="Search learning content">
            <span>⌕</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search fractions, notes, tests..."
            />
          </label>
        )}
      </header>

      {user && query && (
        <section className="search-panel">
          <div className="panel-header">
            <h3>Search Results for “{query}”</h3>
            <span>{searchResults.length} results</span>
          </div>
          <div className="search-results">
            {searchResults.length > 0 ? (
              searchResults.map((item) => (
                <div className="search-item" key={`${item.title}-${item.type}`}>
                  <div className="pill">{item.type}</div>
                  <div>
                    <strong>{item.title}</strong>
                    <p>
                      {item.category} · {item.meta}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p>No matching content found. Try another keyword like “fractions” or “science”.</p>
            )}
          </div>
        </section>
      )}

      {authLoading ? (
        <main className="auth-loading" aria-live="polite">Checking your secure session…</main>
      ) : !user ? (
        <main className="auth-page">
          <section className="auth-intro">
            <p className="eyebrow">Class 1–10 learning space</p>
            <h1>Learning starts with one small step.</h1>
            <p>Sign in to continue your learning journey or create a student account to get started.</p>
            <div className="auth-benefits">
              <span><b>01</b> Class-based learning</span>
              <span><b>02</b> Lessons, notes, and practice</span>
              <span><b>03</b> Progress that keeps you motivated</span>
            </div>
          </section>

          <section className="auth-card">
            <p className="eyebrow">{portal === 'admin' ? 'Administrator access' : 'Student portal'}</p>
            <h2>
              {authMode === 'register'
                ? 'Create your student account'
                : `Sign in to the ${portal} portal`}
            </h2>
            <p className="auth-description">
              {authMode === 'register'
                ? 'Your account will be linked to your selected class.'
                : 'Use the email address or mobile number linked to your account.'}
            </p>

            {authError && <div className="auth-error" role="alert">{authError}</div>}

            <form className="auth-form" onSubmit={handleAuthSubmit}>
              {authMode === 'register' && (
                <>
                  <label>
                    Student name
                    <input name="name" required minLength={2} maxLength={100} autoComplete="name" placeholder="Your full name" />
                  </label>
                  <div className="form-row">
                    <label>
                      Class
                      <select name="classLevel" defaultValue="8">
                        {classOptions.map((value) => (
                          <option key={value} value={value}>Class {value}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      School <span className="optional-label">(optional)</span>
                      <input name="school" maxLength={120} autoComplete="organization" placeholder="School name" />
                    </label>
                  </div>
                </>
              )}

              <label>
                {portal === 'admin' ? 'Admin email' : 'Email or mobile number'}
                <input
                  name="identifier"
                  type="text"
                  required
                  maxLength={254}
                  autoComplete="username"
                  placeholder={portal === 'admin' ? 'admin@example.com' : 'you@example.com or mobile'}
                />
              </label>

              <label>
                Password
                <input
                  name="password"
                  type="password"
                  required
                  minLength={authMode === 'register' ? 10 : undefined}
                  maxLength={72}
                  autoComplete={authMode === 'register' ? 'new-password' : 'current-password'}
                  placeholder={authMode === 'register' ? 'At least 10 characters' : 'Enter your password'}
                />
              </label>

              <button type="submit" className="primary-button auth-submit" disabled={authSubmitting}>
                {authSubmitting
                  ? 'Please wait…'
                  : authMode === 'register'
                    ? 'Create student account'
                    : 'Sign in'}
              </button>
            </form>

            {portal === 'student' ? (
              <p className="auth-switch">
                {authMode === 'register' ? 'Already have an account?' : 'New to XtzStudy?'}
                {' '}
                <button
                  type="button"
                  onClick={() => {
                    setAuthError('');
                    setAuthMode(authMode === 'register' ? 'login' : 'register');
                  }}
                >
                  {authMode === 'register' ? 'Sign in' : 'Create an account'}
                </button>
              </p>
            ) : (
              <p className="auth-admin-note">Admin access is provisioned by the platform owner.</p>
            )}
          </section>
        </main>
      ) : user.role === 'admin' ? (
        <div className="admin-layout">
          <aside className="sidebar">
            <div className="sidebar-header">Admin Hub</div>
            {[
              'Dashboard',
              'Students',
              'Classes',
              'Subjects',
              'Courses',
              'Chapters',
              'Videos',
              'Study Materials',
              'Quizzes',
              'Tests',
              'Assignments',
              'Announcements',
              'Results',
              'Progress',
              'Settings',
              'Logout',
            ].map((item) => (
              <button
                key={item}
                type="button"
                className={item === 'Dashboard' ? 'nav-item active' : 'nav-item'}
                onClick={() => {
                  if (item === 'Logout') {
                    void handleLogout();
                  } else if (item === 'Courses') {
                    document.getElementById('course-management')?.scrollIntoView({ behavior: 'smooth' });
                  }
                }}
              >
                {item}
              </button>
            ))}
          </aside>

          <main className="dashboard-main">
            <section className="page-header">
              <div>
                <p className="eyebrow">Admin dashboard</p>
                <h1>Learning ecosystem overview</h1>
              </div>
              <button
                type="button"
                className="primary-button"
                onClick={() => {
                  setContentError('');
                  setIsContentFormOpen(true);
                }}
              >
                + Add new content
              </button>
            </section>
            {contentError && <div className="auth-error" role="alert">{contentError}</div>}

            {addedContent.length > 0 && (
              <section className="panel">
                <div className="panel-header">
                  <h3>Recently added content</h3>
                  <span>{addedContent.length} item{addedContent.length === 1 ? '' : 's'}</span>
                </div>
                <div className="added-content-list">
                  {addedContent.map((item) => (
                    <article className="added-content-item" key={item.id}>
                      <div className="resource-icon">{item.contentType.slice(0, 1)}</div>
                      <div className="added-content-details">
                        <strong>{item.title}</strong>
                        <p>
                          {item.contentType} · Class {item.classLevel}
                          {item.subject && ` · ${item.subject}`}
                          {item.chapter && ` · ${item.chapter}`}
                        </p>
                        {item.description && <p>{item.description}</p>}
                        {item.resourceUrl && (
                          <a className="pdf-link" href={item.resourceUrl} target="_blank" rel="noreferrer">
                            View PDF · {item.fileName}
                          </a>
                        )}
                      </div>
                      <span className={item.published ? 'badge success' : 'badge warning'}>
                        {item.published ? 'Published' : 'Draft'}
                      </span>
                    </article>
                  ))}
                </div>
              </section>
            )}

            <section className="card-grid two-col">
              <article className="panel">
                <div className="panel-header">
                  <h3>Class coverage</h3>
                  <label className="class-select-label">
                    <span>Select class</span>
                    <select
                      value={adminClass}
                      onChange={(event) => setAdminClass(Number(event.target.value))}
                    >
                      {classOptions.map((value) => (
                        <option key={value} value={value}>Class {value}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="class-coverage-single">
                  <div className="class-box active">Class {adminClass}</div>
                </div>
                <button
                  type="button"
                  className="primary-button post-course-button"
                  onClick={() => {
                    document.getElementById('course-management')?.scrollIntoView({ behavior: 'smooth' });
                    window.setTimeout(() => {
                      document.getElementById('course-title')?.focus();
                    }, 350);
                  }}
                >
                  + Post a course
                </button>
              </article>

              <article className="panel">
                <div className="panel-header">
                  <h3>Student activity</h3>
                  <span>Weekly</span>
                </div>
                <div className="chart-bars" aria-label="Student activity chart">
                  {[38, 52, 70, 46, 78, 82, 67].map((bar, index) => (
                    <div key={index} className="bar-column">
                      <span style={{ height: `${bar}%` }} />
                    </div>
                  ))}
                </div>
              </article>
            </section>

            <section id="course-management" className="panel course-management">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Course portal</p>
                  <h3>Manage degree courses</h3>
                </div>
                <span>CS and Management departments</span>
              </div>
              <div className="course-management-grid">
                <form className="course-form" onSubmit={handleAddCourse}>
                  <label>
                    Department
                    <select
                      value={courseDepartment}
                      onChange={(event) => setCourseDepartment(event.target.value)}
                    >
                      <option value="Computer Science">Computer Science</option>
                      <option value="Management">Management</option>
                    </select>
                  </label>
                  <div className="form-row">
                    <label>
                      Program
                      <select name="program" key={courseDepartment}>
                        {programsByDepartment[courseDepartment].map((program) => (
                          <option key={program} value={program}>{program}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Duration
                      <input name="duration" required maxLength={40} defaultValue="3 years" />
                    </label>
                  </div>
                  <label>
                    Course title
                    <input id="course-title" name="title" required minLength={2} maxLength={120} placeholder="e.g. Bachelor of Computer Applications" />
                  </label>
                  <label>
                    Description
                    <textarea name="description" rows={3} maxLength={500} placeholder="Course overview and learning outcomes" />
                  </label>
                  <label className="course-publish-option">
                    <input type="checkbox" name="published" defaultChecked />
                    Publish course for students
                  </label>
                  {courseError && <div className="auth-error" role="alert">{courseError}</div>}
                  <button type="submit" className="primary-button" disabled={courseSubmitting}>
                    {courseSubmitting ? 'Saving…' : '+ Add course'}
                  </button>
                </form>

                <div className="managed-course-list">
                  <h4>Available programs</h4>
                  {courseError && <div className="auth-error" role="alert">{courseError}</div>}
                  {coursePostError && <div className="auth-error" role="alert">{coursePostError}</div>}
                  {managedCourses.length === 0 ? (
                    <p className="empty-course-message">No courses added yet. Add BCA, B.Tech, BBA, or MBA to get started.</p>
                  ) : (
                    managedCourses.map((course) => (
                      <article className="managed-course-card" key={course.id}>
                        <div className="managed-course-mark">{course.program}</div>
                        <div className="managed-course-info">
                          <strong>{course.title}</strong>
                          <p>{course.department} · {course.program} · {course.duration}</p>
                          {course.description && <p>{course.description}</p>}
                          <div className="course-post-actions">
                            {(['PYQ', 'Test', 'Other'] as const).map((postType) => (
                              <button
                                key={postType}
                                type="button"
                                className="course-post-button"
                                onClick={() => {
                                  setCoursePostError('');
                                  setSelectedCoursePost({ course, postType });
                                }}
                              >
                                + Post {postType}
                              </button>
                            ))}
                          </div>
                          {coursePosts
                            .filter((post) => post.courseId === course.id)
                            .map((post) => (
                              <div className="course-post-item" key={post.id}>
                                <span className="pill">{post.postType}</span>
                                <span className="course-post-title">{post.title}</span>
                                <span className={post.published ? 'badge success' : 'badge warning'}>
                                  {post.published ? 'Published' : 'Draft'}
                                </span>
                                {post.resourceUrl && (
                                  <a href={post.resourceUrl} target="_blank" rel="noreferrer">Open</a>
                                )}
                                {post.pdfUrl && (
                                  <a href={post.pdfUrl} target="_blank" rel="noreferrer">PDF</a>
                                )}
                              </div>
                            ))}
                        </div>
                        <div className="managed-course-actions">
                          <span className={course.published ? 'badge success' : 'badge warning'}>
                            {course.published ? 'Published' : 'Draft'}
                          </span>
                          <button
                            type="button"
                            className="delete-course-button"
                            onClick={() => void handleDeleteCourse(course)}
                            aria-label={`Delete ${course.title}`}
                          >
                            Delete
                          </button>
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </div>
            </section>

            <section className="card-grid two-col">
              <article className="panel">
                <div className="panel-header">
                  <h3>Students</h3>
                  <button type="button" className="text-button">Manage</button>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Class</th>
                        <th>Course</th>
                        <th>Progress</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((student) => (
                        <tr key={student.name}>
                          <td>{student.name}</td>
                          <td>Class {student.className}</td>
                          <td>{student.course}</td>
                          <td>
                            <div className="mini-progress">
                              <span style={{ width: `${student.progress}%` }} />
                            </div>
                            {student.progress}%
                          </td>
                          <td>
                            <span className={student.status === 'Active' ? 'badge success' : 'badge warning'}>
                              {student.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>

              <article className="panel">
                <div className="panel-header">
                  <h3>Announcements</h3>
                  <button type="button" className="text-button">View all</button>
                </div>
                <div className="announcement-list">
                  {announcements.map((item) => (
                    <div key={item.title} className="announcement-item">
                      <div className="bullet" />
                      <div>
                        <strong>{item.title}</strong>
                        <p>{item.detail}</p>
                        <small>{item.className}</small>
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            </section>
          </main>
        </div>
      ) : (
        <main className="student-page">
          <section className="hero-panel">
            <div>
              <p className="eyebrow">Welcome back, {user.name}</p>
              <h1>Learn. Practice. Improve.</h1>
              <p>
                Your class {user.classLevel} learning journey is ready. Continue with Math, Science, and English today.
              </p>
              <div className="cta-row">
                <button type="button" className="primary-button">Continue Learning</button>
                <button type="button" className="secondary-button">View timetable</button>
              </div>
            </div>
            <div className="hero-visual">
              <div className="ring ring-one" />
              <div className="ring ring-two" />
              <div className="hero-card">
                <span>My Class</span>
                <strong>Class {user.classLevel}</strong>
                <small>12 learning goals</small>
              </div>
            </div>
          </section>

          <section className="class-selector">
            {classOptions.map((value) => (
              <button
                key={value}
                type="button"
                className={selectedClass === value ? 'chip active' : 'chip'}
                onClick={() => setSelectedClass(value)}
              >
                Class {value}
              </button>
            ))}
          </section>

          <section className="stats-grid student-grid">
            {studentProgressCards.map((card) => (
              <article className={`mini-stat ${card.accent}`} key={card.label}>
                <span>{card.label}</span>
                <strong>{card.value}</strong>
              </article>
            ))}
          </section>

          <section className="student-grid two-col">
            <article className="panel learning-panel">
              <div className="panel-header">
                <h3>My Subjects</h3>
                <span>Selected: Class {selectedClass}</span>
              </div>
              <div className="subject-stack">
                {subjects.map((subject) => (
                  <div key={subject.name} className="subject-card">
                    <div className="subject-header">
                      <h4>{subject.name}</h4>
                      <span>{subject.progress}%</span>
                    </div>
                    <div className="mini-progress">
                      <span style={{ width: `${subject.progress}%` }} />
                    </div>
                    <ul>
                      {subject.chapters.map((chapter) => (
                        <li key={chapter}>{chapter}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </article>

            <article className="panel">
              <div className="panel-header">
                <h3>Upcoming Tests</h3>
                <span>3 scheduled</span>
              </div>
              <div className="test-list">
                {upcomingTests.map((test) => (
                  <div key={test.title} className="test-item">
                    <div className="calendar-dot" />
                    <div>
                      <strong>{test.title}</strong>
                      <p>
                        {test.subject} · {test.score} · {test.duration}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          </section>

          <section className="student-grid two-col">
            <article className="panel">
              <div className="panel-header">
                <h3>Continue Learning</h3>
                <button type="button" className="text-button">Open</button>
              </div>
              <div className="resource-list">
                {recentMaterials.map((item) => (
                  <div key={item.title} className="resource-item">
                    <div className="resource-icon">{item.type.slice(0, 1)}</div>
                    <div>
                      <strong>{item.title}</strong>
                      <p>
                        {item.chapter} · {item.date}
                      </p>
                    </div>
                  </div>
                ))}
                {addedContent
                  .filter((item) => item.published && item.classLevel === user.classLevel)
                  .map((item) => (
                    <div className="resource-item" key={item.id}>
                      <div className="resource-icon">PDF</div>
                      <div>
                        <strong>{item.title}</strong>
                        <p>{item.subject} · {item.chapter}</p>
                        <a className="pdf-link" href={item.resourceUrl} target="_blank" rel="noreferrer">
                          Open PDF · {item.fileName}
                        </a>
                      </div>
                    </div>
                  ))}
              </div>
            </article>

            <article className="panel">
              <div className="panel-header">
                <h3>Notifications</h3>
                <span>4 new</span>
              </div>
              <div className="announcement-list">
                {announcements.map((item) => (
                  <div key={item.title} className="announcement-item">
                    <div className="bullet" />
                    <div>
                      <strong>{item.title}</strong>
                      <p>{item.detail}</p>
                      <small>{item.className}</small>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          </section>

          <section className="panel program-catalog">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Course portal</p>
                <h3>Available Programs</h3>
              </div>
              <span>Courses and resources from your departments</span>
            </div>
            {availablePrograms.length === 0 ? (
              <p className="empty-course-message">No programs have been published yet.</p>
            ) : (
              <div className="course-grid">
                {availablePrograms.map((course) => (
                    <article className="program-card" key={course.id}>
                      <div className="managed-course-mark">{course.program}</div>
                      <div className="managed-course-info">
                        <strong>{course.title}</strong>
                        <p>{course.department} · {course.program} · {course.duration}</p>
                        {course.description && <p>{course.description}</p>}
                        <div className="student-course-posts">
                          {coursePosts
                            .filter((post) => post.courseId === course.id && post.published)
                            .map((post) => (
                              <div className="student-course-post" key={post.id}>
                                <span className="pill">{post.postType}</span>
                                <span>{post.title}</span>
                                {post.description && <small>{post.description}</small>}
                                {post.resourceUrl && (
                                  <a href={post.resourceUrl} target="_blank" rel="noreferrer">Open resource</a>
                                )}
                                {post.pdfUrl && (
                                  <a href={post.pdfUrl} target="_blank" rel="noreferrer">Open PDF · {post.fileName}</a>
                                )}
                              </div>
                            ))}
                        </div>
                      </div>
                    </article>
                  ))}
              </div>
            )}
          </section>

          <section className="panel">
            <div className="panel-header">
              <h3>Recommended courses</h3>
              <span>Tailored for your progress</span>
            </div>
            <div className="course-grid">
              {courses.map((course) => (
                <div key={course.title} className="course-card">
                  <div className="course-icon">🎓</div>
                  <div>
                    <strong>{course.title}</strong>
                    <p>
                      Class {course.className} · {course.lessons} lessons
                    </p>
                    <small>{course.level}</small>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </main>
      )}

      {selectedCoursePost && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedCoursePost(null);
          }}
        >
          <section
            className="content-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="course-post-title"
          >
            <div className="modal-header">
              <div>
                <p className="eyebrow">{selectedCoursePost.course.program} · {selectedCoursePost.course.title}</p>
                <h2 id="course-post-title">Post {selectedCoursePost.postType}</h2>
              </div>
              <button
                type="button"
                className="modal-close"
                aria-label="Close form"
                onClick={() => setSelectedCoursePost(null)}
              >
                ×
              </button>
            </div>

            <form className="content-form" onSubmit={handleAddCoursePost}>
              <label>
                {selectedCoursePost.postType} title
                <input name="title" required maxLength={120} placeholder={`e.g. ${selectedCoursePost.postType} 2025`} />
              </label>
              <label>
                Description
                <textarea name="description" rows={3} maxLength={1000} placeholder="Add instructions or details for students" />
              </label>
              <label>
                Resource link <span className="optional-label">(optional)</span>
                <input name="resourceUrl" type="url" maxLength={2048} placeholder="https://..." />
              </label>
              <label className="pdf-upload-field">
                PDF file <span className="optional-label">(optional)</span>
                <input name="pdf" type="file" accept="application/pdf,.pdf" />
                <small>Upload a PDF up to 15 MB. Leave blank to post a link or description only.</small>
              </label>
              <label className="publish-option">
                <input type="checkbox" name="published" defaultChecked />
                <span>
                  <strong>Publish now</strong>
                  <small>Published posts are visible to students in this program.</small>
                </span>
              </label>
              {coursePostError && <div className="auth-error" role="alert">{coursePostError}</div>}
              <div className="modal-actions">
                <button type="button" className="secondary-button" onClick={() => setSelectedCoursePost(null)}>
                  Cancel
                </button>
                <button type="submit" className="primary-button" disabled={coursePostSubmitting}>
                  {coursePostSubmitting ? 'Posting…' : `Post ${selectedCoursePost.postType}`}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {isContentFormOpen && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsContentFormOpen(false);
          }}
        >
          <section
            className="content-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="content-modal-title"
          >
            <div className="modal-header">
              <div>
                <p className="eyebrow">Content management</p>
                <h2 id="content-modal-title">Add new content</h2>
              </div>
              <button
                type="button"
                className="modal-close"
                aria-label="Close form"
                onClick={() => setIsContentFormOpen(false)}
              >
                ×
              </button>
            </div>

            <form className="content-form" onSubmit={handleAddContent}>
              <label>
                Content type
                <select
                  name="contentType"
                  value={contentType}
                  onChange={(event) => setContentType(event.target.value as ContentType)}
                >
                  {contentTypes.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </label>

              <label>
                Title
                <input name="title" required maxLength={120} placeholder="e.g. Fractions practice worksheet" />
              </label>

              <div className="form-row">
                <label>
                  Class
                  <select name="classLevel" defaultValue="8">
                    {classOptions.map((value) => (
                      <option key={value} value={value}>Class {value}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Subject
                  <input name="subject" maxLength={80} placeholder="e.g. Mathematics" />
                </label>
              </div>

              <label>
                Chapter or topic
                <input name="chapter" maxLength={100} placeholder="e.g. Linear Equations" />
              </label>

              <label>
                Description
                <textarea name="description" rows={3} maxLength={500} placeholder="What will students learn from this content?" />
              </label>

              {contentType === 'Study material' && (
                <label className="pdf-upload-field">
                  PDF file
                  <input
                    name="pdf"
                    type="file"
                    accept="application/pdf,.pdf"
                    required
                  />
                  <small>Choose a PDF up to 15 MB. Other file types are not accepted.</small>
                </label>
              )}

              <label>
                Resource URL <span className="optional-label">(optional)</span>
                <input
                  name="resourceUrl"
                  type="url"
                  maxLength={2048}
                  placeholder="Paste an authorized video or hosted material link"
                />
              </label>

              <label className="publish-option">
                <input type="checkbox" name="published" defaultChecked />
                <span>
                  <strong>Publish now</strong>
                  <small>Published content is visible to students. Leave unchecked to save as a draft.</small>
                </span>
              </label>

              <div className="modal-actions">
                <button type="button" className="secondary-button" onClick={() => setIsContentFormOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="primary-button" disabled={contentSubmitting}>
                  {contentSubmitting ? 'Uploading…' : 'Save content'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

export default App;
