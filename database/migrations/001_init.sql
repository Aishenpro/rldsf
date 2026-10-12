-- Rosa Lomba Da Silva Foundation: initial schema (SQLite). Foreign keys are enforced (PRAGMA foreign_keys=ON).
CREATE TABLE admins (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'editor' CHECK (role IN ('super_admin','editor','finance')),
  is_active INTEGER NOT NULL DEFAULT 1, last_login_at TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE sessions (
  id TEXT PRIMARY KEY, admin_id INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  csrf TEXT NOT NULL, expires_at INTEGER NOT NULL, ip TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_sessions_admin ON sessions(admin_id);
CREATE TABLE users (  -- supporters who start fundraisers (no password; contact record only)
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE campaigns (  -- official foundation campaigns donors can give to
  id INTEGER PRIMARY KEY, title TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, description TEXT, image TEXT,
  target_amount REAL, currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','closed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE fundraisers (  -- supporter-created fundraising pages; need admin approval
  id INTEGER PRIMARY KEY, user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  title TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, description TEXT NOT NULL, image TEXT,
  target_amount REAL NOT NULL CHECK (target_amount > 0), currency TEXT NOT NULL DEFAULT 'USD', deadline TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','closed')),
  admin_notes TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_fundraisers_status ON fundraisers(status);
CREATE TABLE donations (
  id INTEGER PRIMARY KEY, public_code TEXT NOT NULL UNIQUE, receipt_no TEXT UNIQUE,
  donor_name TEXT NOT NULL, email TEXT NOT NULL, is_anonymous INTEGER NOT NULL DEFAULT 0,
  amount REAL NOT NULL CHECK (amount > 0), currency TEXT NOT NULL,
  frequency TEXT NOT NULL DEFAULT 'one_time' CHECK (frequency IN ('one_time','monthly')),
  method TEXT NOT NULL CHECK (method IN ('paypal','stripe','bank_transfer','mobile_money')),
  campaign_id INTEGER REFERENCES campaigns(id) ON DELETE SET NULL,
  fundraiser_id INTEGER REFERENCES fundraisers(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','failed','refunded')),
  provider_ref TEXT, note TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), paid_at TEXT
);
CREATE INDEX idx_donations_status ON donations(status);
CREATE INDEX idx_donations_campaign ON donations(campaign_id);
CREATE INDEX idx_donations_fundraiser ON donations(fundraiser_id);
CREATE INDEX idx_donations_email ON donations(email);
CREATE TABLE volunteers (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT, location TEXT,
  skills TEXT, availability TEXT, interests TEXT, message TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','reviewing','accepted','declined')),
  admin_notes TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_volunteers_status ON volunteers(status);
CREATE TABLE projects (
  id INTEGER PRIMARY KEY, title TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, summary TEXT, description TEXT, goals TEXT, image TEXT,
  status TEXT NOT NULL DEFAULT 'planning' CHECK (status IN ('planning','starting','active')),
  sort_order INTEGER NOT NULL DEFAULT 0, is_published INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE blog_posts (
  id INTEGER PRIMARY KEY, title TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, category TEXT, excerpt TEXT, body TEXT NOT NULL, image TEXT,
  author TEXT, meta_title TEXT, meta_description TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  published_at TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_blog_status ON blog_posts(status, published_at);
CREATE TABLE gallery (
  id INTEGER PRIMARY KEY, album TEXT NOT NULL DEFAULT 'General', category TEXT, caption TEXT, alt_text TEXT, image TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0, is_published INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_gallery_album ON gallery(album);
CREATE TABLE management_team (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, position TEXT, bio TEXT, photo TEXT, is_group INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0, is_published INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE team_members (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, role TEXT, bio TEXT, photo TEXT, is_group INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0, is_published INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE partners (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, website TEXT, logo TEXT, description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0, is_published INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE contacts (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, subject TEXT, message TEXT NOT NULL,
  is_read INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE newsletter_subscribers (
  id INTEGER PRIMARY KEY, email TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE financial_reports (
  id INTEGER PRIMARY KEY, title TEXT NOT NULL, report_type TEXT NOT NULL DEFAULT 'financial', period TEXT, description TEXT, file TEXT,
  is_published INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE page_views (
  id INTEGER PRIMARY KEY, day TEXT NOT NULL, visitor_hash TEXT NOT NULL, path TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_views_day ON page_views(day, visitor_hash);
CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY, admin_id INTEGER REFERENCES admins(id) ON DELETE SET NULL, action TEXT NOT NULL, detail TEXT, ip TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE kv (k TEXT PRIMARY KEY, v TEXT);
