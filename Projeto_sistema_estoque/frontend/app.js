const CHAVE = "estoque-v1";
const $ = (id) => document.getElementById(id);
let estado = carregar();

function carregar() {
  try {
    const d = JSON.parse(localStorage.getItem(CHAVE));
    if (d && Array.isArray(d.itens) && Array.isArray(d.historico)) return d;
  } catch (e) {}
  return { itens: [], historico: [] };
}

function salvar() {
  try { localStorage.setItem(CHAVE, JSON.stringify(estado)); } catch (e) {}
}

function agora() {
  return new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
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
  sel.replaceChildren();
  if (!estado.itens.length) {
    const o = el("option", "Cadastre um item primeiro");
    o.value = "";
    sel.append(o);
    return;
  }
  estado.itens.forEach((i) => {
    const o = el("option", i.cod + " – " + i.nome);
    o.value = i.cod;
    sel.append(o);
  });
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
    const tr = el("tr");
    const td = el("td", estado.itens.length ? "Nenhum item encontrado com esse filtro." : "Nenhum item cadastrado. Use o formulário ao lado para cadastrar o primeiro.", "vazio");
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
    b.addEventListener("click", () => excluir(i.cod));
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
  estado.historico.slice(0, 10).forEach((h) => {
    const li = el("li");
    li.append(
      el("span", h.data, "data"),
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

function excluir(cod) {
  const item = estado.itens.find((i) => i.cod === cod);
  if (!item || !confirm("Excluir o item " + item.cod + " – " + item.nome + "?")) return;
  estado.itens = estado.itens.filter((i) => i.cod !== cod);
  salvar();
  renderTudo();
}

$("form-item").addEventListener("submit", (e) => {
  e.preventDefault();
  const cod = $("i-cod").value.trim().toUpperCase();
  if (estado.itens.some((i) => i.cod === cod)) {
    avisar("aviso-item", "Já existe um item com o código " + cod + ".", true);
    return;
  }
  estado.itens.push({
    cod,
    nome: $("i-nome").value.trim(),
    cat: $("i-cat").value.trim(),
    loc: $("i-loc").value.trim(),
    qtd: parseInt($("i-qtd").value, 10) || 0,
    min: parseInt($("i-min").value, 10) || 0,
  });
  salvar();
  e.target.reset();
  avisar("aviso-item", "Item " + cod + " cadastrado.");
  renderTudo();
});

$("form-mov").addEventListener("submit", (e) => {
  e.preventDefault();
  const item = estado.itens.find((i) => i.cod === $("m-item").value);
  const qtd = parseInt($("m-qtd").value, 10);
  const tipo = $("m-tipo").value;
  if (!item) {
    avisar("aviso-mov", "Cadastre um item antes de registrar movimentações.", true);
    return;
  }
  if (tipo === "saida" && qtd > item.qtd) {
    avisar("aviso-mov", "Saída maior que o saldo: o item " + item.cod + " tem " + item.qtd + " unidades.", true);
    return;
  }
  item.qtd += tipo === "entrada" ? qtd : -qtd;
  estado.historico.unshift({ data: agora(), cod: item.cod, nome: item.nome, tipo, qtd, resp: $("m-resp").value.trim() });
  estado.historico = estado.historico.slice(0, 200);
  salvar();
  avisar("aviso-mov", "Movimentação registrada. Saldo de " + item.cod + ": " + item.qtd + ".");
  $("m-qtd").value = 1;
  renderTudo();
});

$("busca").addEventListener("input", renderTabela);
$("so-criticos").addEventListener("change", renderTabela);
renderTudo();