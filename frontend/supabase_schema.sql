-- ============================================================
-- GRUPO ICAA CONSTRUCTORA — Supabase Schema v2
-- Pegar COMPLETO en: Supabase Dashboard → SQL Editor → Run
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Clean slate
DROP TABLE IF EXISTS daily_logs,photos,materials,machinery,calendar_events,tasks,project_members,projects,users CASCADE;

-- ── Tables ───────────────────────────────────────────────────
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, password TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'Worker' CHECK (role IN ('Admin','Engineer','Supervisor','Worker')),
  position TEXT, specialty TEXT, phone TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, client TEXT, location TEXT, start_date DATE,
  duration_weeks INT NOT NULL DEFAULT 12,
  status TEXT NOT NULL DEFAULT 'Planning' CHECK (status IN ('Planning','Active','Delayed','Completed','On Hold')),
  progress INT NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  description TEXT, budget NUMERIC(14,2) NOT NULL DEFAULT 0, spent NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_role TEXT NOT NULL DEFAULT 'Member', UNIQUE (project_id, user_id)
);
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  start_week INT NOT NULL DEFAULT 1, end_week INT NOT NULL DEFAULT 2,
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Started','In Progress','Completed')),
  progress INT NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  priority TEXT NOT NULL DEFAULT 'Medium' CHECK (priority IN ('Low','Medium','High')),
  description TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL, description TEXT, start_date DATE NOT NULL, end_date DATE,
  type TEXT NOT NULL DEFAULT 'Task' CHECK (type IN ('Task','Meeting','Inspection','Delivery','Other')),
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  color TEXT NOT NULL DEFAULT '#f97316', created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename TEXT NOT NULL, original_name TEXT, url TEXT NOT NULL,
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  caption TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE machinery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, type TEXT, brand TEXT, model TEXT, serial_number TEXT,
  status TEXT NOT NULL DEFAULT 'Available' CHECK (status IN ('Available','In Use','Maintenance')),
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, unit TEXT NOT NULL DEFAULT 'units',
  quantity NUMERIC(12,3) NOT NULL DEFAULT 0, used_quantity NUMERIC(12,3) NOT NULL DEFAULT 0,
  cost_per_unit NUMERIC(12,2) NOT NULL DEFAULT 0,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  supplier TEXT, notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE daily_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  log_date DATE NOT NULL, weather TEXT, workers INT DEFAULT 0,
  notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────
CREATE INDEX ON tasks(project_id); CREATE INDEX ON tasks(assigned_to); CREATE INDEX ON tasks(status);
CREATE INDEX ON project_members(project_id); CREATE INDEX ON project_members(user_id);
CREATE INDEX ON calendar_events(project_id); CREATE INDEX ON calendar_events(start_date);
CREATE INDEX ON materials(project_id); CREATE INDEX ON machinery(project_id); CREATE INDEX ON machinery(status);

-- ============================================================
-- SEED DATA  (pgcrypto generates bcrypt-compatible hashes)
-- admin password : ICAAadmin2026
-- others password: icaa1234
-- ============================================================
DO $$
DECLARE
  admin_id UUID; eng1_id UUID; eng2_id UUID; sup_id UUID; w1_id UUID; w2_id UUID;
  p1_id UUID; p2_id UUID; p3_id UUID;
