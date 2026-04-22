const fs = require("fs");
const path = require("path");
const db = require("./connection");

const migrationsDir = path.resolve(__dirname, "migrations");

function ensureMigrationsTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

function runMigrations() {
  ensureMigrationsTable();

  const migrationFiles = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  const applied = new Set(
    db.prepare("SELECT name FROM schema_migrations").all().map((row) => row.name)
  );

  for (const fileName of migrationFiles) {
    if (applied.has(fileName)) {
      continue;
    }

    const sql = fs.readFileSync(path.join(migrationsDir, fileName), "utf-8");
    const tx = db.transaction(() => {
      db.exec(sql);
      db.prepare("INSERT INTO schema_migrations (name) VALUES (?)").run(fileName);
    });

    tx();
    console.log(`Applied migration: ${fileName}`);
  }
}

if (require.main === module) {
  runMigrations();
  console.log("Database initialized.");
}

module.exports = {
  runMigrations,
};
