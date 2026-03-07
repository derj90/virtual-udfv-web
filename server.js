const express = require('express');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const multer = require('multer');

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
const EDITOR_EMAILS = (process.env.EDITOR_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);

function isAdmin(email) {
  return ADMIN_EMAILS.includes((email || '').toLowerCase());
}

function isEditor(email) {
  return EDITOR_EMAILS.includes((email || '').toLowerCase());
}

function getUserRole(email) {
  const e = (email || '').toLowerCase();
  if (ADMIN_EMAILS.includes(e)) return 'admin';
  if (EDITOR_EMAILS.includes(e)) return 'editor';
  return null;
}

// Middleware: admin or editor
function adminOrEditorMiddleware(req, res, next) {
  const cookies = parseCookies(req);
  const token = cookies[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: 'No autenticado' });
  const user = verifyToken(token);
  if (!user) return res.status(401).json({ error: 'Sesión expirada' });
  const role = getUserRole(user.email);
  if (!role) return res.status(403).json({ error: 'No autorizado' });
  req.userEmail = user.email;
  req.userName = user.username;
  req.userRole = role;
  next();
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

// --- Uploads config ---
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
app.use('/uploads', express.static(UPLOADS_DIR));

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_DIR),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const name = path.basename(file.originalname, ext).toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      cb(null, `${Date.now()}-${name}${ext}`);
    }
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    const allowed = /\.(jpg|jpeg|png|gif|webp|svg|pdf|doc|docx|xls|xlsx|ppt|pptx)$/i;
    if (allowed.test(path.extname(file.originalname))) cb(null, true);
    else cb(new Error('Tipo de archivo no permitido'));
  }
});

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

