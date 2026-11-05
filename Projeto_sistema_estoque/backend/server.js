const path = require("path");
const express = require("express");
const cors = require("cors");
const db = require("./banco");

const PORTA = process.env.PORT || 3000;
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "frontend")));

class ErroHttp extends Error {
  constructor(status, mensagem) {
    super(mensagem);
    this.status = status;
  }
}

function texto(valor, campo, { obrigatorio = false, max = 60 } = {}) {
  const t = typeof valor === "string" ? valor.trim() : "";
  if (obrigatorio && !t) throw new ErroHttp(400, `O campo "${campo}" é obrigatório.`);
  if (t.length > max) throw new ErroHttp(400, `O campo "${campo}" aceita no máximo ${max} caracteres.`);
  return t;
}

function inteiro(valor, campo, { minimo = 0 } = {}) {
  const n = typeof valor === "string" && valor.trim() !== "" ? Number(valor) : valor;
  if (!Number.isInteger(n) || n < minimo) {
    throw new ErroHttp(400, `O campo "${campo}" deve ser um número inteiro maior ou igual a ${minimo}.`);
  }
  return n;
}

const SQL_ITEM = `
  SELECT id, codigo AS cod, nome, categoria AS cat, localizacao AS loc,
         quantidade AS qtd, minimo AS min
  FROM itens
`;

const listarItens = db.prepare(`${SQL_ITEM} ORDER BY nome COLLATE NOCASE`);
const buscarItem = db.prepare(`${SQL_ITEM} WHERE id = ?`);
const buscarPorCodigo = db.prepare("SELECT id FROM itens WHERE codigo = ?");
const inserirItem = db.prepare(`
  INSERT INTO itens (codigo, nome, categoria, localizacao, quantidade, minimo)
  VALUES (@cod, @nome, @cat, @loc, @qtd, @min)
`);
const excluirItem = db.prepare("DELETE FROM itens WHERE id = ?");

const listarMovimentacoes = db.prepare(`
  SELECT m.id,
         strftime('%Y-%m-%dT%H:%M:%SZ', m.criado_em) AS data,
         i.codigo AS cod, i.nome, m.tipo, m.quantidade AS qtd, m.responsavel AS resp
  FROM movimentacoes m
  JOIN itens i ON i.id = m.item_id
  ORDER BY m.id DESC
  LIMIT ?
`);
const atualizarSaldo = db.prepare("UPDATE itens SET quantidade = ? WHERE id = ?");
const inserirMovimentacao = db.prepare(`
  INSERT INTO movimentacoes (item_id, tipo, quantidade, responsavel)
  VALUES (?, ?, ?, ?)
`);

const registrarMovimentacao = db.transaction((itemId, tipo, qtd, resp) => {
  const item = buscarItem.get(itemId);
  if (!item) throw new ErroHttp(404, "Item não encontrado.");

  const novoSaldo = tipo === "entrada" ? item.qtd + qtd : item.qtd - qtd;
  if (novoSaldo < 0) {
    throw new ErroHttp(400, `Saída maior que o saldo: o item ${item.cod} tem ${item.qtd} unidades.`);
  }

  atualizarSaldo.run(novoSaldo, itemId);
  inserirMovimentacao.run(itemId, tipo, qtd, resp);
  return buscarItem.get(itemId);
});

app.get("/itens", (req, res) => {
  res.json(listarItens.all());
});

app.post("/itens", (req, res) => {
  const corpo = req.body || {};
  const item = {
    cod: texto(corpo.cod, "cod", { obrigatorio: true, max: 20 }).toUpperCase(),
    nome: texto(corpo.nome, "nome", { obrigatorio: true }),
    cat: texto(corpo.cat, "cat", { max: 40 }),
    loc: texto(corpo.loc, "loc", { max: 30 }),
    qtd: inteiro(corpo.qtd ?? 0, "qtd"),
    min: inteiro(corpo.min ?? 0, "min"),
  };

  if (buscarPorCodigo.get(item.cod)) {
    throw new ErroHttp(409, `Já existe um item com o código ${item.cod}.`);
  }

  const { lastInsertRowid } = inserirItem.run(item);
  res.status(201).json(buscarItem.get(lastInsertRowid));
});

app.delete("/itens/:id", (req, res) => {
  const id = inteiro(req.params.id, "id", { minimo: 1 });
  const { changes } = excluirItem.run(id);
  if (!changes) throw new ErroHttp(404, "Item não encontrado.");
  res.status(204).end();
});

app.get("/movimentacoes", (req, res) => {
  const limite = Math.min(Math.max(parseInt(req.query.limite, 10) || 10, 1), 200);
  res.json(listarMovimentacoes.all(limite));
});

app.post("/movimentacoes", (req, res) => {
  const corpo = req.body || {};
  const itemId = inteiro(corpo.item_id, "item_id", { minimo: 1 });
  const tipo = corpo.tipo;
  if (tipo !== "entrada" && tipo !== "saida") {
    throw new ErroHttp(400, 'O campo "tipo" deve ser "entrada" ou "saida".');
  }
  const qtd = inteiro(corpo.qtd, "qtd", { minimo: 1 });
  const resp = texto(corpo.resp, "resp", { obrigatorio: true, max: 40 });

  res.status(201).json(registrarMovimentacao(itemId, tipo, qtd, resp));
});

app.use((req, res) => {
  res.status(404).json({ erro: "Rota não encontrada." });
});

app.use((err, req, res, next) => {
  if (err instanceof ErroHttp) {
    return res.status(err.status).json({ erro: err.message });
  }
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ erro: "JSON inválido no corpo da requisição." });
  }
  console.error(err);
  res.status(500).json({ erro: "Erro interno do servidor." });
});

app.listen(PORTA, () => {
  console.log(`Servidor rodando em http://localhost:${PORTA}`);
});