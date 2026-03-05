const express = require('express');
const path = require('path');

// Load .env manually (no dotenv dependency needed)
const fs = require('fs');
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
const PORT = process.env.PORT || 3000;

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
    signal: AbortSignal.timeout(10000) // 10s timeout per platform
  });

  const data = await res.json();
  if (data.exception) throw new Error(`${platform.id}: ${data.message}`);
  return data;
}

// --- Find user by email in a platform ---
async function findUser(platform, email) {
  const users = await moodleCall(platform, 'core_user_get_users', {
    'criteria[0][key]': 'email',
    'criteria[0][value]': email
  });
  return users.users && users.users.length > 0 ? users.users[0] : null;
}

// --- Get enrolled courses for a user ---
async function getUserCourses(platform, userId) {
  const courses = await moodleCall(platform, 'core_enrol_get_users_courses', {
    userid: userId
  });
  return courses;
}

// --- Static files ---
app.use(express.static(path.join(__dirname, 'public')));

// --- API: Get courses for a user across all platforms ---
app.get('/api/mis-cursos', async (req, res) => {
  const email = req.query.email;

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Se requiere un email válido' });
  }

  // Restrict to @umce.cl domain
  if (!email.toLowerCase().endsWith('@umce.cl')) {
    return res.status(403).json({ error: 'Solo se permiten correos @umce.cl' });
  }

  const results = [];

  // Query all 5 platforms in parallel
  const promises = PLATFORMS.map(async (platform) => {
    try {
      const user = await findUser(platform, email);
      if (!user) return { platform: platform.id, courses: [], found: false };

      const courses = await getUserCourses(platform, user.id);

      // Filter visible courses and enrich with platform info
      const enriched = courses
        .filter(c => c.visible)
        .map(c => ({
          id: c.id,
          fullname: c.fullname,
          shortname: c.shortname,
          summary: (c.summary || '').replace(/<[^>]*>/g, '').substring(0, 200),
          startdate: c.startdate ? new Date(c.startdate * 1000).toISOString().split('T')[0] : null,
          enddate: c.enddate && c.enddate > 0 ? new Date(c.enddate * 1000).toISOString().split('T')[0] : null,
          progress: c.progress != null ? Math.round(c.progress) : null,
          courseUrl: `${platform.url}/course/view.php?id=${c.id}`,
          platform: {
            id: platform.id,
            name: platform.name,
            color: platform.color,
            url: platform.url
          }
        }));

      return {
        platform: platform.id,
        platformName: platform.name,
        platformColor: platform.color,
        userName: user.fullname,
        courses: enriched,
        found: true
      };
    } catch (err) {
      return {
        platform: platform.id,
        platformName: platform.name,
        error: err.message,
        courses: [],
        found: false
      };
    }
  });

  const allResults = await Promise.all(promises);

  // Aggregate
  const totalCourses = allResults.reduce((sum, r) => sum + r.courses.length, 0);
  const userName = allResults.find(r => r.userName)?.userName || null;

  res.json({
    email,
    userName,
    totalCourses,
    platforms: allResults
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
