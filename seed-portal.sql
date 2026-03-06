-- =============================================================================
-- Portal UDFV — Seed Data
-- Fuente: INVENTARIO_CONTENIDO.md + CURACION_CONTENIDO.md
-- Created: 2026-03-06
-- =============================================================================

-- ---------------------------------------------------------------------------
-- PROGRAMS
-- ---------------------------------------------------------------------------
INSERT INTO portal.programs
    (slug, type, title, description, objectives, curriculum, duration_hours, modality, moodle_url, stats, tags, level, featured, status, source)
VALUES
(
    'diplomado-ia-transformacion-educativa',
    'diplomado',
    'Diplomado en Integración de IA en Gestión Pedagógica del Aula',
    'Programa de formación avanzada orientado a docentes universitarios que desean integrar herramientas de inteligencia artificial en sus prácticas pedagógicas. Ofrece un recorrido formativo sistemático desde los fundamentos de la IA hasta su aplicación crítica y reflexiva en el aula.',
    '["Comprender los fundamentos conceptuales y éticos de la inteligencia artificial aplicada a la educación",
      "Diseñar experiencias de aprendizaje enriquecidas con herramientas de IA",
      "Evaluar críticamente el impacto de la IA en los procesos formativos",
      "Desarrollar competencias para el uso pedagógico responsable de la IA",
      "Construir recursos educativos digitales con apoyo de herramientas de IA generativa"]'::jsonb,
    '[
      {"modulo": 1, "titulo": "Fundamentos de la IA y su impacto educativo", "horas": 20},
      {"modulo": 2, "titulo": "IA generativa para el diseño instruccional", "horas": 20},
      {"modulo": 3, "titulo": "Evaluación y retroalimentación con IA", "horas": 20},
      {"modulo": 4, "titulo": "Ética, sesgos y uso crítico de la IA", "horas": 20},
      {"modulo": 5, "titulo": "Proyecto integrador: innovación pedagógica con IA", "horas": 20}
    ]'::jsonb,
    100,
    'virtual',
    'https://evirtual.umce.cl/course/view.php?id=298',
    '{"participantes": 10, "satisfaccion": "93%", "periodo": "2025", "certificados": "UCampus marzo 2026"}'::jsonb,
    ARRAY['ia', 'pedagogia', 'transformacion-digital', 'formacion-docente'],
    'avanzado',
    true,
    'active',
    'moodle-evirtual'
),
(
    'ruta-formativa-competencias-digitales-docentes',
    'ruta_formativa',
    'Ruta Formativa en Competencias Digitales Docentes',
    'Itinerario formativo de 3 niveles progresivos alineado al Marco de Competencias Digitales Docentes UMCE-UDFV 2025 y al Marco MINEDUC UNESCO. Cubre desde habilidades digitales básicas hasta la integración avanzada de tecnologías en la docencia universitaria.',
    '["Fortalecer las competencias digitales docentes en tres niveles de progresión",
      "Articular el uso de herramientas TIC con los procesos pedagógicos",
      "Desarrollar ciudadanía digital crítica y responsable",
      "Preparar a docentes para entornos de enseñanza híbrida y virtual",
      "Certificar competencias según el Marco TIC UMCE-UDFV 2025"]'::jsonb,
    '[
      {"nivel": 1, "titulo": "Nivel Básico: Iniciación Digital", "horas": 44, "cursos": ["Introducción a las TIC y Ambientes Virtuales", "Evaluación en Ambientes Virtuales con Moodle", "Sácale provecho a Zoom", "Educación y Ciudadanía Digital"]},
      {"nivel": 2, "titulo": "Nivel Intermedio: Aplicación Pedagógica", "horas": 48, "cursos": ["Diseño y creación de recursos educativos con Canva", "Creación de portafolios digitales con Google Sites", "Elaboración de material educativo digital", "Formación para la tutoría virtual"]},
      {"nivel": 3, "titulo": "Nivel Avanzado: Integración e Innovación", "horas": 40, "cursos": ["Introducción a la IA y sus aplicaciones educativas", "IA Aplicada a la Docencia", "Comunidad virtual de aprendizaje en innovación TIC", "Diseño instruccional para Entornos Virtuales"]}
    ]'::jsonb,
    132,
    'virtual',
    NULL,
    '{"niveles": 3, "cursos_totales": 12, "horas_totales": 132, "alineacion": "Marco MINEDUC Competencias Digitales Docentes 2023"}'::jsonb,
    ARRAY['competencias-digitales', 'tic', 'formacion-docente', 'certificacion'],
    'todos-los-niveles',
    true,
    'active',
    'manual'
),
(
    'certificacion-competencias-tic-nivel-basico',
    'certificacion',
    'Certificación de Competencias Digitales Docentes — Nivel Básico',
    'Proceso de certificación formal de competencias digitales para docentes de la UMCE, basado en el Marco de Competencias TIC UMCE-UDFV 2025. El nivel básico acredita dominio de herramientas digitales fundamentales para la docencia universitaria. Autorizado por Resolución Exenta N°2025-00-1545.',
    '["Acreditar el dominio de competencias digitales básicas para la docencia",
      "Obtener certificado institucional reconocido por la UMCE",
      "Aplicar las competencias certificadas en el contexto pedagógico propio"]'::jsonb,
    NULL,
    27,
    'virtual',
    NULL,
    '{"resolucion": "Exenta N°2025-00-1545", "marco": "DigComp Europa / MINEDUC-UNESCO / Marco TIC UMCE-UDFV", "nivel": "Básico (1 de 3)"}'::jsonb,
    ARRAY['certificacion', 'competencias-digitales', 'tic', 'acreditacion'],
    'basico',
    false,
    'active',
    'manual'
);