// Helper: query Supabase REST API (portal schema)
async function portalQuery(table, params = '') {
  if (!SUPABASE_SERVICE_KEY) throw new Error('SUPABASE_SERVICE_KEY no configurado');
  const url = `${SUPABASE_URL}/rest/v1/${table}${params ? '?' + params : ''}`;
  const res = await fetch(url, {
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Accept-Profile': 'portal',
      'Accept': 'application/json'
    },
    signal: AbortSignal.timeout(10000)
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Portal ${table}: ${res.status} ${text}`);
  }
  return res.json();
}

async function portalMutate(table, method, body, params = '') {
  if (!SUPABASE_SERVICE_KEY) throw new Error('SUPABASE_SERVICE_KEY no configurado');
  const url = `${SUPABASE_URL}/rest/v1/${table}${params ? '?' + params : ''}`;
  const res = await fetch(url, {
    method,
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Profile': 'portal',
      'Accept-Profile': 'portal',
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: body != null ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10000)
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Portal mutate ${table}: ${res.status} ${text}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : [];
}

// Helper: format UCampus horario from horarios rows
function formatHorario(horarios) {
  if (!horarios || horarios.length === 0) return null;
  const dayNames = { 1: 'Lun', 2: 'Mar', 3: 'Mié', 4: 'Jue', 5: 'Vie', 6: 'Sáb', 7: 'Dom' };
  // Deduplicate by dia+hora to avoid repeated entries from sync
  const seen = new Set();
  return horarios
    .sort((a, b) => a.dia - b.dia)
    .filter(h => {
      const key = `${h.dia}-${h.hora_fin || h.raw_data?.hora_fin}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map(h => {
      const day = dayNames[h.dia] || `D${h.dia}`;
      const inicio = h.hora_inicio || h.raw_data?.hora_ini;
      const fin = h.hora_fin || h.raw_data?.hora_fin;
      if (inicio && fin) return `${day} ${inicio}-${fin}`;
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
    const nombre = persona.nombres ? `${persona.nombres} ${persona.apellido1 || ''} ${persona.apellido2 || ''}`.trim() : null;

    // Step 2: Query docente and estudiante data in parallel
    const periodo = '2026.1';
    const [dictados, inscritos] = await Promise.all([
      supabaseQuery('cursos_dictados', `rut=eq.${encodeURIComponent(rut)}&periodo=eq.${periodo}`).catch(() => []),
      supabaseQuery('cursos_inscritos', `rut=eq.${encodeURIComponent(rut)}&periodo=eq.${periodo}`).catch(() => [])
    ]);

    // Step 3: Gather unique curso IDs and ramo codes for batch lookups
    // Fields like codigo, nombre, seccion are inside raw_data, not top-level
    const cursoIds = [...new Set([
      ...dictados.map(d => d.id_curso).filter(Boolean),
      ...inscritos.map(i => i.id_curso).filter(Boolean)
    ])];
    const ramoCodes = [...new Set([
      ...dictados.map(d => d.raw_data?.codigo).filter(Boolean),
      ...inscritos.map(i => i.raw_data?.codigo).filter(Boolean)
    ])];

    // Step 4: Batch fetch ramos, cursos, horarios, inscritos count
    const [ramos, cursos, horarios, carrAlumnos, allInscritos] = await Promise.all([
      ramoCodes.length > 0
        ? supabaseQuery('ramos', `codigo=in.(${ramoCodes.map(c => `"${c}"`).join(',')})`)
        : [],
      cursoIds.length > 0
        ? supabaseQuery('cursos', `id_curso=in.(${cursoIds.join(',')})`)
        : [],
      dictados.length > 0
        ? supabaseQuery('horarios', `id_curso=in.(${dictados.map(d => d.id_curso).filter(Boolean).join(',')})`)
        : [],
      inscritos.length > 0
        ? supabaseQuery('carreras_alumnos', `rut=eq.${encodeURIComponent(rut)}`).catch(() => [])
        : [],
      // Count real inscritos per course for docente view
      dictados.length > 0
        ? supabaseQuery('cursos_inscritos', `id_curso=in.(${dictados.map(d => d.id_curso).filter(Boolean).join(',')})&select=id_curso,rut`)
            .catch(() => [])
        : []
    ]);

    // Index lookups
    const ramoMap = {};
    ramos.forEach(r => { ramoMap[r.codigo] = r; });
    const cursoMap = {};
    cursos.forEach(c => { cursoMap[c.id_curso] = c; });
    const horarioMap = {};
    horarios.forEach(h => {
      if (!horarioMap[h.id_curso]) horarioMap[h.id_curso] = [];
      horarioMap[h.id_curso].push(h);
    });
    // Count real inscritos per course
    const inscritosCountMap = {};
    allInscritos.forEach(i => {
      inscritosCountMap[i.id_curso] = (inscritosCountMap[i.id_curso] || 0) + 1;
    });

    // Step 5: Get carrera name
    let carreraNombre = null;
    if (carrAlumnos.length > 0) {
      try {
        const ca = carrAlumnos[0];
        // Use raw_data.nombre directly if available, otherwise look up carreras table
        if (ca.raw_data?.nombre) {
          carreraNombre = ca.raw_data.nombre;
        } else {
          const carreras = await supabaseQuery('carreras', `id_carrera=eq.${encodeURIComponent(ca.id_carrera)}&limit=1`);
          if (carreras.length > 0) carreraNombre = carreras[0].nombre;
        }
      } catch {}
    }

    // Step 6: Build response — fields are in raw_data, not top-level columns
    const asDocente = {
      total: dictados.length,
      totalEstudiantes: Object.values(inscritosCountMap).reduce((s, n) => s + n, 0),
      secciones: dictados.map(d => {
        const rd = d.raw_data || {};
        const codigo = rd.codigo || '';
        const ramo = ramoMap[codigo] || {};
        const curso = cursoMap[d.id_curso] || {};
        const crd = curso.raw_data || {};
        const realInscritos = inscritosCountMap[d.id_curso] || 0;
        return {
          idCurso: d.id_curso,
          codigoRamo: codigo,
          nombreRamo: ramo.nombre || rd.nombre || '',
          seccion: rd.seccion || curso.seccion || null,
          inscritos: realInscritos,
          cupos: curso.cupos || parseInt(crd.cupo) || null,
          rol: d.rol || rd.cargo || 'Docente',
          horario: formatHorario(horarioMap[d.id_curso]),
          departamento: crd.departamento || null,
          modalidad: crd.modalidad || null,
          creditos: { ud: parseInt(rd.ud) || null, sct: parseInt(rd.sct) || null },
          ucampusUrl: `https://ucampus.umce.cl`
        };
      })
    };

    const asEstudiante = {
      total: inscritos.length,
      carrera: carreraNombre,
      ramos: inscritos.map(i => {
        const rd = i.raw_data || {};
        const codigo = rd.codigo || '';
        const ramo = ramoMap[codigo] || {};
        return {
          codigoRamo: codigo,
          nombreRamo: ramo.nombre || rd.nombre || '',
          seccion: rd.seccion || null,
          notaFinal: rd.nota_final != null ? parseFloat(rd.nota_final) : null,
          estado: rd.estado_texto || i.estado || null,
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

// --- API: UCampus section detail — student list (authenticated, admin only) ---
app.get('/api/ucampus/seccion/:idCurso', authMiddleware, async (req, res) => {
  if (!SUPABASE_SERVICE_KEY) return res.status(500).json({ error: 'UCampus no configurado' });

  const { email } = resolveTargetEmail(req);
  const idCurso = req.params.idCurso;

  try {
    // Verify the requesting user (or impersonated user) is a docente of this section
    const persona = await supabaseQuery('personas', `email=eq.${encodeURIComponent(email)}&limit=1`);
    if (!persona || persona.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });

    const rut = persona[0].rut;
    const isDocente = await supabaseQuery('cursos_dictados', `rut=eq.${encodeURIComponent(rut)}&id_curso=eq.${idCurso}&limit=1`);

    // Allow admin or docente of this section
    if (!isAdmin(req.userEmail) && (!isDocente || isDocente.length === 0)) {
      return res.status(403).json({ error: 'No autorizado para ver esta sección' });
    }

    // Get course info
    const cursoArr = await supabaseQuery('cursos', `id_curso=eq.${idCurso}&limit=1`);
    const curso = cursoArr[0] || {};
    const crd = curso.raw_data || {};

    // Get all inscritos for this section
    const estudiantesRaw = await supabaseQuery('cursos_inscritos', `id_curso=eq.${idCurso}&select=rut,estado,nota_final,raw_data`);

    // Batch fetch persona data for all student RUTs
    const studentRuts = [...new Set(estudiantesRaw.map(e => e.rut).filter(Boolean))];
    let personasMap = {};
    if (studentRuts.length > 0) {
      // PostgREST has URL length limits, batch in groups of 50
      for (let i = 0; i < studentRuts.length; i += 50) {
        const batch = studentRuts.slice(i, i + 50);
        const personas = await supabaseQuery('personas', `rut=in.(${batch.join(',')})&select=rut,nombres,apellido1,apellido2,email`);
        personas.forEach(p => { personasMap[p.rut] = p; });
      }
    }

    // Build student list
    const estudiantes = estudiantesRaw.map(e => {
      const p = personasMap[e.rut] || {};
      const rd = e.raw_data || {};
      return {
        rut: e.rut,
        nombre: p.nombres ? `${p.nombres} ${p.apellido1 || ''} ${p.apellido2 || ''}`.trim() : null,
        email: p.email || null,
        estado: rd.estado_final || e.estado || 'Inscrito',
        notaFinal: rd.nota_final && parseFloat(rd.nota_final) > 0 ? parseFloat(rd.nota_final) : null
      };
    }).sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));

    res.json({
      idCurso,
      codigoRamo: crd.codigo || '',
      nombreRamo: crd.nombre || '',
      seccion: crd.seccion || curso.seccion || null,
      departamento: crd.departamento || null,
      modalidad: crd.modalidad || null,
      cupos: curso.cupos || parseInt(crd.cupo) || null,
      totalInscritos: estudiantes.length,
      estudiantes
    });

  } catch (err) {
    console.error('UCampus seccion error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// === Portal Catalog API ===

// GET /api/catalog/programs
app.get('/api/catalog/programs', async (req, res) => {
  try {
    const { type, featured, search, status, limit = '20', offset = '0' } = req.query;
    let params = [];
    params.push(`status=eq.${status || 'active'}`);
    if (type) params.push(`type=eq.${type}`);
    if (featured === 'true') params.push('featured=eq.true');
    if (search) params.push(`or=(title.ilike.*${search}*,description.ilike.*${search}*)`);
    params.push('order=featured.desc,created_at.desc');
    params.push(`limit=${parseInt(limit)}`);
    params.push(`offset=${parseInt(offset)}`);
    const data = await portalQuery('programs', params.join('&'));
    res.json(data);
  } catch (err) {
    console.error('Catalog programs error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/catalog/programs/:slug
app.get('/api/catalog/programs/:slug', async (req, res) => {
  try {
    const programs = await portalQuery('programs', `slug=eq.${encodeURIComponent(req.params.slug)}&limit=1`);
    if (!programs.length) return res.status(404).json({ error: 'Programa no encontrado' });
    const program = programs[0];

    const [courses, teamLinks, testimonials] = await Promise.all([
      portalQuery('courses', `program_id=eq.${program.id}&order=created_at.asc`),
      portalQuery('program_team', `program_id=eq.${program.id}`),
      portalQuery('testimonials', `program_id=eq.${program.id}`)
    ]);

    let team = [];
    if (teamLinks.length) {
      const memberIds = teamLinks.map(t => t.member_id);
      team = await portalQuery('team_members', `id=in.(${memberIds.join(',')})`);
      team = team.map(m => {
        const link = teamLinks.find(t => t.member_id === m.id);
        return { ...m, role_in_program: link?.role_in_program };
      });
    }

    res.json({ ...program, courses, team, testimonials });
  } catch (err) {
    console.error('Program detail error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/catalog/courses
app.get('/api/catalog/courses', async (req, res) => {
  try {
    const { category, status, program_id, level, search, limit = '20', offset = '0' } = req.query;
    let params = [];
    params.push('enrollment_status=neq.hidden');
    if (status) params.push(`enrollment_status=eq.${status}`);
    if (category) params.push(`category=eq.${category}`);
    if (program_id) params.push(`program_id=eq.${program_id}`);
    if (level) params.push(`level=eq.${level}`);
    if (search) params.push(`or=(title.ilike.*${search}*,description.ilike.*${search}*)`);
    params.push('order=created_at.desc');
    params.push(`limit=${parseInt(limit)}`);
    params.push(`offset=${parseInt(offset)}`);
    const data = await portalQuery('courses', params.join('&'));
    res.json(data);
  } catch (err) {
    console.error('Catalog courses error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/catalog/courses/:slug
app.get('/api/catalog/courses/:slug', async (req, res) => {
  try {
    const courses = await portalQuery('courses', `slug=eq.${encodeURIComponent(req.params.slug)}&limit=1`);
    if (!courses.length) return res.status(404).json({ error: 'Curso no encontrado' });
    res.json(courses[0]);
  } catch (err) {
    console.error('Course detail error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/catalog/search?q=...
app.get('/api/catalog/search', async (req, res) => {
  try {
    const q = req.query.q;
    if (!q) return res.json({ programs: [], courses: [] });
    const searchParam = `or=(title.ilike.*${q}*,description.ilike.*${q}*)&limit=10`;
    const [programs, courses] = await Promise.all([
      portalQuery('programs', `${searchParam}&status=eq.active`),
      portalQuery('courses', searchParam)
    ]);
    res.json({ programs, courses });
  } catch (err) {
    console.error('Catalog search error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/news
app.get('/api/news', async (req, res) => {
  try {
    const { category, featured, limit = '10', offset = '0' } = req.query;
    let params = [];
    params.push('status=neq.hidden');
    if (category) params.push(`category=eq.${category}`);
    if (featured === 'true') params.push('featured=eq.true');
    params.push('order=published_at.desc');
    params.push(`limit=${parseInt(limit)}`);
    params.push(`offset=${parseInt(offset)}`);
    let data = await portalQuery('news', params.join('&'));
    // Filter out test/fake content that should not appear in production
    data = data.filter(item => {
      const title = (item.title || '').toLowerCase();
      const body = (item.body || item.content || item.excerpt || '').toLowerCase();
      if (title.includes('[prueba]') || title.includes('[test]')) return false;
      if (body.includes('noticia ficticia') || body.includes('noticia de prueba')) return false;
      if (title.includes('ji') && title.trim().length <= 20) return false; // catches "empezamos el año ji"
      return true;
    });
    res.json(data);
  } catch (err) {
    console.error('News error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/news/:slug
app.get('/api/news/:slug', async (req, res) => {
  try {
    const items = await portalQuery('news', `slug=eq.${encodeURIComponent(req.params.slug)}&limit=1`);
    if (!items.length) return res.status(404).json({ error: 'Noticia no encontrada' });
    res.json(items[0]);
  } catch (err) {
    console.error('News detail error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/resources
app.get('/api/resources', async (req, res) => {
  try {
    const { type, category } = req.query;
    let params = [];
    if (type) params.push(`type=eq.${type}`);
    if (category) params.push(`category=eq.${category}`);
    params.push('order=display_order.asc,created_at.desc');
    const data = await portalQuery('resources', params.join('&'));
    res.json(data);
  } catch (err) {
    console.error('Resources error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/team
app.get('/api/team', async (req, res) => {
  try {
    const data = await portalQuery('team_members', 'order=display_order.asc');
    res.json(data);
  } catch (err) {
    console.error('Team error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/testimonials
app.get('/api/testimonials', async (req, res) => {
  try {
    const { program_id } = req.query;
    let params = [];
    if (program_id) params.push(`program_id=eq.${program_id}`);
    params.push('order=created_at.desc');
    const data = await portalQuery('testimonials', params.join('&'));
    res.json(data);
  } catch (err) {
    console.error('Testimonials error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// === Chatbot API ===

const CLAUDE_PROXY_URL = 'http://claude-proxy-container:3099/chat';
// Fallback: try Docker gateway IP if container name doesn't resolve
const CLAUDE_PROXY_FALLBACK = 'http://172.18.0.1:3099/chat';
const CHAT_RATE_LIMIT = 20; // messages per hour

// System prompt with portal context — built on startup
let chatSystemPrompt = '';
async function buildChatSystemPrompt() {
  try {
    const [programs, courses, team] = await Promise.all([
      portalQuery('programs', 'status=eq.active'),
      portalQuery('courses', 'select=title,category,duration_hours,moodle_platform,level'),
      portalQuery('team_members', 'order=display_order.asc&select=name,role,subunit')
    ]);
    chatSystemPrompt = `Eres el Asistente Virtual de la UMCE (Universidad Metropolitana de Ciencias de la Educación), específicamente de la Unidad de Docencia y Formación Virtual (UDFV).

Tu rol es ayudar a docentes y estudiantes con información sobre la oferta formativa virtual, plataformas Moodle y servicios de la UDFV.

INFORMACIÓN DEL CATÁLOGO:

Programas disponibles:
${programs.map(p => `- ${p.title} (${p.type}, ${p.duration_hours || '?'}h, nivel: ${p.level || 'todos'})`).join('\n')}

Cursos disponibles:
${courses.map(c => `- ${c.title} (${c.category}, ${c.duration_hours || '?'}h, plataforma: ${c.moodle_platform})`).join('\n')}

Equipo UDFV:
${team.map(t => `- ${t.name}: ${t.role} (${t.subunit})`).join('\n')}

PLATAFORMAS MOODLE UMCE:
- eVirtual (evirtual.umce.cl) — Formación continua y extensión
- Práctica (evirtual-practica.umce.cl) — Prácticas profesionales
- Virtual (virtual.umce.cl) — Docencia regular
- Pregrado (evirtual-pregrado.umce.cl) — Carreras de pregrado
- Postgrado (evirtual-postgrado.umce.cl) — Programas de postgrado

SERVICIOS:
- Dashboard Docente (dashboard.udfv.cloud) — métricas de actividad
- Asistente Telegram (@asistente_udfv_bot) — soporte 24/7
- Learning Record Store (LRS) — tracking xAPI
- Asesoría en diseño instruccional
- Soporte técnico: udfv@umce.cl

INSTRUCCIONES:
- Responde en español chileno, de forma amable y profesional
- Sé conciso (máximo 3-4 párrafos)
- Si mencionas un curso, indica la plataforma donde se encuentra
- Si no sabes algo, sugiere contactar a udfv@umce.cl
- NO uses herramientas ni ejecutes código — solo responde con texto
- Para inscripciones, dirige a la plataforma Moodle correspondiente
- El sitio web es virtual.udfv.cloud`;
    console.log('Chat system prompt built:', chatSystemPrompt.length, 'chars');
  } catch (err) {
    console.error('Failed to build chat prompt:', err.message);
    chatSystemPrompt = 'Eres el asistente virtual de la UDFV-UMCE. Ayuda con consultas sobre cursos y plataformas. Contacto: udfv@umce.cl';
  }
}
// Build prompt after server starts (DB may not be ready immediately)
setTimeout(buildChatSystemPrompt, 3000);

// Rate limiting per session
const chatRateLimits = new Map();
function checkRateLimit(sessionToken) {
  const now = Date.now();
  const hourAgo = now - 3600000;
  let timestamps = chatRateLimits.get(sessionToken) || [];
  timestamps = timestamps.filter(t => t > hourAgo);
  if (timestamps.length >= CHAT_RATE_LIMIT) return false;
  timestamps.push(now);
  chatRateLimits.set(sessionToken, timestamps);
  return true;
}

// POST /api/chat/session — create or recover session
app.post('/api/chat/session', async (req, res) => {
  try {
    const { session_token, user_email } = req.body;

    if (session_token) {
      const sessions = await portalQuery('chat_sessions', `session_token=eq.${encodeURIComponent(session_token)}&limit=1`);
      if (sessions.length) {
        const messages = await portalQuery('chat_messages', `session_id=eq.${sessions[0].id}&order=created_at.asc`);
        return res.json({ session_token: sessions[0].session_token, session_id: sessions[0].id, messages });
      }
    }

    // Create new session
    const newToken = crypto.randomBytes(16).toString('hex');
    const created = await portalMutate('chat_sessions', 'POST', {
      session_token: newToken,
      user_email: user_email || null
    });
    const sess = Array.isArray(created) ? created[0] : created;
    res.json({ session_token: sess.session_token, session_id: sess.id, messages: [] });
  } catch (err) {
    console.error('Chat session error:', err.message);
    res.status(500).json({ error: 'Error creando sesión' });
  }
});

// POST /api/chat/message — send message, get response
app.post('/api/chat/message', async (req, res) => {
  try {
    const { session_token, message } = req.body;
    if (!session_token || !message || message.length > 2000) {
      return res.status(400).json({ error: 'Mensaje inválido' });
    }

    // Verify session
    const sessions = await portalQuery('chat_sessions', `session_token=eq.${encodeURIComponent(session_token)}&limit=1`);
    if (!sessions.length) return res.status(404).json({ error: 'Sesión no encontrada' });
    const session = sessions[0];

    // Rate limit
    if (!checkRateLimit(session_token)) {
      return res.status(429).json({ error: 'Has alcanzado el límite de mensajes. Intenta en una hora.' });
    }

    // Save user message
    await portalMutate('chat_messages', 'POST', {
      session_id: session.id,
      role: 'user',
      content: message
    });

    // Get recent conversation history for context
    const recentMessages = await portalQuery('chat_messages',
      `session_id=eq.${session.id}&order=created_at.desc&limit=6`
    );
    const history = recentMessages.reverse().map(m => `${m.role === 'user' ? 'Usuario' : 'Asistente'}: ${m.content}`).join('\n');

    const fullPrompt = history ? `Conversación previa:\n${history}\n\nUsuario: ${message}` : message;

    // Call Claude proxy
    let proxyUrl = CLAUDE_PROXY_URL;
    let response;
    try {
      const proxyRes = await fetch(proxyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: fullPrompt, system_prompt: chatSystemPrompt }),
        signal: AbortSignal.timeout(55000)
      });
      response = await proxyRes.json();
    } catch (e) {
      // Fallback to gateway IP
      proxyUrl = CLAUDE_PROXY_FALLBACK;
      const proxyRes = await fetch(proxyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: fullPrompt, system_prompt: chatSystemPrompt }),
        signal: AbortSignal.timeout(55000)
      });
      response = await proxyRes.json();
    }

    if (response.error) {
      console.error('Claude proxy error:', response.error);
      throw new Error(response.error);
    }

    const assistantMessage = response.response || 'Lo siento, no pude generar una respuesta.';

    // Save assistant message
    await portalMutate('chat_messages', 'POST', {
      session_id: session.id,
      role: 'assistant',
      content: assistantMessage
    });

    // Update message count
    await portalMutate('chat_sessions', 'PATCH', { message_count: session.message_count + 2 },
      `session_token=eq.${encodeURIComponent(session_token)}`);

    res.json({ response: assistantMessage });
  } catch (err) {
    console.error('Chat message error:', err.message);
    res.status(500).json({ error: 'Error generando respuesta. Intenta de nuevo.' });
  }
});

// GET /api/chat/history
app.get('/api/chat/history', async (req, res) => {
  try {
    const { session_token } = req.query;
    if (!session_token) return res.status(400).json({ error: 'Token requerido' });

    const sessions = await portalQuery('chat_sessions', `session_token=eq.${encodeURIComponent(session_token)}&limit=1`);
    if (!sessions.length) return res.status(404).json({ error: 'Sesión no encontrada' });

    const messages = await portalQuery('chat_messages', `session_id=eq.${sessions[0].id}&order=created_at.asc`);
    res.json(messages);
  } catch (err) {
    console.error('Chat history error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Slugify helper (used by admin assistant + admin CRUD)
function slugify(text) {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').substring(0, 100);
}

// --- File upload endpoint (admin/editor) ---
app.post('/api/admin/upload', adminOrEditorMiddleware, (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      const msg = err instanceof multer.MulterError
        ? (err.code === 'LIMIT_FILE_SIZE' ? 'Archivo demasiado grande (máx 10 MB)' : err.message)
        : err.message;
      return res.status(400).json({ error: msg });
    }
    if (!req.file) return res.status(400).json({ error: 'No se recibió ningún archivo' });

    const fileUrl = `${BASE_URL}/uploads/${req.file.filename}`;
    const isImage = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(req.file.originalname);
    res.json({
      url: fileUrl,
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      isImage
    });
  });
});

// === Admin Assistant API ===

// Admin system prompt — built dynamically with current content + schemas
let adminSystemPrompt = '';
async function buildAdminSystemPrompt() {
  try {
    const [programs, courses, news, team, resources] = await Promise.all([
      portalQuery('programs', 'select=id,title,type,status,slug'),
      portalQuery('courses', 'select=id,title,category,enrollment_status,slug,program_id,level,duration_hours'),
      portalQuery('news', 'select=id,title,category,status,slug,published_at'),
      portalQuery('team_members', 'select=id,name,role,subunit,slug&order=display_order.asc'),
      portalQuery('resources', 'select=id,title,type,category,slug')
    ]);

    adminSystemPrompt = `Eres el asistente de administración del portal UMCE Virtual (virtual.udfv.cloud).
Tu rol es ayudar a admins y editores a gestionar el contenido del portal usando lenguaje natural.

CONTENIDO ACTUAL:

Programas (${programs.length}):
${programs.map(p => `- [id:${p.id}] ${p.title} (tipo: ${p.type}, estado: ${p.status})`).join('\n')}

Cursos (${courses.length}):
${courses.map(c => `- [id:${c.id}] ${c.title} (categoría: ${c.category || '-'}, estado: ${c.enrollment_status}, programa: ${c.program_id || 'sin programa'}, nivel: ${c.level || '-'}, ${c.duration_hours || '?'}h)`).join('\n')}

Noticias (${news.length}):
${news.map(n => `- [id:${n.id}] ${n.title} (categoría: ${n.category || '-'}, estado: ${n.status || 'published'}, fecha: ${n.published_at ? n.published_at.split('T')[0] : '-'})`).join('\n')}

Equipo (${team.length}):
${team.map(t => `- [id:${t.id}] ${t.name} — ${t.role} (${t.subunit || '-'})`).join('\n')}

Recursos (${resources.length}):
${resources.map(r => `- [id:${r.id}] ${r.title} (tipo: ${r.type || '-'}, categoría: ${r.category || '-'})`).join('\n')}

SCHEMAS DE ENTIDADES (campos válidos para crear/actualizar):

programs: { title*, type* (diplomado|curso_abierto|ruta_formativa|postitulo|certificacion), description, objectives (JSON array), curriculum (JSON array), duration_hours, modality, moodle_url, stats (JSON), tags (array), level, featured (bool), status (active|inactive), image_url, source }
courses: { title*, program_id, category, duration_hours, description, moodle_course_id, moodle_platform, enrollment_status (active|upcoming|closed), start_date, end_date, tags (array), level, source, image_url }
news: { title*, excerpt, content, category, image_url, source, source_url, published_at, featured (bool), status (published|hidden) }
team_members: { name*, role, subunit, bio, email, photo_url, display_order }
resources: { title*, type, category, url, embed_code, thumbnail_url, description, display_order }

(* = campo obligatorio)

FORMATO DE ACCIÓN:
Cuando el usuario pida crear, actualizar o eliminar contenido, responde con texto explicativo Y un bloque de acción así:

:::action
{"action": "create|update|delete", "table": "programs|courses|news|team_members|resources", "id": null_o_id, "data": {campos}}
:::

REGLAS:
- Solo UN bloque :::action por mensaje
- Si falta información necesaria, pídela antes de proponer la acción
- NO inventes campos que no existen en los schemas
- Para update, incluye solo los campos que cambian + el id
- Para delete, incluye table e id
- Para create, genera un slug automáticamente a partir del título
- Responde en español chileno (tú/usted, NO voseo argentino como "revivé/mirá"). Tono amable y profesional
- Si el usuario pregunta sobre contenido existente, responde con la información del listado
- Si piden estadísticas, calcula a partir de los datos disponibles
- Nunca propongas acciones que no correspondan al rol del usuario
- Si el usuario comparte un enlace de YouTube, usa la metadata proporcionada (título, embed URL, thumbnail) para proponer acciones relevantes. Por ejemplo, crear un recurso con embed_code del video o agregar el video a una noticia usando image_url para el thumbnail y source_url para el enlace
- Para embed de YouTube usa: <iframe width="560" height="315" src="EMBED_URL" frameborder="0" allowfullscreen></iframe>
- Si el usuario comparte un video sin contexto adicional, pregunta qué quiere hacer: crear recurso, agregar a noticia, etc.`;

    console.log('Admin system prompt built:', adminSystemPrompt.length, 'chars');
  } catch (err) {
    console.error('Failed to build admin prompt:', err.message);
    adminSystemPrompt = 'Eres el asistente de administración del portal UMCE Virtual. Ayuda a gestionar programas, cursos y noticias.';
  }
}
// Build admin prompt after server starts
setTimeout(buildAdminSystemPrompt, 4000);

// Parse :::action block from Claude response
function parseActionBlock(text) {
  const match = text.match(/:::action\s*\n?([\s\S]*?)\n?:::/);
  if (!match) return { text: text.trim(), action: null };
  const cleanText = text.replace(/:::action\s*\n?[\s\S]*?\n?:::/, '').trim();
  try {
    const action = JSON.parse(match[1].trim());
    return { text: cleanText, action };
  } catch {
    return { text: text.trim(), action: null };
  }
}

// Admin assistant chat sessions (in-memory, keyed by email)
const adminChatSessions = new Map();

// GET /api/admin/role — returns user role + pending count
app.get('/api/admin/role', authMiddleware, async (req, res) => {
  const role = getUserRole(req.userEmail);
  let pendingCount = 0;
  if (role === 'admin') {
    try {
      const pending = await portalQuery('admin_actions', 'status=eq.pending_approval&select=id');
      pendingCount = pending.length;
    } catch {}
  }
  res.json({ role, pendingCount });
});

// POST /api/admin/assistant/session — create or recover admin chat session
app.post('/api/admin/assistant/session', adminOrEditorMiddleware, async (req, res) => {
  const email = req.userEmail;
  if (!adminChatSessions.has(email)) {
    adminChatSessions.set(email, { messages: [], createdAt: new Date() });
  }
  const session = adminChatSessions.get(email);
  res.json({ messages: session.messages, role: req.userRole });
});

// Extract YouTube video IDs from text
function extractYouTubeIds(text) {
  const regex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})(?:[&?][\w=.-]*)?/gi;
  const ids = [];
  let match;
  while ((match = regex.exec(text)) !== null) ids.push(match[1]);
  return [...new Set(ids)];
}

// Fetch YouTube video metadata via oEmbed (no API key needed)
async function fetchYouTubeMetadata(videoId) {
  try {
    const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      videoId,
      title: data.title,
      author: data.author_name,
      thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      embedUrl: `https://www.youtube.com/embed/${videoId}`,
      watchUrl: `https://www.youtube.com/watch?v=${videoId}`
    };
  } catch { return null; }
}

// POST /api/admin/assistant/message — send message to Claude, parse action
app.post('/api/admin/assistant/message', adminOrEditorMiddleware, async (req, res) => {
  const { message } = req.body;
  if (!message || message.length > 3000) return res.status(400).json({ error: 'Mensaje inválido' });

  const email = req.userEmail;
  if (!adminChatSessions.has(email)) {
    adminChatSessions.set(email, { messages: [], createdAt: new Date() });
  }
  const session = adminChatSessions.get(email);

  // Detect and fetch YouTube metadata
  const ytIds = extractYouTubeIds(message);
  let ytContext = '';
  if (ytIds.length > 0) {
    const metaResults = await Promise.all(ytIds.map(fetchYouTubeMetadata));
    const metas = metaResults.filter(Boolean);
    if (metas.length > 0) {
      ytContext = '\n\nVIDEOS DETECTADOS EN EL MENSAJE:\n' +
        metas.map(m => `- YouTube: "${m.title}" por ${m.author}\n  URL: ${m.watchUrl}\n  Embed: ${m.embedUrl}\n  Thumbnail: ${m.thumbnail}`).join('\n');
    }
  }

  // Add user message
  session.messages.push({ role: 'user', content: message, timestamp: new Date().toISOString() });

  // Rebuild admin prompt to have fresh data
  await buildAdminSystemPrompt();

  // Build conversation context (last 10 messages)
  const recent = session.messages.slice(-10);
  const history = recent.map(m => `${m.role === 'user' ? 'Admin' : 'Asistente'}: ${m.content}`).join('\n');
  const roleContext = `El usuario actual es ${req.userName} (${email}) con rol: ${req.userRole}.`;
  const fullPrompt = `${roleContext}\n\nConversación:\n${history}\n\nAdmin: ${message}${ytContext}`;

  try {
    // Call Claude proxy
    let proxyUrl = CLAUDE_PROXY_URL;
    let response;
    try {
      const proxyRes = await fetch(proxyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: fullPrompt, system_prompt: adminSystemPrompt }),
        signal: AbortSignal.timeout(55000)
      });
      response = await proxyRes.json();
    } catch {
      proxyUrl = CLAUDE_PROXY_FALLBACK;
      const proxyRes = await fetch(proxyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: fullPrompt, system_prompt: adminSystemPrompt }),
        signal: AbortSignal.timeout(55000)
      });
      response = await proxyRes.json();
    }

    if (response.error) throw new Error(response.error);
    const rawResponse = response.response || 'No pude generar una respuesta.';

    // Parse action block
    const { text, action } = parseActionBlock(rawResponse);

    // Store assistant message (text only, action stored separately)
    session.messages.push({
      role: 'assistant',
      content: text,
      action: action || undefined,
      timestamp: new Date().toISOString()
    });

    res.json({ text, action });
  } catch (err) {
    console.error('Admin assistant error:', err.message);
    res.status(500).json({ error: 'Error generando respuesta. Intenta de nuevo.' });
  }
});

// POST /api/admin/assistant/execute — execute a confirmed action
app.post('/api/admin/assistant/execute', adminOrEditorMiddleware, async (req, res) => {
  const { action: actionType, table, id, data } = req.body;
  if (!actionType || !table) return res.status(400).json({ error: 'Acción inválida' });

  const allowedTables = ['programs', 'courses', 'news', 'team_members', 'resources'];
  if (!allowedTables.includes(table)) return res.status(400).json({ error: 'Tabla no permitida' });

  const role = req.userRole;
  const email = req.userEmail;

  try {
    let result;
    let logStatus = 'executed';

    if (actionType === 'create') {
      if (!data || !data.title) return res.status(400).json({ error: 'Datos insuficientes: título requerido' });
      if (!data.slug) data.slug = slugify(data.title);
      if (table === 'news' && !data.published_at) data.published_at = new Date().toISOString();
      if (table === 'news' && !data.status) data.status = 'published';
      result = await portalMutate(table, 'POST', data);
      result = Array.isArray(result) ? result[0] : result;

    } else if (actionType === 'update') {
      if (!id) return res.status(400).json({ error: 'ID requerido para actualizar' });
      result = await portalMutate(table, 'PATCH', data, `id=eq.${id}`);
      result = Array.isArray(result) && result.length ? result[0] : result;

    } else if (actionType === 'delete') {
      if (!id) return res.status(400).json({ error: 'ID requerido para eliminar' });

      // Editor: soft-delete (set status to hidden + create pending approval)
      if (role === 'editor') {
        // Get current data before hiding
        const current = await portalQuery(table, `id=eq.${id}&limit=1`);
        const before = current.length ? current[0] : null;

        // Soft-delete: set status/enrollment_status to hidden
        const statusField = table === 'courses' ? 'enrollment_status' : 'status';
        if (table === 'news' || table === 'courses') {
          await portalMutate(table, 'PATCH', { [statusField]: 'hidden' }, `id=eq.${id}`);
        } else {
          // For tables without status field, we still track it
          await portalMutate(table, 'PATCH', { slug: before?.slug ? before.slug + '-hidden' : 'hidden' }, `id=eq.${id}`);
        }

        // Create pending approval
        await portalMutate('admin_actions', 'POST', {
          user_email: email,
          user_role: role,
          action_type: 'delete',
          target_table: table,
          target_id: id,
          data_before: before,
          status: 'pending_approval'
        });

        logStatus = 'pending_approval';
        result = { hidden: true, pending: true, message: 'Contenido ocultado. Un admin debe aprobar la eliminación.' };

      } else {
        // Admin: hard delete
        const current = await portalQuery(table, `id=eq.${id}&limit=1`);
        await portalMutate(table, 'DELETE', null, `id=eq.${id}`);
        result = { deleted: true };

        // Log the action
        await portalMutate('admin_actions', 'POST', {
          user_email: email,
          user_role: role,
          action_type: 'delete',
          target_table: table,
          target_id: id,
          data_before: current.length ? current[0] : null,
          status: 'executed'
        });
      }

    } else {
      return res.status(400).json({ error: 'Tipo de acción no válido' });
    }

    // Log create/update actions
    if (actionType !== 'delete') {
      await portalMutate('admin_actions', 'POST', {
        user_email: email,
        user_role: role,
        action_type: actionType,
        target_table: table,
        target_id: result?.id || id || null,
        data_after: data,
        status: logStatus
      });
    }

    // Rebuild admin prompt after mutation
    await buildAdminSystemPrompt();
    // Also rebuild chat prompt so public chatbot stays current
    await buildChatSystemPrompt();

    res.json({ success: true, result });
  } catch (err) {
    console.error('Admin execute error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/assistant/history — conversation history
app.get('/api/admin/assistant/history', adminOrEditorMiddleware, (req, res) => {
  const session = adminChatSessions.get(req.userEmail);
  res.json(session ? session.messages : []);
});

// GET /api/admin/assistant/pending — list pending approvals (admin only)
app.get('/api/admin/assistant/pending', adminOrEditorMiddleware, async (req, res) => {
  if (req.userRole !== 'admin') return res.status(403).json({ error: 'Solo admin' });
  try {
    const pending = await portalQuery('admin_actions', 'status=eq.pending_approval&order=created_at.desc');
    res.json(pending);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/assistant/review — approve or reject pending action (admin only)
app.post('/api/admin/assistant/review', adminOrEditorMiddleware, async (req, res) => {
  if (req.userRole !== 'admin') return res.status(403).json({ error: 'Solo admin' });
  const { actionId, decision } = req.body; // decision: 'approve' or 'reject'
  if (!actionId || !['approve', 'reject'].includes(decision)) {
    return res.status(400).json({ error: 'actionId y decision (approve|reject) requeridos' });
  }

  try {
    const actions = await portalQuery('admin_actions', `id=eq.${actionId}&status=eq.pending_approval&limit=1`);
    if (!actions.length) return res.status(404).json({ error: 'Acción pendiente no encontrada' });
    const action = actions[0];

    if (decision === 'approve') {
      // Execute the hard delete
      await portalMutate(action.target_table, 'DELETE', null, `id=eq.${action.target_id}`);
      await portalMutate('admin_actions', 'PATCH', {
        status: 'approved',
        reviewed_by: req.userEmail,
        reviewed_at: new Date().toISOString()
      }, `id=eq.${actionId}`);
      // Rebuild prompts
      await buildAdminSystemPrompt();
      await buildChatSystemPrompt();
      res.json({ success: true, message: 'Eliminación aprobada y ejecutada.' });
    } else {
      // Reject: restore original status
      const before = action.data_before;
      if (before) {
        const statusField = action.target_table === 'courses' ? 'enrollment_status' : 'status';
        const restoreData = {};
        if (before[statusField]) restoreData[statusField] = before[statusField];
        if (before.slug && before.slug !== (before.slug || '').replace('-hidden', '')) restoreData.slug = before.slug;
        if (Object.keys(restoreData).length) {
          await portalMutate(action.target_table, 'PATCH', restoreData, `id=eq.${action.target_id}`);
        }
      }
      await portalMutate('admin_actions', 'PATCH', {
        status: 'rejected',
        reviewed_by: req.userEmail,
        reviewed_at: new Date().toISOString()
      }, `id=eq.${actionId}`);
      res.json({ success: true, message: 'Eliminación rechazada. Contenido restaurado.' });
    }
  } catch (err) {
    console.error('Admin review error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// === Admin CRUD API ===

function adminMiddleware(req, res, next) {
  const cookies = parseCookies(req);
  const token = cookies[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: 'No autenticado' });
  const user = verifyToken(token);
  if (!user) return res.status(401).json({ error: 'Sesión expirada' });
  if (!isAdmin(user.email)) return res.status(403).json({ error: 'No autorizado' });
  req.userEmail = user.email;
  req.userName = user.username;
  next();
}

// --- Programs CRUD ---
app.post('/api/admin/programs', adminMiddleware, async (req, res) => {
  try {
    const data = req.body;
    if (!data.title) return res.status(400).json({ error: 'Título requerido' });
    if (!data.slug) data.slug = slugify(data.title);
    const result = await portalMutate('programs', 'POST', data);
    res.status(201).json(Array.isArray(result) ? result[0] : result);
  } catch (err) {
    console.error('Admin create program:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/programs/:id', adminMiddleware, async (req, res) => {
  try {
    const result = await portalMutate('programs', 'PATCH', req.body, `id=eq.${req.params.id}`);
    if (!result.length) return res.status(404).json({ error: 'No encontrado' });
    res.json(result[0]);
  } catch (err) {
    console.error('Admin update program:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/programs/:id', adminMiddleware, async (req, res) => {
  try {
    await portalMutate('programs', 'DELETE', null, `id=eq.${req.params.id}`);
    res.json({ deleted: true });
  } catch (err) {
    console.error('Admin delete program:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// --- Courses CRUD ---
app.post('/api/admin/courses', adminMiddleware, async (req, res) => {
  try {
    const data = req.body;
    if (!data.title) return res.status(400).json({ error: 'Título requerido' });
    if (!data.slug) data.slug = slugify(data.title);
    const result = await portalMutate('courses', 'POST', data);
    res.status(201).json(Array.isArray(result) ? result[0] : result);
  } catch (err) {
    console.error('Admin create course:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/courses/:id', adminMiddleware, async (req, res) => {
  try {
    const result = await portalMutate('courses', 'PATCH', req.body, `id=eq.${req.params.id}`);
    if (!result.length) return res.status(404).json({ error: 'No encontrado' });
    res.json(result[0]);
  } catch (err) {
    console.error('Admin update course:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/courses/:id', adminMiddleware, async (req, res) => {
  try {
    await portalMutate('courses', 'DELETE', null, `id=eq.${req.params.id}`);
    res.json({ deleted: true });
  } catch (err) {
    console.error('Admin delete course:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// --- News CRUD ---
app.post('/api/admin/news', adminMiddleware, async (req, res) => {
  try {
    const data = req.body;
    if (!data.title) return res.status(400).json({ error: 'Título requerido' });
    if (!data.slug) data.slug = slugify(data.title);
    if (!data.published_at) data.published_at = new Date().toISOString();
    const result = await portalMutate('news', 'POST', data);
    res.status(201).json(Array.isArray(result) ? result[0] : result);
  } catch (err) {
    console.error('Admin create news:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/news/:id', adminMiddleware, async (req, res) => {
  try {
    const result = await portalMutate('news', 'PATCH', req.body, `id=eq.${req.params.id}`);
    if (!result.length) return res.status(404).json({ error: 'No encontrado' });
    res.json(result[0]);
  } catch (err) {
    console.error('Admin update news:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/news/:id', adminMiddleware, async (req, res) => {
  try {
    await portalMutate('news', 'DELETE', null, `id=eq.${req.params.id}`);
    res.json({ deleted: true });
  } catch (err) {
    console.error('Admin delete news:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// --- Trigger manual sync ---
app.post('/api/admin/sync/trigger', adminMiddleware, async (req, res) => {
  const { type } = req.body; // 'news' or 'moodle'
  if (!['news', 'moodle'].includes(type)) {
    return res.status(400).json({ error: 'Tipo debe ser "news" o "moodle"' });
  }
  // Log the trigger (actual sync runs on VPS via cron/scripts)
  try {
    await portalMutate('sync_log', 'POST', {
      source: type === 'news' ? 'sync_umce' : 'sync_moodle',
      sync_type: 'manual_trigger',
      status: 'triggered',
      triggered_by: req.userEmail
    });
    res.json({ status: 'triggered', type, message: 'Sync registrado. Los scripts VPS ejecutarán la sincronización.' });
  } catch (err) {
    console.error('Sync trigger error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// --- Rebuild chat system prompt (admin) ---
app.post('/api/admin/chat/rebuild-prompt', adminMiddleware, async (req, res) => {
  try {
    await buildChatSystemPrompt();
    res.json({ status: 'ok', length: chatSystemPrompt.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
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

// === Page Routes ===
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/catalogo', (req, res) => res.sendFile(path.join(__dirname, 'public', 'catalogo.html')));
app.get('/competencias', (req, res) => res.sendFile(path.join(__dirname, 'public', 'competencias.html')));
app.get('/servicios', (req, res) => res.sendFile(path.join(__dirname, 'public', 'servicios.html')));
app.get('/noticias', (req, res) => res.sendFile(path.join(__dirname, 'public', 'noticias.html')));
app.get('/mis-cursos', (req, res) => res.sendFile(path.join(__dirname, 'public', 'mis-cursos.html')));
app.get('/ayuda', (req, res) => res.sendFile(path.join(__dirname, 'public', 'ayuda.html')));

app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

// Dynamic slug-based pages
app.get('/programa/:slug', (req, res) => res.sendFile(path.join(__dirname, 'public', 'programa.html')));
app.get('/curso/:slug', (req, res) => res.sendFile(path.join(__dirname, 'public', 'curso.html')));
app.get('/noticia/:slug', (req, res) => res.sendFile(path.join(__dirname, 'public', 'noticia.html')));

// Backward compatibility redirects
app.get('/mis-cursos.html', (req, res) => res.redirect(301, '/mis-cursos'));
app.get('/ayuda.html', (req, res) => res.redirect(301, '/ayuda'));
app.get('/index.html', (req, res) => res.redirect(301, '/'));

// 404 catch-all (must be last)
app.use((req, res) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/auth/')) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

app.listen(PORT, () => {
  console.log(`virtual.udfv.cloud running on port ${PORT}`);
  console.log(`Platforms configured: ${PLATFORMS.map(p => p.id).join(', ')}`);
});
