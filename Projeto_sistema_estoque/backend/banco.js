const path = require("path");
const Database = require("better-sqlite3");

const caminho = process.env.DB_PATH || path.join(__dirname, "estoque.db");
const db = new Database(caminho);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS itens (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo      TEXT    NOT NULL UNIQUE,
    nome        TEXT    NOT NULL,
    categoria   TEXT    NOT NULL DEFAULT '',
    localizacao TEXT    NOT NULL DEFAULT '',
    quantidade  INTEGER NOT NULL DEFAULT 0 CHECK (quantidade >= 0),
    minimo      INTEGER NOT NULL DEFAULT 0 CHECK (minimo >= 0)
  );

  CREATE TABLE IF NOT EXISTS movimentacoes (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id     INTEGER NOT NULL REFERENCES itens(id) ON DELETE CASCADE,
    tipo        TEXT    NOT NULL CHECK (tipo IN ('entrada', 'saida')),
    quantidade  INTEGER NOT NULL CHECK (quantidade > 0),
    responsavel TEXT    NOT NULL,
    criado_em   TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_movimentacoes_item ON movimentacoes(item_id);
`);

module.exports = db;