-- ---------------------------------------------------------------------------
-- COURSES
-- ---------------------------------------------------------------------------
INSERT INTO portal.courses
    (slug, program_id, title, category, duration_hours, description, moodle_course_id, moodle_platform, enrollment_status, tags, level, source)
VALUES
-- IA courses
(
    'introduccion-ia-aplicaciones-educativas',
    (SELECT id FROM portal.programs WHERE slug = 'ruta-formativa-competencias-digitales-docentes'),
    'Introducción a la IA y sus aplicaciones educativas',
    'Inteligencia Artificial',
    20,
    'Curso de introducción a la inteligencia artificial orientado a docentes universitarios. Explora los conceptos fundamentales de la IA, sus herramientas más relevantes para el ámbito educativo y las implicancias pedagógicas y éticas de su uso en el aula.',
    295,
    'evirtual',
    'active',
    ARRAY['ia', 'introduccion', 'educacion'],
    'basico',
    'moodle-evirtual'
),
(
    'introduccion-ia-aplicaciones-educativas-v2',
    (SELECT id FROM portal.programs WHERE slug = 'ruta-formativa-competencias-digitales-docentes'),
    'Introducción a la IA y sus aplicaciones educativas (edición 2025)',
    'Inteligencia Artificial',
    20,
    'Versión actualizada del curso de introducción a la IA. Incorpora los avances más recientes en modelos de lenguaje, IA generativa y herramientas educativas con IA disponibles en 2025.',
    340,
    'evirtual',
    'active',
    ARRAY['ia', 'ia-generativa', 'educacion', '2025'],
    'basico',
    'moodle-evirtual'
),
(
    'ia-aplicada-docencia-als-titulados',
    (SELECT id FROM portal.programs WHERE slug = 'diplomado-ia-transformacion-educativa'),
    'IA Aplicada a la Docencia — ALS Titulados 2025',
    'Inteligencia Artificial',
    30,
    'Curso especializado para académicos titulados de la UMCE. Aborda la integración práctica de la IA en los procesos de enseñanza-aprendizaje, con énfasis en el diseño de actividades, evaluación y retroalimentación asistida por IA.',
    347,
    'evirtual',
    'active',
    ARRAY['ia', 'docencia', 'als', 'titulados'],
    'intermedio',
    'moodle-evirtual'
),
-- Herramientas digitales
(
    'diseno-recursos-educativos-canva',
    (SELECT id FROM portal.programs WHERE slug = 'ruta-formativa-competencias-digitales-docentes'),
    'Diseño y creación de recursos educativos con Canva',
    'Herramientas Digitales',
    20,
    'Curso práctico para el diseño de materiales educativos visuales utilizando Canva. Cubre presentaciones, infografías, fichas didácticas y recursos interactivos orientados al aula universitaria.',
    301,
    'evirtual',
    'active',
    ARRAY['canva', 'diseno', 'recursos-educativos', 'herramientas'],
    'basico',
    'moodle-evirtual'
),
(
    'portafolios-digitales-google-sites',
    (SELECT id FROM portal.programs WHERE slug = 'ruta-formativa-competencias-digitales-docentes'),
    'Creación de portafolios digitales con Google Sites',
    'Herramientas Digitales',
    20,
    'Aprende a construir portafolios digitales profesionales y de aprendizaje usando Google Sites. Ideal para docentes que desean documentar sus prácticas pedagógicas y para formación en portafolio estudiantil.',
    291,
    'evirtual',
    'active',
    ARRAY['google-sites', 'portafolio', 'herramientas', 'documentacion'],
    'basico',
    'moodle-evirtual'
),
(
    'sacarle-provecho-zoom',
    (SELECT id FROM portal.programs WHERE slug = 'ruta-formativa-competencias-digitales-docentes'),
    'Sácale provecho a Zoom',
    'Herramientas Digitales',
    12,
    'Taller intensivo para el uso avanzado de Zoom en contextos educativos. Cubre salas grupales, encuestas, anotaciones, gestión de participantes, grabación y mejores prácticas para clases sincrónicas de alto impacto.',
    292,
    'evirtual',
    'active',
    ARRAY['zoom', 'sincrono', 'videoconferencia', 'herramientas'],
    'basico',
    'moodle-evirtual'
),
-- Moodle
(
    'evaluacion-ambientes-virtuales-moodle',
    (SELECT id FROM portal.programs WHERE slug = 'ruta-formativa-competencias-digitales-docentes'),
    'Evaluación en Ambientes Virtuales con Moodle',
    'Plataforma Virtual',
    20,
    'Curso centrado en el diseño e implementación de actividades evaluativas en Moodle. Abarca tareas, cuestionarios, rúbricas, portafolios y estrategias de retroalimentación efectiva en entornos virtuales de aprendizaje.',
    294,
    'evirtual',
    'active',
    ARRAY['moodle', 'evaluacion', 'ambientes-virtuales'],
    'intermedio',
    'moodle-evirtual'
),
(
    'evaluacion-ambientes-virtuales-moodle-v2',
    (SELECT id FROM portal.programs WHERE slug = 'ruta-formativa-competencias-digitales-docentes'),
    'Evaluación en Ambientes Virtuales con Moodle (v2)',
    'Plataforma Virtual',
    20,
    'Versión actualizada del curso de evaluación en Moodle. Incorpora nuevas funcionalidades de la plataforma y estrategias de evaluación formativa basadas en datos de aprendizaje.',
    348,
    'evirtual',
    'active',
    ARRAY['moodle', 'evaluacion', 'ambientes-virtuales', 'v2'],
    'intermedio',
    'moodle-evirtual'
),
-- Ciudadanía digital
(
    'educacion-ciudadania-digital',
    (SELECT id FROM portal.programs WHERE slug = 'ruta-formativa-competencias-digitales-docentes'),
    'Educación y Ciudadanía Digital',
    'Ciudadanía Digital',
    20,
    'Explora los conceptos de ciudadanía digital, privacidad en línea, derechos digitales, seguridad informática y convivencia en entornos virtuales. Orientado a docentes que trabajan con estudiantes en contextos digitales.',
    296,
    'evirtual',
    'active',
    ARRAY['ciudadania-digital', 'privacidad', 'seguridad', 'etica-digital'],
    'basico',
    'moodle-evirtual'
),
-- Material educativo digital
(
    'elaboracion-material-educativo-digital',
    (SELECT id FROM portal.programs WHERE slug = 'ruta-formativa-competencias-digitales-docentes'),
    'Elaboración de material educativo digital',
    'Diseño Instruccional',
    30,
    'Curso teórico-práctico para el diseño y producción de materiales educativos digitales. Cubre principios del diseño instruccional, producción de contenido multimedia, accesibilidad y evaluación de recursos digitales.',
    213,
    'evirtual',
    'active',
    ARRAY['material-educativo', 'diseno-instruccional', 'multimedia', 'digital'],
    'intermedio',
    'moodle-evirtual'
),
-- Tutoría virtual
(
    'formacion-tutoria-virtual',
    (SELECT id FROM portal.programs WHERE slug = 'ruta-formativa-competencias-digitales-docentes'),
    'Formación para la tutoría virtual',
    'Tutoría y Acompañamiento',
    20,
    'Prepara a docentes y tutores para el acompañamiento efectivo de estudiantes en entornos virtuales. Cubre estrategias de comunicación, detección de dificultades, motivación y gestión de grupos en plataformas digitales.',
    120,
    'evirtual',
    'active',
    ARRAY['tutoria', 'acompanamiento', 'virtual', 'estudiantes'],
    'intermedio',
    'moodle-evirtual'
),
-- TIC y ambientes virtuales
(
    'introduccion-tic-ambientes-virtuales',
    (SELECT id FROM portal.programs WHERE slug = 'ruta-formativa-competencias-digitales-docentes'),
    'Introducción a las TIC y Ambientes Virtuales',
    'Fundamentos TIC',
    20,
    'Curso de entrada para docentes que se inician en el uso de tecnologías de la información y la comunicación en educación. Explora las principales herramientas digitales educativas y los fundamentos de los entornos virtuales de aprendizaje.',
    250,
    'evirtual',
    'active',
    ARRAY['tic', 'ambientes-virtuales', 'introduccion', 'herramientas'],
    'basico',
    'moodle-evirtual'
),
-- Ley Karin
(
    'introduccion-ley-karin',
    NULL,
    'Introducción a la Ley Karin',
    'Marco Legal',
    8,
    'Curso de formación sobre la Ley N°21.643 (Ley Karin) de prevención y sanción del acoso laboral y sexual en el trabajo. Orientado al personal docente y administrativo de la UMCE.',
    241,
    'evirtual',
    'active',
    ARRAY['ley-karin', 'acoso-laboral', 'prevencion', 'marco-legal'],
    'basico',
    'moodle-evirtual'
),
-- Comunidad virtual
(
    'comunidad-virtual-innovacion-tic',
    (SELECT id FROM portal.programs WHERE slug = 'ruta-formativa-competencias-digitales-docentes'),
    'Comunidad virtual de aprendizaje en innovación TIC',
    'Innovación Educativa',
    20,
    'Espacio de aprendizaje colaborativo para docentes innovadores. Fomenta el intercambio de experiencias pedagógicas con TIC, la co-construcción de recursos y la reflexión crítica sobre la integración tecnológica en educación universitaria.',
    79,
    'evirtual',
    'active',
    ARRAY['comunidad', 'innovacion', 'tic', 'colaboracion'],
    'avanzado',
    'moodle-evirtual'
),
-- Diplomado (program course)
(
    'diplomado-ia-tecnologias-digitales-transformacion',
    (SELECT id FROM portal.programs WHERE slug = 'diplomado-ia-transformacion-educativa'),
    'Diplomado en IA y Tecnologías Digitales para la Transformación Educativa',
    'Diplomado',
    100,
    'Programa completo de 5 módulos para docentes que desean liderar procesos de transformación educativa digital en sus instituciones. Combina fundamentos teóricos, herramientas prácticas y un proyecto integrador de innovación pedagógica.',
    298,
    'evirtual',
    'active',
    ARRAY['diplomado', 'ia', 'transformacion-educativa', 'tecnologias-digitales'],
    'avanzado',
    'moodle-evirtual'
),
-- Masculinidades
(
    'masculinidades-prevencion-violencia-genero',
    NULL,
    'Masculinidades y Prevención de Violencia de Género',
    'Formación en Género',
    20,
    'Curso orientado a la reflexión crítica sobre masculinidades y el rol de los docentes en la prevención de la violencia de género en contextos universitarios.',
    321,
    'evirtual',
    'active',
    ARRAY['genero', 'masculinidades', 'violencia', 'prevencion'],
    'basico',
    'moodle-evirtual'
),
-- Inducción UMCE
(
    'induccion-modelo-educativo-umce-2026',
    NULL,
    'Programa de Inducción al Modelo Educativo UMCE',
    'Inducción Institucional',
    15,
    'Programa de bienvenida e inducción para nuevos integrantes de la comunidad UMCE. Introduce el modelo educativo institucional, los valores de la universidad y los recursos pedagógicos disponibles.',
    168,
    'evirtual',
    'active',
    ARRAY['induccion', 'modelo-educativo', 'umce', 'institucional'],
    'basico',
    'moodle-evirtual'
),
-- Diseño instruccional
(
    'diseno-instruccional-entornos-virtuales',
    (SELECT id FROM portal.programs WHERE slug = 'ruta-formativa-competencias-digitales-docentes'),
    'Diseño instruccional para Entornos Virtuales',
    'Diseño Instruccional',
    30,
    'Curso avanzado de diseño instruccional aplicado a entornos de aprendizaje virtual. Cubre modelos pedagógicos, planificación de secuencias didácticas, diseño de evaluaciones auténticas y producción de materiales para plataformas como Moodle.',
    37,
    'evirtual',
    'active',
    ARRAY['diseno-instruccional', 'entornos-virtuales', 'planificacion', 'moodle'],
    'avanzado',
    'moodle-evirtual'
);

