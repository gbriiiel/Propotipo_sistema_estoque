const API_URL = "";
const $ = (id) => document.getElementById(id);

let estado = { itens: [], historico: [] };
let erroCarga = "";

async function requisitar(caminho, opcoes = {}) {
  const config = { ...opcoes };
  if (config.body) config.headers = { "Content-Type": "application/json" };

  let resposta;
  try {
    resposta = await fetch(API_URL + caminho, config);
  } catch (e) {
    throw new Error("Não foi possível conectar ao servidor. Confira se ele está rodando (npm start).");
  }

  if (resposta.status === 204) return null;

  let dados = null;
  try {
    dados = await resposta.json();
  } catch (e) {}

  if (!resposta.ok) {
    throw new Error((dados && dados.erro) || "Erro ao falar com o servidor.");
  }
  return dados;
}

async function recarregar() {
  try {
    const [itens, historico] = await Promise.all([
      requisitar("/itens"),
      requisitar("/movimentacoes?limite=10"),
    ]);
    estado.itens = itens;
    estado.historico = historico;
    erroCarga = "";
  } catch (e) {
    erroCarga = e.message;
  }
  renderTudo();
}

function formatarData(iso) {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function el(tag, texto, classe) {
  const e = document.createElement(tag);
  if (texto !== undefined) e.textContent = texto;
  if (classe) e.className = classe;
  return e;
}

function avisar(id, texto, erro) {
  const p = $(id);
  p.textContent = texto;
  p.className = erro ? "aviso erro" : "aviso";
}

const critico = (i) => i.qtd < i.min;

function renderResumo() {
  $("r-itens").textContent = estado.itens.length;
  $("r-unid").textContent = estado.itens.reduce((s, i) => s + i.qtd, 0);
  $("r-crit").textContent = estado.itens.filter(critico).length;
}

function renderSelect() {
  const sel = $("m-item");
  const anterior = sel.value;
  sel.replaceChildren();

  if (!estado.itens.length) {
    const o = el("option", "Cadastre um item primeiro");
    o.value = "";
    sel.append(o);
    return;
  }

  estado.itens.forEach((i) => {
    const o = el("option", i.cod + " – " + i.nome);
    o.value = i.id;
    sel.append(o);
  });

  if (estado.itens.some((i) => String(i.id) === anterior)) sel.value = anterior;
}

function renderTabela() {
  const termo = $("busca").value.trim().toLowerCase();
  const so = $("so-criticos").checked;
  const corpo = $("corpo");
  corpo.replaceChildren();

  const itens = estado.itens.filter((i) => {
    const texto = (i.cod + " " + i.nome + " " + i.cat).toLowerCase();
    return texto.includes(termo) && (!so || critico(i));
  });

  if (!itens.length) {
    let mensagem = "Nenhum item cadastrado. Use o formulário ao lado para cadastrar o primeiro.";
    if (erroCarga) mensagem = erroCarga;
    else if (estado.itens.length) mensagem = "Nenhum item encontrado com esse filtro.";

    const tr = el("tr");
    const td = el("td", mensagem, "vazio");
    td.colSpan = 8;
    tr.append(td);
    corpo.append(tr);
    return;
  }

  itens.forEach((i) => {
    const tr = el("tr", undefined, critico(i) ? "critico" : "");
    tr.append(
      el("td", i.cod, "cod"), el("td", i.nome), el("td", i.cat || "–"), el("td", i.loc || "–"),
      el("td", i.qtd, "num"), el("td", i.min, "num"),
      el("td", critico(i) ? "Repor" : "Ok", "sit")
    );
    const td = el("td");
    const b = el("button", "Excluir", "excluir");
    b.type = "button";
    b.addEventListener("click", () => excluir(i));
    td.append(b);
    tr.append(td);
    corpo.append(tr);
  });
}

function renderHistorico() {
  const ul = $("historico");
  ul.replaceChildren();

  if (!estado.historico.length) {
    ul.append(el("li", "Nenhuma movimentação registrada ainda."));
    return;
  }

  estado.historico.forEach((h) => {
    const li = el("li");
    li.append(
      el("span", formatarData(h.data), "data"),
      el("span", (h.tipo === "entrada" ? "+" : "−") + h.qtd, h.tipo),
      el("span", h.cod + " – " + h.nome),
      el("span", "por " + h.resp)
    );
    ul.append(li);
  });
}

function renderTudo() {
  renderResumo();
  renderSelect();
  renderTabela();
  renderHistorico();
}

async function excluir(item) {
  if (!confirm("Excluir o item " + item.cod + " – " + item.nome + "? O histórico dele também será apagado.")) return;
  try {
    await requisitar("/itens/" + item.id, { method: "DELETE" });
    await recarregar();
  } catch (e) {
    alert(e.message);
  }
}

$("form-item").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  const corpo = {
    cod: $("i-cod").value,
    nome: $("i-nome").value,
    cat: $("i-cat").value,
    loc: $("i-loc").value,
    qtd: parseInt($("i-qtd").value, 10) || 0,
    min: parseInt($("i-min").value, 10) || 0,
  };

  try {
    const criado = await requisitar("/itens", { method: "POST", body: JSON.stringify(corpo) });
    form.reset();
    avisar("aviso-item", "Item " + criado.cod + " cadastrado.");
    await recarregar();
  } catch (erro) {
    avisar("aviso-item", erro.message, true);
  }
});

$("form-mov").addEventListener("submit", async (e) => {
  e.preventDefault();
  const itemId = parseInt($("m-item").value, 10);
  if (!itemId) {
    avisar("aviso-mov", "Cadastre um item antes de registrar movimentações.", true);
    return;
  }

  const corpo = {
    item_id: itemId,
    tipo: $("m-tipo").value,
    qtd: parseInt($("m-qtd").value, 10),
    resp: $("m-resp").value,
  };

  try {
    const item = await requisitar("/movimentacoes", { method: "POST", body: JSON.stringify(corpo) });
    avisar("aviso-mov", "Movimentação registrada. Saldo de " + item.cod + ": " + item.qtd + ".");
    $("m-qtd").value = 1;
    await recarregar();
  } catch (erro) {
    avisar("aviso-mov", erro.message, true);
  }
});

$("busca").addEventListener("input", renderTabela);
$("so-criticos").addEventListener("change", renderTabela);
recarregar();