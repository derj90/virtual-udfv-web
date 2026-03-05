const express = require('express');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

// Load .env manually (no dotenv dependency needed)
try {
  const envFile = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
  envFile.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const [key, ...rest] = trimmed.split('=');
    if (key && rest.length) process.env[key.trim()] = rest.join('=').trim();
  });
} catch (e) { /* .env optional if vars set externally */ }

const app = express();
app.use(express.json());
const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

// --- Moodle platforms config ---
const PLATFORMS = [
  {
    id: 'evirtual',
    name: 'eVirtual',
    description: 'Formación continua y diplomados',
    url: process.env.MOODLE_EVIRTUAL_URL,
    token: process.env.MOODLE_EVIRTUAL_TOKEN,
    color: '#0033A1'
  },
  {
    id: 'practica',
    name: 'Práctica',
    description: 'Experimentación pedagógica',
    url: process.env.MOODLE_PRACTICA_URL,
    token: process.env.MOODLE_PRACTICA_TOKEN,
    color: '#E9511D'
  },
  {
    id: 'virtual',
    name: 'Virtual',
    description: 'Apoyo a la docencia presencial',
    url: process.env.MOODLE_VIRTUAL_URL,
    token: process.env.MOODLE_VIRTUAL_TOKEN,
    color: '#003F6E'
  },
  {
    id: 'pregrado',
    name: 'Pregrado',
    description: 'Carreras de pregrado',
    url: process.env.MOODLE_PREGRADO_URL,
    token: process.env.MOODLE_PREGRADO_TOKEN,
    color: '#127C29'
  },
  {
    id: 'postgrado',
    name: 'Postgrado',
    description: 'Magíster y diplomados de postgrado',
    url: process.env.MOODLE_POSTGRADO_URL,
    token: process.env.MOODLE_POSTGRADO_TOKEN,
    color: '#90120D'
  }
];

// --- Session token helpers ---
function createToken(username, email) {
  const payload = `${username}|${email}|${Date.now()}`;
  const hmac = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');
  return Buffer.from(`${payload}|${hmac}`).toString('base64');
}

function verifyToken(token) {
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf8');
    const parts = decoded.split('|');
    if (parts.length !== 4) return null;
    const [username, email, timestamp, hmac] = parts;
    const expected = crypto.createHmac('sha256', SESSION_SECRET).update(`${username}|${email}|${timestamp}`).digest('hex');
    if (hmac !== expected) return null;
    // Token valid for 24h
    if (Date.now() - parseInt(timestamp) > 24 * 60 * 60 * 1000) return null;
    return { username, email };
  } catch { return null; }
}

// --- Moodle API helper ---
async function moodleCall(platform, wsfunction, params = {}) {
  const url = new URL('/webservice/rest/server.php', platform.url);
  const body = new URLSearchParams({
    wstoken: platform.token,
    wsfunction,
    moodlewsrestformat: 'json',
    ...params
  });

  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
    signal: AbortSignal.timeout(10000)
  });

  const data = await res.json();
  if (data.exception) throw new Error(`${platform.id}: ${data.message}`);
  return data;
}

// --- Validate credentials against Moodle login/token.php ---
async function validateMoodleLogin(platform, username, password) {
  const url = new URL('/login/token.php', platform.url);
  const body = new URLSearchParams({
    username,
    password,
    service: 'moodle_mobile_app'
  });

  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
    signal: AbortSignal.timeout(10000)
  });

  const data = await res.json();
  // Success returns { token: "xxx" }, failure returns { error: "...", errorcode: "..." }
  return !data.error && data.token;
}

// --- Find user by username in a platform ---
async function findUserByUsername(platform, username) {
  const users = await moodleCall(platform, 'core_user_get_users', {
    'criteria[0][key]': 'username',
    'criteria[0][value]': username
  });
  return users.users && users.users.length > 0 ? users.users[0] : null;
}

// --- Get enrolled courses for a user ---
async function getUserCourses(platform, userId) {
  return moodleCall(platform, 'core_enrol_get_users_courses', { userid: userId });
}

// --- Filter and enrich courses (2026 only, active) ---
const YEAR_2026_START = new Date('2026-01-01T00:00:00Z').getTime() / 1000;
const YEAR_2027_START = new Date('2027-01-01T00:00:00Z').getTime() / 1000;

function enrichCourse(c, platform) {
  return {
    id: c.id,
    fullname: c.fullname,
    shortname: c.shortname,
    summary: (c.summary || '').replace(/<[^>]*>/g, '').substring(0, 200),
    startdate: c.startdate ? new Date(c.startdate * 1000).toISOString().split('T')[0] : null,
    enddate: c.enddate && c.enddate > 0 ? new Date(c.enddate * 1000).toISOString().split('T')[0] : null,
    year: c.startdate ? new Date(c.startdate * 1000).getFullYear() : null,
    progress: c.progress != null ? Math.round(c.progress) : null,
    courseUrl: `${platform.url}/course/view.php?id=${c.id}`,
    platform: { id: platform.id, name: platform.name, color: platform.color, url: platform.url }
  };
}

function isActive2026(c) {
  const start = c.startdate || 0;
  const end = c.enddate || 0;
  if (start >= YEAR_2027_START) return false;
  if (end > 0 && end < YEAR_2026_START) return false;
  return true;
}