-- ---------------------------------------------------------------------------
-- TEAM MEMBERS
-- ---------------------------------------------------------------------------
INSERT INTO portal.team_members
    (slug, name, role, subunit, bio, email, display_order)
VALUES
(
    'david-reyes',
    'David Reyes Jiménez',
    'Coordinador UDFV',
    'Unidad de Docencia y Formación Virtual',
    'Coordinador de la Unidad de Docencia y Formación Virtual (UDFV) de la UMCE. Especialista en tecnología educativa, diseño instruccional para entornos virtuales e integración de IA en procesos formativos universitarios. Responsable del desarrollo de plataformas digitales, programas de formación docente y del sistema Acompaña UMCE.',
    'david.reyes_j@umce.cl',
    1
),
(
    'profesional-diseno-instruccional',
    'Equipo de Diseño Instruccional',
    'Diseñadoras Instruccionales',
    'Unidad de Docencia y Formación Virtual',
    'Profesionales especializadas en el diseño y desarrollo de recursos educativos digitales, cursos virtuales y materiales didácticos para las 5 plataformas Moodle de la UMCE. Acompañan a docentes en el proceso de virtualización de sus asignaturas.',
    'udfv@umce.cl',
    2
),
(
    'equipo-soporte-plataformas',
    'Equipo de Soporte Plataformas',
    'Soporte Técnico Educativo',
    'Unidad de Docencia y Formación Virtual',
    'Equipo responsable del soporte técnico a docentes y estudiantes en el uso de las plataformas virtuales de la UMCE. Gestionan las 5 instancias Moodle y brindan atención personalizada a través del Asistente UDFV.',
    'udfv@umce.cl',
    3
),
(
    'equipo-formacion-docente',
    'Equipo de Formación Docente',
    'Formación y Capacitación',
    'Unidad de Docencia y Formación Virtual',
    'Profesionales dedicados a la planificación, implementación y seguimiento de los programas de formación TIC para docentes universitarios. Han capacitado a más de 443 participantes en 38 actividades formativas entre 2023 y 2025.',
    'udfv@umce.cl',
    4
),
(
    'uda-coordinacion',
    'Unidad de Desarrollo Académico (UDA)',
    'Contraparte Institucional',
    'Unidad de Desarrollo Académico',
    'La UDA es la unidad académica con la que UDFV trabaja en conjunto para el diseño y ejecución de programas de formación docente institucional. Responsable de emitir constancias y certificados de participación.',
    NULL,
    5
);

