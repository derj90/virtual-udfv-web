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
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const BASE_URL = process.env.BASE_URL || 'https://virtual.udfv.cloud';
const COOKIE_NAME = 'umce_session';

// --- Cookie helpers ---
function parseCookies(req) {
  const cookies = {};
  (req.headers.cookie || '').split(';').forEach(c => {
    const [key, ...val] = c.trim().split('=');
    if (key) cookies[key] = decodeURIComponent(val.join('='));
  });
  return cookies;
}

function setSessionCookie(res, token, maxAge) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge || 24 * 60 * 60}`);
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`);
}

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
function createToken(username, email, maxAgeSec) {
  const ttl = maxAgeSec || 24 * 60 * 60;
  const payload = `${username}|${email}|${Date.now()}|${ttl}`;
  const hmac = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');
  return Buffer.from(`${payload}|${hmac}`).toString('base64');
}

function verifyToken(token) {
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf8');
    const parts = decoded.split('|');
    if (parts.length !== 5) return null;
    const [username, email, timestamp, ttl, hmac] = parts;
    const expected = crypto.createHmac('sha256', SESSION_SECRET).update(`${username}|${email}|${timestamp}|${ttl}`).digest('hex');
    if (hmac !== expected) return null;
    if (Date.now() - parseInt(timestamp) > parseInt(ttl) * 1000) return null;
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
    courseImage: c.courseimage || (c.overviewfiles && c.overviewfiles[0] ? c.overviewfiles[0].fileurl.replace('/webservice/pluginfile.php/', '/pluginfile.php/') : null),
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

// --- Helper: find user by email ---
async function findUserByEmail(platform, email) {
  const users = await moodleCall(platform, 'core_user_get_users', {
    'criteria[0][key]': 'email',
    'criteria[0][value]': email
  });
  return users.users && users.users.length > 0 ? users.users[0] : null;
}

// --- Helper: query all platforms for a user ---
async function queryAllPlatforms(email, filterFn) {
  return Promise.all(
    PLATFORMS.map(async (platform) => {
      try {
        const user = await findUserByEmail(platform, email);
        if (!user) return { platform: platform.id, platformName: platform.name, platformColor: platform.color, courses: [], found: false };

        const courses = await getUserCourses(platform, user.id);
        const filtered = filterFn(courses, platform);

        return {
          platform: platform.id,
          platformName: platform.name,
          platformColor: platform.color,
          userName: user.fullname,
          courses: filtered,
          found: true
        };
      } catch (err) {
        return { platform: platform.id, platformName: platform.name, platformColor: platform.color, error: err.message, courses: [], found: false };
      }
    })
  );
}

// --- Validate email ---
function validateEmail(email) {
  if (!email || !email.includes('@')) return 'Se requiere un email válido';
  if (!email.toLowerCase().endsWith('@umce.cl')) return 'Solo se permiten correos @umce.cl';
  return null;
}

// --- Auth middleware ---
function authMiddleware(req, res, next) {
  const cookies = parseCookies(req);
  const token = cookies[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: 'No autenticado' });

  const user = verifyToken(token);
  if (!user) return res.status(401).json({ error: 'Sesión expirada' });

  req.userEmail = user.email;
  req.userName = user.username;
  next();
}

// --- Admin config ---
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'david.reyes_j@umce.cl,udfv@umce.cl').split(',').map(e => e.trim().toLowerCase());

function isAdmin(email) {
  return ADMIN_EMAILS.includes((email || '').toLowerCase());
}

// Helper: resolve target email (admin can override with ?email= param)
function resolveTargetEmail(req) {
  const ownEmail = req.userEmail;
  const targetEmail = req.query.email;
  if (targetEmail && isAdmin(ownEmail)) {
    const err = validateEmail(targetEmail);
    if (err) return { email: ownEmail, impersonating: false };
    return { email: targetEmail.toLowerCase(), impersonating: true };
  }
  return { email: ownEmail, impersonating: false };
}

// --- Admin API: check if current user is admin ---
app.get('/api/admin/check', authMiddleware, (req, res) => {
  res.json({ isAdmin: isAdmin(req.userEmail) });
});

