"use strict";
const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");
const cfg = require("../../config/config");

function open(file = cfg.dbFile) {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;");
  migrate(db);
  seedOnce(db);
  return db;
}

function migrate(db) {
  db.exec("CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT (datetime('now')))");
  const dir = path.join(cfg.ROOT, "database", "migrations");
  const done = new Set(db.prepare("SELECT name FROM schema_migrations").all().map((r) => r.name));
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) {
    if (done.has(f)) continue;
    db.exec("BEGIN");
    try {
      db.exec(fs.readFileSync(path.join(dir, f), "utf8"));
      db.prepare("INSERT INTO schema_migrations(name) VALUES (?)").run(f);
      db.exec("COMMIT");
    } catch (e) { db.exec("ROLLBACK"); throw new Error(`Migration ${f} failed: ${e.message}`); }
  }
}

// Seed ONLY what the foundation has actually provided: its own images and neutral placeholders.
// No donations, statistics, partner names or children counts are invented. Edit everything in the admin dashboard.
function seedOnce(db) {
  if (db.prepare("SELECT v FROM kv WHERE k='seeded'").get()) return;
  const ins = (sql, rows) => rows.forEach((r) => db.prepare(sql).run(...r));
  ins("INSERT INTO management_team(name,position,bio,photo,is_group,sort_order) VALUES (?,?,?,?,?,?)", [
    ["Management team", "Leadership", "Meet the people guiding the foundation.", "/assets/images/management-members.jpg", 1, 0],
    ["Management member", "Executive", "", "/assets/images/management-member.jpg", 0, 1],
  ]);
  ins("INSERT INTO team_members(name,role,photo,is_group,sort_order) VALUES (?,?,?,?,?)", [
    ["Our team", "Volunteers and staff", "/assets/images/team-01.jpg", 1, 0],
    ["Together with team of Rosa", "Foundation team", "/assets/images/team-02.jpg", 1, 1],
  ]);
  ins("INSERT INTO partners(name,website,logo,description,sort_order) VALUES (?,?,?,?,?)", [
    ["Feed Uganda", null, "/assets/images/partners.png", "Logo supplied by the foundation. Edit or remove in the admin dashboard (Partners).", 0],
  ]);
  ins("INSERT INTO gallery(album,category,caption,alt_text,image,sort_order) VALUES (?,?,?,?,?,?)", [
    ["Our team", "Team", "The foundation team", "Members of the foundation team in matching polo shirts", "/assets/images/team-01.jpg", 0],
    ["Our team", "Team", "Team members together", "Foundation team members standing in front of a garden wall", "/assets/images/team-02.jpg", 1],
    ["Leadership", "Team", "Foundation management", "Two members of the management team", "/assets/images/management-members.jpg", 2],
  ]);
  ins("INSERT INTO projects(title,slug,summary,description,goals,status,sort_order) VALUES (?,?,?,?,?,?,?)", [
    ["Education support", "education-support", "Helping children stay in school and learn.",
      "We want every child we support to have what they need to attend school and keep learning. We are still defining this programme with our team and partners.",
      "Plan school-fee and supplies support\nIdentify children in need of support\nFind education partners", "planning", 0],
    ["Basic needs assistance", "basic-needs-assistance", "Food, clothing and essentials for children in our care.",
      "We currently support a small number of children and are starting to organise how we provide for their everyday needs.",
      "Support children we already know\nBuild a transparent process for requests\nGrow as supporters join us", "starting", 1],
    ["Child wellbeing", "child-wellbeing", "Care, safety and encouragement.",
      "Wellbeing covers a child's health, safety and emotional support. This programme is at the planning stage.",
      "Define wellbeing goals with our team\nSet child-safeguarding rules\nBuild local partnerships", "planning", 2],
    ["Community development", "community-development", "Strengthening the families and neighbourhoods children grow up in.",
      "Children do best when their communities are strong. We will shape this programme as we learn from the families we meet.",
      "Listen to community needs\nBring volunteers together\nBuild long-term partnerships", "planning", 3],
  ]);
  db.prepare("INSERT INTO kv(k,v) VALUES ('seeded','1')").run();
}
module.exports = { open };