-- ---------------------------------------------------------------------------
-- PROGRAM — TEAM associations
-- ---------------------------------------------------------------------------
INSERT INTO portal.program_team (program_id, member_id, role_in_program)
VALUES
(
    (SELECT id FROM portal.programs WHERE slug = 'diplomado-ia-transformacion-educativa'),
    (SELECT id FROM portal.team_members WHERE slug = 'david-reyes'),
    'Director del Programa'
),
(
    (SELECT id FROM portal.programs WHERE slug = 'diplomado-ia-transformacion-educativa'),
    (SELECT id FROM portal.team_members WHERE slug = 'profesional-diseno-instruccional'),
    'Diseño Instruccional'
),
(
    (SELECT id FROM portal.programs WHERE slug = 'ruta-formativa-competencias-digitales-docentes'),
    (SELECT id FROM portal.team_members WHERE slug = 'david-reyes'),
    'Coordinador'
),
(
    (SELECT id FROM portal.programs WHERE slug = 'ruta-formativa-competencias-digitales-docentes'),
    (SELECT id FROM portal.team_members WHERE slug = 'equipo-formacion-docente'),
    'Facilitadores'
),
(
    (SELECT id FROM portal.programs WHERE slug = 'certificacion-competencias-tic-nivel-basico'),
    (SELECT id FROM portal.team_members WHERE slug = 'david-reyes'),
    'Responsable Técnico'
),
(
    (SELECT id FROM portal.programs WHERE slug = 'certificacion-competencias-tic-nivel-basico'),
    (SELECT id FROM portal.team_members WHERE slug = 'uda-coordinacion'),
    'Contraparte Institucional'
);