// --- Google OAuth routes ---
app.get('/auth/login', (req, res) => {
  if (!GOOGLE_CLIENT_ID) return res.status(500).send('Google OAuth no configurado');

  const remember = req.query.remember === '1';
  const state = JSON.stringify({ nonce: crypto.randomBytes(16).toString('hex'), remember });
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: `${BASE_URL}/auth/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'online',
    prompt: 'select_account',
    state,
    hd: 'umce.cl'
  });

  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

app.get('/auth/callback', async (req, res) => {
  const { code, error, state: stateParam } = req.query;
  if (error || !code) return res.redirect('/mis-cursos.html?error=auth_denied');

  let remember = false;
  try { remember = JSON.parse(stateParam).remember === true; } catch {}

  try {
    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: `${BASE_URL}/auth/callback`,
        grant_type: 'authorization_code'
      }).toString()
    });

    const tokenData = await tokenRes.json();
    if (tokenData.error) throw new Error(tokenData.error_description || tokenData.error);

    // Get user info
    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    const userInfo = await userRes.json();

    const email = (userInfo.email || '').toLowerCase();
    if (!email.endsWith('@umce.cl')) {
      return res.redirect('/mis-cursos.html?error=domain');
    }

    const name = userInfo.name || email.split('@')[0];
    const maxAge = remember ? 30 * 24 * 60 * 60 : 24 * 60 * 60;
    const token = createToken(name, email, maxAge);
    setSessionCookie(res, token, maxAge);
    res.redirect('/mis-cursos.html');

  } catch (err) {
    console.error('OAuth callback error:', err.message);
    res.redirect('/mis-cursos.html?error=auth_failed');
  }
});

app.get('/auth/logout', (req, res) => {
  clearSessionCookie(res);
  res.redirect('/');
});

app.get('/auth/me', (req, res) => {
  const cookies = parseCookies(req);
  const token = cookies[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: 'No autenticado' });

  const user = verifyToken(token);
  if (!user) return res.status(401).json({ error: 'Sesión expirada' });

  res.json({ email: user.email, name: user.username });
});

// --- Static files ---
app.use(express.static(path.join(__dirname, 'public')));

// --- API: Active 2026 courses (authenticated) ---
app.get('/api/mis-cursos', authMiddleware, async (req, res) => {
  const { email, impersonating } = resolveTargetEmail(req);

  const platforms = await queryAllPlatforms(email, filterAndEnrich);
  const totalCourses = platforms.reduce((sum, r) => sum + r.courses.length, 0);
  const userName = platforms.find(r => r.userName)?.userName || (impersonating ? email.split('@')[0] : req.userName);

  res.json({ email, userName, totalCourses, platforms, impersonating });
});

// --- API: Historical courses (authenticated) ---
app.get('/api/historial', authMiddleware, async (req, res) => {
  const { email } = resolveTargetEmail(req);

  const platforms = await queryAllPlatforms(email, filterHistorical);
  const allHistorical = platforms.flatMap(p => p.courses);
  const years = [...new Set(allHistorical.map(c => c.year).filter(Boolean))].sort((a, b) => b - a);

  res.json({ totalCourses: allHistorical.length, years, platforms });
});

// --- Supabase UCampus config ---
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://supabase.udfv.cloud';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

// Helper: query Supabase REST API (ucampus schema)
async function supabaseQuery(table, params = '') {
  if (!SUPABASE_SERVICE_KEY) throw new Error('SUPABASE_SERVICE_KEY no configurado');
  const url = `${SUPABASE_URL}/rest/v1/${table}${params ? '?' + params : ''}`;
  const res = await fetch(url, {
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Accept-Profile': 'ucampus',
      'Accept': 'application/json'
    },
    signal: AbortSignal.timeout(10000)
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase ${table}: ${res.status} ${text}`);
  }
  return res.json();
}

// Helper: format UCampus horario from horarios rows
function formatHorario(horarios) {
  if (!horarios || horarios.length === 0) return null;
  const dayNames = { 1: 'Lun', 2: 'Mar', 3: 'Mié', 4: 'Jue', 5: 'Vie', 6: 'Sáb', 7: 'Dom' };
  return horarios
    .sort((a, b) => a.dia - b.dia)
    .map(h => {
      const day = dayNames[h.dia] || `D${h.dia}`;
      if (h.hora_inicio && h.hora_fin) return `${day} ${h.hora_inicio}-${h.hora_fin}`;
      if (h.bloque) return `${day} B${h.bloque}`;
      return day;
    })
    .join(' · ');
}