function filterAndEnrich(courses, platform) {
  return courses.filter(c => c.visible && isActive2026(c)).map(c => enrichCourse(c, platform));
}

function filterHistorical(courses, platform) {
  return courses.filter(c => c.visible && !isActive2026(c)).map(c => enrichCourse(c, platform));
}

// --- Static files ---
app.use(express.static(path.join(__dirname, 'public')));

// --- API: Login with Moodle credentials ---
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Se requiere usuario y contraseña' });
  }

  // Try to authenticate against all 5 platforms in parallel
  const authResults = await Promise.all(
    PLATFORMS.map(async (platform) => {
      try {
        const valid = await validateMoodleLogin(platform, username, password);
        return { platform: platform.id, valid };
      } catch {
        return { platform: platform.id, valid: false };
      }
    })
  );

  const authenticated = authResults.some(r => r.valid);
  if (!authenticated) {
    return res.status(401).json({ error: 'Credenciales inválidas. Verifica tu usuario y contraseña de Moodle.' });
  }

  // User authenticated — get their info and courses from all platforms
  const platformResults = await Promise.all(
    PLATFORMS.map(async (platform) => {
      try {
        const user = await findUserByUsername(platform, username);
        if (!user) return { platform: platform.id, platformName: platform.name, platformColor: platform.color, courses: [], found: false };

        const courses = await getUserCourses(platform, user.id);
        const filtered = filterAndEnrich(courses, platform);

        return {
          platform: platform.id,
          platformName: platform.name,
          platformColor: platform.color,
          platformUrl: platform.url,
          userName: user.fullname,
          userEmail: user.email,
          courses: filtered,
          found: true
        };
      } catch (err) {
        return { platform: platform.id, platformName: platform.name, platformColor: platform.color, error: err.message, courses: [], found: false };
      }
    })
  );

  const userName = platformResults.find(r => r.userName)?.userName || username;
  const userEmail = platformResults.find(r => r.userEmail)?.userEmail || '';
  const totalCourses = platformResults.reduce((sum, r) => sum + r.courses.length, 0);

  // Create session token
  const token = createToken(username, userEmail);

  res.json({
    authenticated: true,
    token,
    userName,
    userEmail,
    username,
    totalCourses,
    platforms: platformResults
  });
});

// --- API: Refresh courses (with token) ---
app.get('/api/mis-cursos', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Sesión no válida. Inicia sesión nuevamente.' });
  }

  const session = verifyToken(authHeader.slice(7));
  if (!session) {
    return res.status(401).json({ error: 'Sesión expirada. Inicia sesión nuevamente.' });
  }

  const { username } = session;

  const platformResults = await Promise.all(
    PLATFORMS.map(async (platform) => {
      try {
        const user = await findUserByUsername(platform, username);
        if (!user) return { platform: platform.id, platformName: platform.name, platformColor: platform.color, courses: [], found: false };

        const courses = await getUserCourses(platform, user.id);
        const filtered = filterAndEnrich(courses, platform);

        return {
          platform: platform.id,
          platformName: platform.name,
          platformColor: platform.color,
          platformUrl: platform.url,
          userName: user.fullname,
          courses: filtered,
          found: true
        };
      } catch (err) {
        return { platform: platform.id, platformName: platform.name, platformColor: platform.color, error: err.message, courses: [], found: false };
      }
    })
  );

  const totalCourses = platformResults.reduce((sum, r) => sum + r.courses.length, 0);
  const userName = platformResults.find(r => r.userName)?.userName || username;

  res.json({ userName, username, totalCourses, platforms: platformResults });
});

// --- API: Historical courses (lazy, on demand) ---
app.get('/api/historial', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Sesión no válida.' });
  }

  const session = verifyToken(authHeader.slice(7));
  if (!session) {
    return res.status(401).json({ error: 'Sesión expirada.' });
  }

  const { username } = session;

  const platformResults = await Promise.all(
    PLATFORMS.map(async (platform) => {
      try {
        const user = await findUserByUsername(platform, username);
        if (!user) return { platform: platform.id, platformName: platform.name, platformColor: platform.color, courses: [], found: false };

        const courses = await getUserCourses(platform, user.id);
        const historical = filterHistorical(courses, platform);

        return {
          platform: platform.id,
          platformName: platform.name,
          platformColor: platform.color,
          courses: historical,
          found: true
        };
      } catch (err) {
        return { platform: platform.id, platformName: platform.name, platformColor: platform.color, error: err.message, courses: [], found: false };
      }
    })
  );

  const allHistorical = platformResults.flatMap(p => p.courses);
  const years = [...new Set(allHistorical.map(c => c.year).filter(Boolean))].sort((a, b) => b - a);

  res.json({
    totalCourses: allHistorical.length,
    years,
    platforms: platformResults
  });
});

// --- API: Health check ---
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    platforms: PLATFORMS.map(p => ({ id: p.id, name: p.name, url: p.url })),
    timestamp: new Date().toISOString()
  });
});

// --- SPA fallback ---
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`virtual.udfv.cloud running on port ${PORT}`);
  console.log(`Platforms configured: ${PLATFORMS.map(p => p.id).join(', ')}`);
});