-- ---------------------------------------------------------------------------
-- TESTIMONIALS
-- ---------------------------------------------------------------------------
INSERT INTO portal.testimonials
    (author_name, author_role, content, program_id, rating)
VALUES
(
    'Marcial Beltrami',
    'Docente — Facultad de Ciencias',
    'El diplomado me cambió completamente la perspectiva sobre la IA en el aula. Antes la veía como una amenaza; hoy la integro en mis clases de manera crítica y reflexiva. El equipo de UDFV siempre estuvo disponible para apoyar el proceso.',
    (SELECT id FROM portal.programs WHERE slug = 'diplomado-ia-transformacion-educativa'),
    5
),
(
    'Edith Ubilla',
    'Docente — Departamento de Pedagogía',
    'La ruta formativa me permitió avanzar a mi propio ritmo. Empecé desde lo más básico con las TIC y terminé diseñando un curso completo en Moodle. Lo que más valoro es que cada aprendizaje tenía aplicación directa en mi trabajo docente.',
    (SELECT id FROM portal.programs WHERE slug = 'ruta-formativa-competencias-digitales-docentes'),
    5
),
(
    'Felipe Aguilar',
    'Docente — Educación Diferencial',
    'Llevé el taller de Canva y luego el de recursos digitales. En pocas semanas pude actualizar todos mis materiales de apoyo. Mis estudiantes notaron la diferencia de inmediato. Recomiendo estos cursos a todo el cuerpo docente de la UMCE.',
    (SELECT id FROM portal.programs WHERE slug = 'ruta-formativa-competencias-digitales-docentes'),
    5
),
(
    'Rodrigo Castro',
    'Docente — Departamento de Historia',
    'Siempre pensé que las herramientas digitales eran para otras disciplinas, no para las humanidades. El equipo UDFV me demostró lo contrario. Hoy uso portafolios digitales con mis estudiantes y los resultados son increíbles.',
    (SELECT id FROM portal.programs WHERE slug = 'ruta-formativa-competencias-digitales-docentes'),
    4
);