BEGIN
  INSERT INTO users (name,email,password,role,position,specialty,phone) VALUES
    ('Administrador ICAA','admin@grupoicaa.com', crypt('ICAAadmin2026',gen_salt('bf',10)),'Admin','Administrador General','Administración','+506 2222-0000'),
    ('Carlos Méndez Rojas','carlos@grupoicaa.com',crypt('icaa1234',gen_salt('bf',10)),'Engineer','Ingeniero Civil','Estructuras','+506 8811-1234'),
    ('Ana Rodríguez Mora','ana@grupoicaa.com',    crypt('icaa1234',gen_salt('bf',10)),'Engineer','Ingeniera Eléctrica','Instalaciones Eléctricas','+506 8822-5678'),
    ('Luis Torres Vargas','luis@grupoicaa.com',   crypt('icaa1234',gen_salt('bf',10)),'Supervisor','Supervisor de Obra','Construcción General','+506 8833-9012'),
    ('Pedro Jiménez Q.','pedro@grupoicaa.com',    crypt('icaa1234',gen_salt('bf',10)),'Worker','Operario','Albañilería','+506 8844-3456'),
    ('María Solís Castro','maria@grupoicaa.com',  crypt('icaa1234',gen_salt('bf',10)),'Worker','Técnico Eléctrico','Electricidad','+506 8855-7890');

  SELECT id INTO admin_id FROM users WHERE email='admin@grupoicaa.com';
  SELECT id INTO eng1_id  FROM users WHERE email='carlos@grupoicaa.com';
  SELECT id INTO eng2_id  FROM users WHERE email='ana@grupoicaa.com';
  SELECT id INTO sup_id   FROM users WHERE email='luis@grupoicaa.com';
  SELECT id INTO w1_id    FROM users WHERE email='pedro@grupoicaa.com';
  SELECT id INTO w2_id    FROM users WHERE email='maria@grupoicaa.com';

  INSERT INTO projects (name,client,location,start_date,duration_weeks,status,progress,description,budget) VALUES
    ('Residencial Las Palmas','Inversiones Garza S.A.','San José, Costa Rica','2026-01-05',24,'Active',45,'Complejo residencial de 24 apartamentos con amenidades completas.',850000),
    ('Centro Comercial Alajuela','Grupo Comercial Norte S.A.','Alajuela, Costa Rica','2026-02-02',36,'Active',15,'Centro comercial con 40 locales, área de comidas y estacionamiento.',2300000),
    ('Bodega Industrial Cartago','LogiCR Almacenes S.A.','Cartago, Costa Rica','2025-09-01',16,'Completed',100,'Bodega industrial de 3000 m² con zona de carga y descarga.',640000);

  SELECT id INTO p1_id FROM projects WHERE name='Residencial Las Palmas';
  SELECT id INTO p2_id FROM projects WHERE name='Centro Comercial Alajuela';
  SELECT id INTO p3_id FROM projects WHERE name='Bodega Industrial Cartago';

  INSERT INTO project_members (project_id,user_id,project_role) VALUES
    (p1_id,eng1_id,'Engineer'),(p1_id,sup_id,'Supervisor'),(p1_id,w1_id,'Worker'),
    (p2_id,eng2_id,'Engineer'),(p2_id,sup_id,'Supervisor'),
    (p3_id,eng1_id,'Engineer'),(p3_id,w2_id,'Worker');

  INSERT INTO tasks (name,project_id,assigned_to,start_week,end_week,status,progress,priority,description) VALUES
    ('Movimiento de tierras',          p1_id,eng1_id, 1, 3,'Completed',  100,'High',  'Excavación y nivelación del terreno.'),
    ('Fundaciones y cimentación',      p1_id,eng1_id, 3, 6,'Completed',  100,'High',  'Zapatas y vigas de cimentación.'),
    ('Estructura de concreto nivel 1', p1_id,sup_id,  6,10,'In Progress', 65,'High',  'Columnas, vigas y losa nivel 1.'),
    ('Estructura de concreto nivel 2', p1_id,sup_id, 10,14,'Pending',      0,'High',  'Columnas, vigas y losa nivel 2.'),
    ('Instalaciones eléctricas niv.1', p1_id,eng2_id, 9,14,'Pending',      0,'Medium','Canalizaciones y cableado.'),
    ('Levantado de paredes nivel 1',   p1_id,w1_id,  10,16,'Pending',      0,'Medium','Blocks de concreto.'),
    ('Repello y acabados nivel 1',     p1_id,w1_id,  16,20,'Pending',      0,'Low',   'Repello fino y pintura base.'),
    ('Instalaciones hidrosanitarias',  p1_id,sup_id, 12,18,'Pending',      0,'Medium','Tuberías de agua y drenajes.'),
    ('Estudio de suelos',                   p2_id,eng1_id, 1, 2,'Completed',  100,'High','Sondeos y análisis de laboratorio.'),
    ('Diseño estructural y arq.',           p2_id,eng2_id, 1, 5,'In Progress', 75,'High','Planos finales para permiso.'),
    ('Trámite de permisos municipales',     p2_id,eng2_id, 3, 8,'In Progress', 40,'High','CFIA, Municipalidad y SETENA.'),
    ('Movimiento de tierras',               p2_id,sup_id,  8,11,'Pending',      0,'High','Corte y relleno.'),
    ('Fundaciones',                         p2_id,eng1_id,11,15,'Pending',      0,'High','Fundaciones profundas.'),
    ('Movimiento de tierras',       p3_id,eng1_id, 1, 2,'Completed',100,'High',NULL),
    ('Losa de concreto industrial', p3_id,eng1_id, 2, 6,'Completed',100,'High',NULL),
    ('Estructura metálica',         p3_id,sup_id,  5,10,'Completed',100,'High',NULL),
    ('Cubierta y cerramientos',     p3_id,w2_id,   9,13,'Completed',100,'Medium',NULL),
    ('Instalaciones y acabados',    p3_id,w2_id,  12,16,'Completed',100,'Medium',NULL);

  INSERT INTO calendar_events (title,description,start_date,end_date,type,project_id,user_id,color) VALUES
    ('Reunión de avance semanal','Revisión de progreso','2026-03-23','2026-03-23','Meeting',   p1_id,admin_id,'#3b82f6'),
    ('Inspección de cimentación','Revisión CFIA',       '2026-03-25','2026-03-25','Inspection',p1_id,eng1_id, '#8b5cf6'),
    ('Entrega de planos finales','Entrega municipio',   '2026-03-28','2026-03-28','Delivery',  p2_id,eng2_id, '#22c55e'),
    ('Reunión con cliente',      'Actualización',       '2026-04-01','2026-04-01','Meeting',   p2_id,admin_id,'#3b82f6'),
    ('Colada de losa nivel 1',   'Colada 06:00am',      '2026-04-07','2026-04-07','Task',      p1_id,sup_id,  '#f97316'),
    ('Inspección municipal P2',  'Visita inspector',    '2026-04-15','2026-04-15','Inspection',p2_id,eng2_id, '#8b5cf6');

  INSERT INTO machinery (name,type,brand,model,serial_number,status,project_id,notes) VALUES
    ('Excavadora de Cadenas 320','Excavadora','CAT','320GX','CAT-320-2021-001','In Use',p1_id,'Arrendada hasta Junio 2026'),
    ('Grúa Torre 40m','Grúa','Liebherr','280EC','LH-280-2020-088','In Use',p1_id,'Capacidad 8 toneladas'),
    ('Retroexcavadora JD 310','Retroexcavadora','John Deere','310SL','JD-310-2019-045','Available',NULL,''),
    ('Compactadora de suelo','Compactadora','Wacker','DS70','WN-DS70-2022-011','Available',NULL,''),
    ('Mezcladora de Concreto 1m³','Mezcladora','FIORI','DB 260','FI-260-2020-033','Maintenance',NULL,'Cambio de motor'),
    ('Pluma Hidráulica 5T','Pluma','Yale','PH5000','YL-PH5-2018-009','Available',NULL,'');

  INSERT INTO materials (name,unit,quantity,used_quantity,cost_per_unit,project_id,supplier,notes) VALUES
    ('Concreto premezclado 210 kg/cm²','m³',    500,220, 85.00,p1_id,'Holcim Costa Rica','Pedidos mínimos 6m³'),
    ('Varilla corrugada #4',           'kg',  12000,5500,  1.25,p1_id,'Aceros TICO S.A.',''),
    ('Varilla corrugada #6',           'kg',   8000,3100,  1.80,p1_id,'Aceros TICO S.A.',''),
    ('Blocks de concreto 15x20x40',   'unidades',15000,0, 0.55,p1_id,'Blocks del Sur','Entrega sem. 10'),
    ('Cemento Portland tipo I',        'sacos',  800, 310,  8.50,p1_id,'CEMEX Costa Rica',''),
    ('Acero estructural A36',          'kg',   9500,  0,   1.95,p2_id,'Metal Sur S.A.',''),
    ('Arena de río lavada',            'm³',    200, 80,  22.00,p2_id,'Arenas del Norte',''),
    ('Piedrín 3/4"',                   'm³',    180, 60,  28.00,p2_id,'Quebradores La Unión','');

END $$;

-- Confirm
SELECT name, email, role FROM users ORDER BY role, name;