// --- API: UCampus data (authenticated) ---
app.get('/api/ucampus', authMiddleware, async (req, res) => {
  if (!SUPABASE_SERVICE_KEY) {
    return res.json({ found: false, error: 'UCampus no configurado' });
  }

  const { email } = resolveTargetEmail(req);

  try {
    // Step 1: Find persona by email
    const personas = await supabaseQuery('personas', `email=eq.${encodeURIComponent(email)}&limit=1`);
    if (!personas || personas.length === 0) {
      return res.json({ found: false });
    }

    const persona = personas[0];
    const rut = persona.rut;
    const nombre = persona.nombres ? `${persona.nombres} ${persona.apellido_paterno || ''} ${persona.apellido_materno || ''}`.trim() : null;

    // Step 2: Query docente and estudiante data in parallel
    const periodo = '2026.1';
    const [dictados, inscritos] = await Promise.all([
      supabaseQuery('cursos_dictados', `rut=eq.${encodeURIComponent(rut)}&periodo=eq.${periodo}`).catch(() => []),
      supabaseQuery('cursos_inscritos', `rut=eq.${encodeURIComponent(rut)}&periodo=eq.${periodo}`).catch(() => [])
    ]);

    // Step 3: Gather unique curso IDs and ramo codes for batch lookups
    const cursoIds = [...new Set([
      ...dictados.map(d => d.id_curso).filter(Boolean),
      ...inscritos.map(i => i.id_curso).filter(Boolean)
    ])];
    const ramoCodes = [...new Set([
      ...dictados.map(d => d.codigo_ramo).filter(Boolean),
      ...inscritos.map(i => i.codigo_ramo).filter(Boolean)
    ])];

    // Step 4: Batch fetch ramos, cursos, horarios
    const [ramos, cursos, horarios, carrAlumnos] = await Promise.all([
      ramoCodes.length > 0
        ? supabaseQuery('ramos', `codigo=in.(${ramoCodes.map(c => `"${c}"`).join(',')})`)
        : [],
      cursoIds.length > 0
        ? supabaseQuery('cursos', `id=in.(${cursoIds.join(',')})`)
        : [],
      dictados.length > 0
        ? supabaseQuery('horarios', `id_curso=in.(${dictados.map(d => d.id_curso).filter(Boolean).join(',')})`)
        : [],
      inscritos.length > 0
        ? supabaseQuery('carreras_alumnos', `rut=eq.${encodeURIComponent(rut)}`).catch(() => [])
        : []
    ]);

    // Index lookups
    const ramoMap = {};
    ramos.forEach(r => { ramoMap[r.codigo] = r; });
    const cursoMap = {};
    cursos.forEach(c => { cursoMap[c.id] = c; });
    const horarioMap = {};
    horarios.forEach(h => {
      if (!horarioMap[h.id_curso]) horarioMap[h.id_curso] = [];
      horarioMap[h.id_curso].push(h);
    });

    // Step 5: Get carrera name
    let carreraNombre = null;
    if (carrAlumnos.length > 0) {
      try {
        const carreras = await supabaseQuery('carreras', `codigo=eq.${encodeURIComponent(carrAlumnos[0].codigo_carrera)}&limit=1`);
        if (carreras.length > 0) carreraNombre = carreras[0].nombre;
      } catch {}
    }

    // Step 6: Build response
    const asDocente = {
      total: dictados.length,
      secciones: dictados.map(d => {
        const ramo = ramoMap[d.codigo_ramo] || {};
        const curso = cursoMap[d.id_curso] || {};
        return {
          idCurso: d.id_curso,
          codigoRamo: d.codigo_ramo || '',
          nombreRamo: ramo.nombre || d.nombre_ramo || '',
          seccion: d.seccion || curso.seccion || null,
          inscritos: curso.inscritos || d.inscritos || null,
          rol: d.rol || 'Docente',
          horario: formatHorario(horarioMap[d.id_curso]),
          ucampusUrl: `https://ucampus.umce.cl`
        };
      })
    };

    const asEstudiante = {
      total: inscritos.length,
      carrera: carreraNombre,
      ramos: inscritos.map(i => {
        const ramo = ramoMap[i.codigo_ramo] || {};
        return {
          codigoRamo: i.codigo_ramo || '',
          nombreRamo: ramo.nombre || i.nombre_ramo || '',
          seccion: i.seccion || null,
          notaFinal: i.nota_final != null ? parseFloat(i.nota_final) : null,
          estado: i.estado || null,
          ucampusUrl: `https://ucampus.umce.cl`
        };
      })
    };

    res.json({
      found: true,
      rut,
      nombre,
      periodo: 'Primer Semestre 2026',
      asDocente: asDocente.total > 0 ? asDocente : null,
      asEstudiante: asEstudiante.total > 0 ? asEstudiante : null
    });

  } catch (err) {
    console.error('UCampus API error:', err.message);
    res.json({ found: false, error: err.message });
  }
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