-- ---------------------------------------------------------------------------
-- NEWS
-- ---------------------------------------------------------------------------
INSERT INTO portal.news
    (slug, title, excerpt, content, category, featured, published_at, source)
VALUES
(
    'jornada-experiencias-docentes-innovacion-digital-2025',
    'I Jornada de Experiencias Docentes en Innovación Digital, Tecnologías y Educación Online',
    '10 docentes de la UMCE presentaron sus experiencias de innovación pedagógica con tecnologías digitales en la primera jornada institucional de su tipo.',
    'El 29 de diciembre de 2025, la UMCE realizó la I Jornada de Experiencias Docentes en Innovación Digital, Tecnologías y Educación Online, un hito en la historia de la universidad que reunió a docentes de diversas disciplinas para compartir sus prácticas innovadoras.

La jornada, realizada en el Salón 3 del Doctorado con transmisión simultánea por Zoom, contó con 10 presentaciones de docentes de la UMCE y la participación especial de Gonzalo Figueroa de la Universidad Santo Tomás de Viña del Mar.

Entre los presentadores destacaron Edith Ubilla, Felipe Aguilar, Marcial Beltrami, Claudio Almonacid, Nelson Sepulveda, Rodrigo Castro, Ruben Quispe, Andrea Franjul, Rodrigo Marín y Fabián Inostroza, quienes compartieron sus experiencias de integración TIC en carreras tan diversas como Educación Diferencial, Historia, Ciencias y Pedagogía.

La UDA emitió constancias de participación para todos los presentadores en enero de 2026.',
    'eventos',
    true,
    '2025-12-29 09:00:00+00',
    'manual'
),
(
    'impulsemos-innovacion-600-estudiantes',
    'UMCE participa en "Impulsemos la Innovación": 600 estudiantes de pedagogía integran IA en sus prácticas',
    'La UMCE fue una de las 4 universidades seleccionadas para participar en el Curso Presidencial "Impulsemos la Innovación", que involucra a 600 estudiantes de pedagogía en práctica.',
    'En marzo de 2025, la UMCE se integró al Curso Presidencial "Impulsemos la Innovación", una iniciativa de escala nacional que convocó a 4 universidades chilenas para formar a estudiantes de pedagogía en práctica en el uso pedagógico de la inteligencia artificial.

La participación de la UMCE, liderada por la Unidad de Docencia y Formación Virtual (UDFV), involucró a 600 estudiantes de pedagogía, contribuyendo a un efecto multiplicador estimado de 18.000 estudiantes beneficiados por el aprendizaje recibido.

El proyecto refuerza el compromiso de la UMCE con la formación inicial docente de calidad y con la integración responsable de la IA en las aulas del país.',
    'institucional',
    true,
    '2025-03-15 10:00:00+00',
    'manual'
),
(
    'umce-envia-buena-practica-mineduc-2025',
    'Rectoría UMCE envía Buena Práctica a MINEDUC: fortalecimiento de competencias digitales docentes',
    'La UMCE presentó formalmente al Ministerio de Educación una ficha de buena práctica institucional sobre formación TIC y el Sistema Acompaña UMCE.',
    'En diciembre de 2025, la Rectoría de la UMCE envió al Ministerio de Educación una Ficha de Buena Práctica institucional que sistematiza el trabajo realizado por la Unidad de Docencia y Formación Virtual (UDFV) en dos áreas estratégicas.

La primera iniciativa presentada es el programa de formación TIC para docentes, que entre 2023 y 2025 capacitó a 443 participantes en 38 actividades formativas, logrando un 93% de satisfacción general y un crecimiento sostenido del número de académicos formados (57 → 61 → 94 por año).

La segunda iniciativa es el Sistema Acompaña UMCE, una aplicación inteligente de gestión de recursos para el aprendizaje que apoya el trabajo docente con tecnología institucional.',
    'institucional',
    false,
    '2025-12-15 12:00:00+00',
    'manual'
),
(
    'expertos-umce-integracion-critica-ia-fid',
    'Expertos UMCE impulsan la integración crítica de IA en la Formación Inicial Docente',
    'Un grupo de académicos de la UMCE publicó un análisis colectivo sobre los desafíos y oportunidades de integrar la inteligencia artificial de manera crítica en la formación de futuros docentes.',
    'La UMCE avanza en la construcción de un marco institucional para la integración reflexiva y crítica de la inteligencia artificial en la formación inicial docente (FID). Un grupo de expertos de la universidad realizó un análisis colectivo que aborda los desafíos pedagógicos, éticos y tecnológicos de incorporar la IA en los programas de formación docente.

El análisis, desarrollado en el marco del VIII Jornada de Estudio Lingüístico (JEL), plantea que la integración de la IA en la FID debe superar el enfoque instrumental y avanzar hacia una comprensión crítica de sus implicancias educativas y sociales.

Entre los ejes propuestos se encuentran: la formación en ética de la IA, el desarrollo de pensamiento crítico frente a las herramientas generativas, y el diseño de experiencias de aprendizaje que potencien la autonomía intelectual de los futuros docentes.',
    'investigacion',
    false,
    '2025-09-10 09:00:00+00',
    'manual'
);

