"use strict";
// Usage: npm run create-admin -- "Full Name" email@example.com [super_admin|editor|finance]
// The password is typed at a prompt (hidden) or read from ADMIN_PASSWORD. No default password exists.
const readline = require("readline");
const { open } = require("./lib/db");
const { hashPassword } = require("./lib/http");
const [name, email, role = "super_admin"] = process.argv.slice(2);
if (!name || !email || !["super_admin", "editor", "finance"].includes(role)) {
  console.error('Usage: npm run create-admin -- "Full Name" email@example.com [super_admin|editor|finance]'); process.exit(1);
}
function ask(q) {
  return new Promise((res) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (s) => { if (s.includes(q)) rl.output.write(s); };
    rl.question(q, (a) => { rl.close(); process.stdout.write("\n"); res(a); });
  });
}
(async () => {
  const pw = process.env.ADMIN_PASSWORD || await ask("Password (12+ characters): ");
  if (pw.length < 12) { console.error("Password must be at least 12 characters."); process.exit(1); }
  const db = open();
  const e = email.trim().toLowerCase();
  if (db.prepare("SELECT 1 FROM admins WHERE email=?").get(e)) {
    db.prepare("UPDATE admins SET password_hash=?, name=?, role=?, is_active=1 WHERE email=?").run(hashPassword(pw), name, role, e);
    console.log("Updated existing admin " + e);
  } else {
    db.prepare("INSERT INTO admins(name,email,password_hash,role) VALUES (?,?,?,?)").run(name, e, hashPassword(pw), role);
    console.log(`Created ${role} ${e}`);
  }
})();