-- ---------------------------------------------------------------------------
-- RESOURCES
-- ---------------------------------------------------------------------------
INSERT INTO portal.resources
    (slug, title, type, category, url, description, display_order)
VALUES
(
    'marco-competencias-tic-umce-udfv-2025',
    'Marco de Competencias TIC Docentes UMCE-UDFV 2025',
    'documento',
    'Competencias Digitales',
    'https://drive.google.com/file/d/1TPo4SrasHe_J1csXJgonvclbzKd98xkl',
    'Documento marco que define los niveles de competencia digital para docentes de la UMCE. Alineado con el marco DigComp de la Unión Europea y las directrices MINEDUC-UNESCO para competencias digitales docentes.',
    1
),
(
    'resolucion-certificacion-competencias-digitales',
    'Resolución Exenta N°2025-00-1545 — Certificación de Competencias Digitales',
    'documento',
    'Marco Legal',
    NULL,
    'Resolución oficial de la UMCE que autoriza y regula el proceso de certificación de competencias digitales docentes. Disponible para descarga en formato PDF.',
    2
),
(
    'dashboard-docente-umce',
    'Dashboard Docente UMCE',
    'herramienta',
    'Plataformas',
    'https://dashboard.udfv.cloud',
    'Plataforma de análisis y seguimiento del desempeño docente en los entornos virtuales de la UMCE. Permite visualizar métricas de actividad, participación estudiantil y progreso en las 5 plataformas Moodle.',
    3
),
(
    'asistente-virtual-udfv',
    'Asistente Virtual UDFV (@asistente_udfv_bot)',
    'herramienta',
    'Plataformas',
    'https://t.me/asistente_udfv_bot',
    'Bot de Telegram con IA que responde consultas sobre las plataformas Moodle de la UMCE, cursos disponibles y procedimientos académicos. Disponible las 24 horas.',
    4
),
(
    'guia-moodle-docentes-umce',
    'Guía Moodle para Docentes UMCE',
    'guia',
    'Plataformas',
    'https://docs.google.com/document/d/1XUhz6P3aso9n7ovg_XrQUWemso0hQHzMYK6odc5lKJk',
    'Guía completa para docentes sobre el uso de las plataformas Moodle de la UMCE. Cubre gestión de cursos, actividades, calificaciones y comunicación con estudiantes. Actualizada en enero de 2026.',
    5
),
(
    'diagnostico-tic-pregrado-2025-powerbi',
    'Diagnóstico de Competencias TIC Pregrado 2025 (Power BI)',
    'reporte',
    'Investigacion',
    'https://app.powerbi.com/view?r=eyJrIjoiZTYwODFjYzUtYWIwOS00YWE2LWJkNmEtYmNlODliYjQ1YWU3IiwidCI6IjNhYTg3OGUxLTczMjctNGM5Ny05YzMwLTZlOGY4Nzc0ZTQ1MiJ9',
    'Informe interactivo con los resultados del diagnóstico de competencias TIC aplicado a estudiantes de pregrado en 2025. Presentado en la Sesión Mirada UMCE N°5 y distribuido a ~50 directores y secretarios académicos.',
    6
),
(
    'ruta-formativa-ia-competencias-docentes-gdoc',
    'Ruta Formativa: Competencias Docentes en IA (documento completo)',
    'documento',
    'Formacion',
    'https://docs.google.com/document/d/1QKASW3jmdZzI6F8jlKQm_UnTJhxsUaRBQlfQ1A7dCw4',
    'Documento completo de la Ruta Formativa en Competencias Docentes en IA. Detalla los 3 niveles, los 12 cursos que la componen y la alineación con el Marco MINEDUC de Competencias Digitales Docentes 2023.',
    7
);

-- ---------------------------------------------------------------------------
-- SYNC LOG — initial record
-- ---------------------------------------------------------------------------
INSERT INTO portal.sync_log
    (source, sync_type, items_found, items_created, items_updated, status, completed_at)
VALUES
(
    'seed-portal.sql',
    'initial_seed',
    0,
    (SELECT COUNT(*) FROM portal.programs) +
    (SELECT COUNT(*) FROM portal.courses) +
    (SELECT COUNT(*) FROM portal.team_members) +
    (SELECT COUNT(*) FROM portal.testimonials) +
    (SELECT COUNT(*) FROM portal.news) +
    (SELECT COUNT(*) FROM portal.resources),
    0,
    'completed',
    now()
);
