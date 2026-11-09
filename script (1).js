'use strict';
/* BobinaTrack - HTML/CSS/JS puro. Dados no localStorage (não sincroniza entre dispositivos). */
const KEY = 'bobinatrack.v1';
const ST = ['Em estoque', 'Movimentada', 'Expedida', 'Bloqueada'];
const TIPOS = {'Entrada no estoque': 'Em estoque', 'Mudança de endereço': 'Movimentada', 'Transferência entre setores': 'Movimentada', 'Saída': 'Expedida', 'Expedição': 'Expedida', 'Retorno': 'Em estoque', 'Bloqueio': 'Bloqueada', 'Liberação': 'Em estoque'};
const PERM = {'Em estoque': ['Mudança de endereço', 'Transferência entre setores', 'Saída', 'Expedição', 'Bloqueio'], 'Expedida': ['Entrada no estoque', 'Retorno'], 'Bloqueada': ['Liberação']};
PERM['Movimentada'] = PERM['Em estoque'];
const OCT = ['Código divergente', 'Identificação incompleta', 'Possível duplicidade', 'Peso divergente', 'Avaria', 'Localização incorreta'];
const OCS = ['Aberta', 'Em análise', 'Resolvida'];
const ICONS = {dash: 'M3 3h8v8H3zM13 3h8v5h-8zM13 10h8v11h-8zM3 13h8v8H3z', cad: 'M12 5v14M5 12h14', pesq: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-5-5', todas: 'M4 6h16M4 12h16M4 18h16', mov: 'M7 7h13l-3-3M17 17H4l3 3', datas: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4', conf: 'M12 3l10 18H2zM12 10v5M12 18v.5', rel: 'M5 20V10M12 20V4M19 20v-7', io: 'M12 3v12M7 10l5 5 5-5M4 20h16', cfg: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 2v3M12 19v3M2 12h3M19 12h3'};

let db = {bobinas: [], ocorrencias: [], excluidas: [], cfg: {diasParado: 30}};
let cur = 'dash', rep = {name: 'relatorio', h: [], rows: []};

const $ = (s, e = document) => e.querySelector(s);
const $$ = (s, e = document) => [...e.querySelectorAll(s)];
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const up = s => String(s || '').trim().toUpperCase();
const nrm = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const gen = (i, n, e) => [i, n, e].map(up).join('|');
const pad = n => String(n).padStart(2, '0');
const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const nowISO = () => { const d = new Date(); return `${today()}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; };
const okDate = s => { if (!/^\d{4}-\d{2}-\d{2}$/.test(s || '')) return false; const d = new Date(s + 'T00:00:00'); return d.getFullYear() == s.slice(0, 4) && d.getMonth() + 1 == s.slice(5, 7) && d.getDate() == s.slice(8, 10); };
const fmtD = s => s ? s.slice(0, 10).split('-').reverse().join('/') : '—';
const fmtDT = s => s ? fmtD(s) + ' ' + s.slice(11, 16) : '—';
const kg = n => Number(n).toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2}) + ' kg';
const badge = s => `<span class="bd s${Math.max(0, ST.indexOf(s))}">${esc(s)}</span>`;
const fv = f => Object.fromEntries(new FormData(f));

/* ---------- armazenamento ---------- */
function validBob(b) {
  return b && ['id', 'ident', 'numero', 'endereco', 'codigo', 'status', 'cadastro', 'ultimaMov'].every(k => typeof b[k] === 'string' && b[k]) &&
    okDate(b.recebimento) && ST.includes(b.status) && Number.isFinite(+b.peso) && +b.peso > 0 && Array.isArray(b.historico) &&
    b.historico.every(h => h && typeof h.dt === 'string' && typeof h.tipo === 'string');
}
function validDB(d) {
  if (!d || typeof d !== 'object' || !Array.isArray(d.bobinas)) return false;
  if (d.ocorrencias && !Array.isArray(d.ocorrencias)) return false;
  if (!d.bobinas.every(validBob)) return false;
  d.ocorrencias = d.ocorrencias || []; d.excluidas = d.excluidas || [];
  d.cfg = {diasParado: Math.max(1, +(d.cfg && d.cfg.diasParado) || 30)};
  d.bobinas.forEach(b => { b.peso = +b.peso; b.material = String(b.material || ''); b.obs = String(b.obs || ''); });
  return true;
}
function load() {
  try { const r = localStorage.getItem(KEY); if (r) { const d = JSON.parse(r); if (validDB(d)) db = d; else toast('Dados salvos inválidos; mantendo cópia original no navegador', 'err'); } }
  catch (e) { toast('Não foi possível ler os dados salvos', 'err'); }
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(db)); }
  catch (e) { toast('Falha ao salvar (armazenamento cheio ou bloqueado). Faça um backup!', 'err'); }
}
function commit() { save(); R[cur] && R[cur](); alerts(); }

/* ---------- utilidades de interface ---------- */
let tt;
function toast(m, t) { const e = $('#toast'); e.textContent = m; e.className = 'show ' + (t || ''); clearTimeout(tt); tt = setTimeout(() => e.className = '', 3500); }
function tbl(h, rows) {
  if (!rows.length) return '<p class="empty">Nenhum registro encontrado.</p>';
  return `<div class="tw"><table><thead><tr>${h.map(x => `<th>${esc(x)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c && typeof c === 'object' ? c.h : esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function csv(h, rows) {
  return '\ufeff' + [h, ...rows].map(r => r.map(c => { let s = String(c == null ? '' : c); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; }).join(';')).join('\r\n');
}
function download(name, text, type) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], {type})); a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function dlg(t, h) { $('#dt').textContent = t; $('#db').innerHTML = h; const d = $('#dlg'); if (!d.open) d.showModal(); }
function fillSel(sel, opts, first) { sel.innerHTML = (first ? `<option value="">${first}</option>` : '') + opts.map(o => `<option>${esc(o)}</option>`).join(''); }

/* ---------- busca aproximada ---------- */
function lev(a, b) {
  const m = a.length, n = b.length; if (!m) return n; if (!n) return m;
  let p = Array.from({length: n + 1}, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const c = [i];
    for (let j = 1; j <= n; j++) c[j] = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    p = c;
  }
  return p[n];
}
const sim = (a, b) => { const l = Math.max(a.length, b.length); return l ? 1 - lev(a, b) / l : 0; };

/* ---------- consultas ---------- */
const findBob = t => { const q = nrm(t); if (!q) return null; return db.bobinas.find(b => nrm(b.codigo) === q) || db.bobinas.find(b => nrm(b.numero) === q) || null; };
const byId = id => db.bobinas.find(b => b.id === id);
const allMoves = () => db.bobinas.flatMap(b => b.historico.map(h => ({...h, b}))).sort((x, y) => y.dt.localeCompare(x.dt));
const moveRow = m => [fmtDT(m.dt), m.cod || m.b.codigo, m.tipo, m.endAnt || '—', m.endNovo || '—', m.stAnt || '—', m.stNovo || '—', m.obs || ''];
const MOVH = ['Data/hora', 'Código', 'Tipo', 'Endereço anterior', 'Novo endereço', 'Status anterior', 'Novo status', 'Observação'];
function openOc() { return db.ocorrencias.filter(o => o.situacao !== 'Resolvida'); }
function diasNoEndereco(b) {
  let ref = b.cadastro;
  for (let i = b.historico.length - 1; i >= 0; i--) { const h = b.historico[i]; if (h.endNovo && h.endNovo !== h.endAnt) { ref = h.dt; break; } }
  return Math.floor((Date.now() - new Date(ref).getTime()) / 864e5);
}
const acts = id => ['ver:Ver', 'edt:Editar', 'mov:Mover', 'his:Histórico', 'del:Excluir'].map(x => { const [a, l] = x.split(':'); return `<button class="btn sm ${a === 'del' ? 'danger' : 'ghost'}" data-a="${a}" data-id="${esc(id)}">${l}</button>`; }).join('');
function bobTable(list) {
  return tbl(['Código', 'Número', 'Endereço', 'Peso', 'Recebimento', 'Cadastro', 'Última movimentação', 'Status', 'Ações'],
    list.map(b => [b.codigo, b.numero, b.endereco, kg(b.peso), fmtD(b.recebimento), fmtDT(b.cadastro), fmtDT(b.ultimaMov), {h: badge(b.status)}, {h: acts(b.id)}]));
}
const inRange = (d, a, z) => (!a || d >= a) && (!z || d <= z);

/* ---------- renderização das seções ---------- */
const R = {
  dash() {
    const c = s => db.bobinas.filter(b => b.status === s).length;
    const diverg = new Set(openOc().map(o => o.bobId || o.codigo)).size;
    const cards = [['Total cadastradas', db.bobinas.length], ['Em estoque', c('Em estoque')], ['Movimentadas', c('Movimentada')], ['Expedidas', c('Expedida')], ['Bloqueadas', c('Bloqueada')], ['Com divergências', diverg, 1]];
    $('#cards').innerHTML = cards.map(x => `<div class="card ${x[2] && x[1] ? 'w' : ''}"><b>${x[1]}</b><span>${x[0]}</span></div>`).join('');
    $('#dashMov').innerHTML = tbl(MOVH, allMoves().slice(0, 8).map(moveRow));
    $('#dashRec').innerHTML = tbl(['Código', 'Endereço', 'Peso', 'Recebimento', 'Status'],
      [...db.bobinas].sort((a, b) => b.recebimento.localeCompare(a.recebimento) || b.cadastro.localeCompare(a.cadastro)).slice(0, 8).map(b => [b.codigo, b.endereco, kg(b.peso), fmtD(b.recebimento), {h: badge(b.status)}]));
  },
  cad() { $('#cDat').value = today(); $('#cRec').max = today(); updCod(); },
  pesq() {
    const q = $('#pq').value, nq = nrm(q), end = nrm($('#pe').value), st = $('#ps').value;
    const p1 = $('#pp1').value, p2 = $('#pp2').value, d = $('#pd').value, d1 = $('#pd1').value, d2 = $('#pd2').value;
    const base = db.bobinas.filter(b =>
      (!end || nrm(b.endereco).includes(end)) && (!st || b.status === st) &&
      (p1 === '' || b.peso >= +p1) && (p2 === '' || b.peso <= +p2) &&
      (!d || [b.recebimento, b.cadastro.slice(0, 10), b.ultimaMov.slice(0, 10), ...b.historico.map(h => h.dt.slice(0, 10))].includes(d)) &&
      inRange(b.recebimento, d1, d2));
    const hit = nq ? base.filter(b => [b.codigo, b.numero, b.endereco, b.ident].some(x => nrm(x).includes(nq))) : base;
    $('#pRes').innerHTML = bobTable(hit);
    const box = $('#pFuzzyBox');
    if (!nq) { box.hidden = true; return; }
    const ids = new Set(hit.map(b => b.id));
    const fz = base.filter(b => !ids.has(b.id)).map(b => {
      const s = Math.max(sim(nq, nrm(b.codigo)), sim(nq, nrm(b.numero)), sim(nq, nrm(b.ident + b.numero)));
      return {b, s};
    }).filter(x => x.s >= 0.7).sort((a, b) => b.s - a.s);
    box.hidden = !fz.length;
    $('#pFuzzy').innerHTML = tbl(['Código correto', 'Código pesquisado', 'Localização', 'Similaridade estimada', 'Ações'],
      fz.map(x => [x.b.codigo, q.trim(), x.b.endereco, Math.round(x.s * 100) + '%', {h: acts(x.b.id)}]));
  },
  todas() {
    const q = nrm($('#tQ').value), st = $('#tS').value, o = $('#tO').value, dir = +$('#tD').value;
    let l = db.bobinas.filter(b => (!st || b.status === st) && (!q || [b.codigo, b.numero, b.endereco, b.material].some(x => nrm(x).includes(q))));
    l.sort((a, b) => (typeof a[o] === 'number' ? a[o] - b[o] : String(a[o]).localeCompare(String(b[o]), 'pt-BR', {numeric: true})) * dir);
    $('#tCount').textContent = `${l.length} de ${db.bobinas.length} bobina(s)`;
    $('#tTab').innerHTML = bobTable(l);
  },
  mov() {
    $('#dlCod').innerHTML = db.bobinas.map(b => `<option value="${esc(b.codigo)}">`).join('');
    const q = nrm($('#mQ').value), t = $('#mT').value, d1 = $('#mD1').value, d2 = $('#mD2').value;
    $('#mTab').innerHTML = tbl(MOVH, allMoves().filter(m => (!t || m.tipo === t) && (!q || nrm(m.cod || m.b.codigo + m.endNovo + m.endAnt).includes(q)) && inRange(m.dt.slice(0, 10), d1, d2)).map(moveRow));
  },
  datas() {
    const m = $('#dM').value;
    $$('[data-m]', $('#s-datas')).forEach(l => l.hidden = !l.dataset.m.split(' ').includes(m));
    const d = $('#dD').value, d1 = $('#dD1').value, d2 = $('#dD2').value, mes = $('#dMes').value, dias = +$('#dDias').value || db.cfg.diasParado;
    let out = '', n = 0;
    if (m === 'mov') {
      const l = d ? allMoves().filter(x => x.dt.slice(0, 10) === d) : []; n = l.length; out = tbl(MOVH, l.map(moveRow));
    } else if (m === 'par') {
      const l = db.bobinas.filter(b => b.status !== 'Expedida').map(b => ({b, d: diasNoEndereco(b)})).filter(x => x.d >= dias).sort((a, b) => b.d - a.d);
      n = l.length; out = tbl(['Código', 'Endereço', 'Status', 'Dias no mesmo endereço', 'Recebimento'], l.map(x => [x.b.codigo, x.b.endereco, {h: badge(x.b.status)}, x.d, fmtD(x.b.recebimento)]));
    } else {
      const l = db.bobinas.filter(b => m === 'dia' ? d && b.recebimento === d : m === 'mes' ? mes && b.recebimento.slice(0, 7) === mes : m === 'int' ? (d1 || d2) && inRange(b.recebimento, d1, d2) : (d1 || d2) && inRange(b.cadastro.slice(0, 10), d1, d2));
      n = l.length; out = bobTable(l);
    }
    $('#dCount').textContent = `${n} resultado(s)`; $('#dTab').innerHTML = out;
  },
  conf() {
    $('#dlCod').innerHTML = db.bobinas.map(b => `<option value="${esc(b.codigo)}">`).join('');
    const l = [...db.ocorrencias].sort((a, b) => b.dt.localeCompare(a.dt));
    $('#ocTab').innerHTML = tbl(['Data', 'Tipo', 'Código', 'Localização', 'Observações', 'Situação'], l.map(o => {
      const b = o.bobId ? byId(o.bobId) : null;
      return [fmtDT(o.dt), o.tipo, o.codigo || '—', b ? b.endereco : '—', o.obs, {h: `<select data-oc="${esc(o.id)}">${OCS.map(s => `<option ${s === o.situacao ? 'selected' : ''}>${s}</option>`).join('')}</select>`}];
    }));
  },
  rel() {
    const t = $('#rT').value, d1 = $('#rD1').value, d2 = $('#rD2').value;
    const bs = db.bobinas.filter(b => inRange(b.recebimento, d1, d2));
    const grp = (list, f) => { const m = new Map(); list.forEach(b => { const k = f(b); const g = m.get(k) || {n: 0, p: 0}; g.n++; g.p += b.peso; m.set(k, g); }); return [...m].sort((a, b) => String(a[0]).localeCompare(String(b[0]))).map(([k, g]) => [k, g.n, kg(g.p)]); };
    const ocs = f => db.ocorrencias.filter(f).map(o => { const b = o.bobId ? byId(o.bobId) : null; return [fmtDT(o.dt), o.tipo, o.codigo || '—', b ? b.endereco : '—', o.obs, o.situacao]; });
    const OH = ['Data', 'Tipo', 'Código', 'Localização', 'Observações', 'Situação'];
    const M = {
      r1: ['bobinas-por-recebimento', ['Data de recebimento', 'Quantidade', 'Peso total'], grp(bs, b => fmtD(b.recebimento)).sort((a, b) => a[0].split('/').reverse().join().localeCompare(b[0].split('/').reverse().join()))],
      r2: ['bobinas-por-mes', ['Mês', 'Quantidade', 'Peso total'], grp(bs, b => b.recebimento.slice(0, 7))],
      r3: ['bobinas-por-localizacao', ['Endereço', 'Quantidade', 'Peso total'], grp(bs, b => b.endereco)],
      r4: ['bobinas-por-status', ['Status', 'Quantidade', 'Peso total'], grp(bs, b => b.status)],
      r5: ['movimentacoes-por-periodo', MOVH, allMoves().filter(m => inRange(m.dt.slice(0, 10), d1, d2)).map(moveRow)],
      r6: ['bobinas-com-avarias', OH, ocs(o => o.tipo === 'Avaria')],
      r7: ['bobinas-com-divergencias', OH, ocs(o => o.tipo !== 'Avaria')]
    }[t];
    rep = {name: M[0], h: M[1], rows: M[2]};
    $('#rTab').innerHTML = tbl(M[1], M[2]);
  },
  io() {},
  cfg() { $('#cfDias').value = db.cfg.diasParado; $('#cfInfo').textContent = `${db.bobinas.length} bobina(s), ${db.ocorrencias.length} ocorrência(s), ${db.excluidas.length} registro(s) excluído(s) preservado(s) no backup.`; }
};

function alerts() {
  const n = openOc().length, par = db.bobinas.filter(b => b.status !== 'Expedida' && diasNoEndereco(b) >= db.cfg.diasParado).length;
  const msg = [n ? `${n} ocorrência(s) de divergência/avaria em aberto` : '', par ? `${par} bobina(s) parada(s) há ${db.cfg.diasParado}+ dias no mesmo endereço` : ''].filter(Boolean).join(' • ');
  const e = $('#alertBar'); e.hidden = !msg; e.textContent = '⚠ ' + msg;
}
function go(s) {
  cur = s;
  $$('section').forEach(x => x.hidden = x.id !== 's-' + s);
  $$('#nav button').forEach(b => { b.classList.toggle('on', b.dataset.s === s); if (b.dataset.s === s) $('#title').textContent = b.dataset.t; });
  $('#sb').classList.remove('open'); window.scrollTo(0, 0); R[s]();
}

/* ---------- cadastro ---------- */
function updCod() { $('#cCod').value = $('#cIdent').value || $('#cNum').value || $('#cEnd').value ? gen($('#cIdent').value, $('#cNum').value, $('#cEnd').value) : ''; }
function checkBob(v, edit) {
  const f = edit ? ['ident', 'numero', 'material', 'recebimento'] : ['ident', 'numero', 'endereco', 'material', 'recebimento'];
  if (f.some(k => !String(v[k] || '').trim())) return 'Preencha todos os campos obrigatórios.';
  if (['ident', 'numero', 'endereco'].some(k => String(v[k] || '').includes('|'))) return 'Não use o caractere "|" nos campos de identificação, número e endereço.';
  if (!(+v.peso > 0)) return 'Informe um peso válido (maior que zero).';
  if (!okDate(v.recebimento)) return 'Data de recebimento inválida.';
  if (v.recebimento > today()) return 'A data de recebimento não pode ser futura.';
  return '';
}
const dupOf = (i, n, e, ignore) => { const c = gen(i, n, e); return db.bobinas.find(b => b.id !== ignore && (b.codigo === c || (b.ident === up(i) && b.numero === up(n)))); };

/* ---------- diálogos ---------- */
function showBob(id, hist) {
  const b = byId(id); if (!b) return;
  const h = tbl(MOVH, [...b.historico].reverse().map(x => moveRow({...x, b})));
  const dl = [['Código', b.codigo], ['Identificação', b.ident], ['Número', b.numero], ['Endereço', b.endereco], ['Peso', kg(b.peso)], ['Material', b.material], ['Recebimento', fmtD(b.recebimento)], ['Cadastro', fmtDT(b.cadastro)], ['Última movimentação', fmtDT(b.ultimaMov)], ['Status', b.status], ['Observações', b.obs || '—']];
  dlg((hist ? 'Histórico — ' : 'Bobina — ') + b.codigo, (hist ? '' : `<dl>${dl.map(x => `<dt>${x[0]}</dt><dd>${esc(x[1])}</dd>`).join('')}</dl><h3>Histórico</h3>`) + h);
}
function editBob(id) {
  const b = byId(id); if (!b) return;
  dlg('Editar — ' + b.codigo, `<form id="fE" class="grid" autocomplete="off"><input type="hidden" name="id" value="${esc(b.id)}">
  <label>Identificação *<input name="ident" value="${esc(b.ident)}" maxlength="40" required></label>
  <label>Número *<input name="numero" value="${esc(b.numero)}" maxlength="40" required></label>
  <label>Endereço (altere em "Mover")<input value="${esc(b.endereco)}" disabled></label>
  <label>Peso (kg) *<input name="peso" type="number" step="0.01" min="0.01" value="${b.peso}" required></label>
  <label>Material *<input name="material" value="${esc(b.material)}" maxlength="60" required></label>
  <label>Data de recebimento *<input name="recebimento" type="date" max="${today()}" value="${esc(b.recebimento)}" required></label>
  <label class="full">Observações<textarea name="obs" rows="3" maxlength="500">${esc(b.obs)}</textarea></label>
  <div class="full"><button class="btn">Salvar alterações</button></div></form>`);
}
function movBob(id) {
  const b = byId(id); if (!b) return;
  const ops = PERM[b.status];
  dlg('Movimentar — ' + b.codigo, `<p>Endereço atual: <b>${esc(b.endereco)}</b> • Status: ${badge(b.status)}</p><form id="fM" class="grid" autocomplete="off"><input type="hidden" name="id" value="${esc(b.id)}">
  <label>Tipo de movimentação *<select name="tipo">${ops.map(o => `<option>${o}</option>`).join('')}</select></label>
  <label>Novo endereço (obrigatório em mudança/transferência)<input name="endereco" maxlength="40"></label>
  <label class="full">Observação<textarea name="obs" rows="2" maxlength="500"></textarea></label>
  <div class="full"><button class="btn">Registrar movimentação</button></div></form>`);
}
function delBob(id) {
  const b = byId(id); if (!b) return;
  if (!confirm(`Excluir a bobina ${b.codigo}?\nO registro e o histórico serão preservados na área de excluídos do backup.`)) return;
  db.excluidas.push({...b, excluidaEm: nowISO()}); db.bobinas = db.bobinas.filter(x => x.id !== id);
  commit(); toast('Bobina excluída.', 'ok');
}

/* ---------- importação / exportação ---------- */
const backupText = () => JSON.stringify({app: 'BobinaTrack', versao: 1, exportadoEm: nowISO(), dados: db}, null, 2);
function exportJSON() { download(`bobinatrack-backup-${today()}.json`, backupText(), 'application/json'); }
function exportCSV() {
  download(`bobinas-${today()}.csv`, csv(['Código', 'Identificação', 'Número', 'Endereço', 'Peso (kg)', 'Material', 'Recebimento', 'Cadastro', 'Última movimentação', 'Status', 'Observações'],
    db.bobinas.map(b => [b.codigo, b.ident, b.numero, b.endereco, String(b.peso).replace('.', ','), b.material, fmtD(b.recebimento), fmtDT(b.cadastro), fmtDT(b.ultimaMov), b.status, b.obs])), 'text/csv;charset=utf-8');
}
function importFile(file, mode, msgEl) {
  if (!file) return;
  if (file.size > 8 * 1024 * 1024) return toast('Arquivo grande demais (máx. 8 MB).', 'err');
  const r = new FileReader();
  r.onerror = () => toast('Erro ao ler o arquivo.', 'err');
  r.onload = () => {
    let d; try { d = JSON.parse(r.result); d = d && d.dados ? d.dados : d; } catch (e) { return toast('Arquivo JSON inválido.', 'err'); }
    if (!validDB(d)) return toast('Backup inválido: estrutura ou datas incorretas. Nada foi alterado.', 'err');
    if (mode === 'replace') {
      if (!confirm(`Substituir todos os dados atuais por ${d.bobinas.length} bobina(s) do arquivo?\nUm backup dos dados atuais será baixado antes.`)) return;
      exportJSON(); db = d; msgEl && (msgEl.textContent = `Restaurado: ${d.bobinas.length} bobina(s).`);
    } else {
      let add = 0, dup = 0;
      d.bobinas.forEach(b => { if (dupOf(b.ident, b.numero, b.endereco) || byId(b.id)) dup++; else { db.bobinas.push(b); add++; } });
      d.ocorrencias.forEach(o => { if (!db.ocorrencias.some(x => x.id === o.id)) db.ocorrencias.push(o); });
      msgEl && (msgEl.textContent = `Importadas: ${add}. Ignoradas por duplicidade: ${dup}.`);
    }
    commit(); toast('Importação concluída.', 'ok');
  };
  r.readAsText(file);
}

/* ---------- eventos ---------- */
document.addEventListener('click', e => {
  const a = e.target.closest('[data-a]');
  if (a) { const id = a.dataset.id; ({ver: () => showBob(id), his: () => showBob(id, 1), edt: () => editBob(id), mov: () => movBob(id), del: () => delBob(id)})[a.dataset.a](); return; }
  const x = e.target.closest('[data-x]'); if (x) { x.dataset.x === 'json' ? exportJSON() : exportCSV(); return; }
  const n = e.target.closest('#nav button'); if (n) go(n.dataset.s);
});
document.addEventListener('input', e => { if (e.target.closest('.live')) R[cur](); });
document.addEventListener('change', e => {
  if (e.target.matches('.live')) R[cur]();
  if (e.target.dataset.oc) { const o = db.ocorrencias.find(x => x.id === e.target.dataset.oc); if (o) { o.situacao = e.target.value; o.atualizadoEm = nowISO(); commit(); } }
});
document.addEventListener('submit', e => {
  const f = e.target, id = f.id; if (id === 'fE' || id === 'fM' || id === 'fCad' || id === 'fOc' || id === 'fMovSel') e.preventDefault(); else return;
  const v = fv(f);
  if (id === 'fCad') {
    const err = checkBob(v); if (err) return toast(err, 'err');
    const d = dupOf(v.ident, v.numero, v.endereco); if (d) return toast('Bobina duplicada: já existe ' + d.codigo, 'err');
    if (!ST.includes(v.status)) return toast('Status inválido.', 'err');
    const dt = nowISO(), cod = gen(v.ident, v.numero, v.endereco);
    db.bobinas.push({id: uid(), ident: up(v.ident), numero: up(v.numero), endereco: up(v.endereco), codigo: cod, peso: +v.peso, material: v.material.trim(), recebimento: v.recebimento, cadastro: dt, ultimaMov: dt, status: v.status, obs: (v.obs || '').trim(),
      historico: [{dt, tipo: 'Entrada no estoque', cod, endAnt: '', endNovo: up(v.endereco), stAnt: '', stNovo: v.status, obs: 'Cadastro da bobina'}]});
    save(); f.reset(); R.cad(); alerts(); toast('Bobina cadastrada: ' + cod, 'ok');
  }
  if (id === 'fE') {
    const b = byId(v.id); if (!b) return;
    const err = checkBob(v, 1); if (err) return toast(err, 'err');
    const d = dupOf(v.ident, v.numero, b.endereco, b.id); if (d) return toast('Duplicidade com ' + d.codigo, 'err');
    const cod = gen(v.ident, v.numero, b.endereco), ch = [];
    if (cod !== b.codigo) ch.push(`Código: ${b.codigo} → ${cod}`);
    if (v.recebimento !== b.recebimento) ch.push(`Recebimento: ${fmtD(b.recebimento)} → ${fmtD(v.recebimento)}`);
    if (+v.peso !== b.peso) ch.push(`Peso: ${b.peso} → ${+v.peso}`);
    if (v.material.trim() !== b.material) ch.push('Material alterado');
    if ((v.obs || '').trim() !== b.obs) ch.push('Observações alteradas');
    Object.assign(b, {ident: up(v.ident), numero: up(v.numero), codigo: cod, peso: +v.peso, material: v.material.trim(), recebimento: v.recebimento, obs: (v.obs || '').trim()});
    if (ch.length) b.historico.push({dt: nowISO(), tipo: 'Edição de cadastro', cod, endAnt: b.endereco, endNovo: b.endereco, stAnt: b.status, stNovo: b.status, obs: ch.join('; ')});
    commit(); $('#dlg').close(); toast('Cadastro atualizado.', 'ok');
  }
  if (id === 'fM') {
    const b = byId(v.id); if (!b) return;
    if (!PERM[b.status].includes(v.tipo)) return toast(`Movimentação inválida para bobina com status "${b.status}".`, 'err');
    const novoEnd = up(v.endereco), troca = ['Mudança de endereço', 'Transferência entre setores'].includes(v.tipo);
    if (v.endereco.includes('|')) return toast('Não use "|" no endereço.', 'err');
    if (troca && !novoEnd) return toast('Informe o novo endereço.', 'err');
    if (novoEnd === b.endereco && troca) return toast('O novo endereço é igual ao atual.', 'err');
    const end = novoEnd || b.endereco, cod = gen(b.ident, b.numero, end);
    if (end !== b.endereco) { const d = dupOf(b.ident, b.numero, end, b.id); if (d) return toast('Duplicidade com ' + d.codigo, 'err'); }
    const dt = nowISO(), st = TIPOS[v.tipo], ob = [(v.obs || '').trim(), cod !== b.codigo ? `Código: ${b.codigo} → ${cod}` : ''].filter(Boolean).join(' | ');
    b.historico.push({dt, tipo: v.tipo, cod, endAnt: b.endereco, endNovo: end, stAnt: b.status, stNovo: st, obs: ob});
    Object.assign(b, {endereco: end, codigo: cod, status: st, ultimaMov: dt});
    commit(); $('#dlg').close(); toast('Movimentação registrada.', 'ok');
  }
  if (id === 'fOc') {
    if (!OCT.includes(v.tipo) || !(v.obs || '').trim()) return toast('Preencha tipo e observações.', 'err');
    const b = findBob(v.codigo);
    db.ocorrencias.push({id: uid(), dt: nowISO(), tipo: v.tipo, codigo: (v.codigo || '').trim(), bobId: b ? b.id : null, obs: v.obs.trim(), situacao: 'Aberta'});
    f.reset(); commit(); toast(b ? 'Ocorrência registrada.' : 'Ocorrência registrada (código não encontrado no cadastro).', 'ok');
  }
  if (id === 'fMovSel') {
    const b = findBob(v.mvCod || $('#mvCod').value); if (!b) return toast('Bobina não encontrada. Use a pesquisa para localizar o código.', 'err');
    movBob(b.id);
  }
});
['#cIdent', '#cNum', '#cEnd'].forEach(s => $(s).addEventListener('input', updCod));
$('#cReset').addEventListener('click', () => setTimeout(() => { $('#cCod').value = ''; }, 0));
$('#menuBtn').addEventListener('click', () => $('#sb').classList.toggle('open'));
$('#quick').addEventListener('keydown', e => { if (e.key === 'Enter') { const v = e.target.value; go('pesq'); $('#pq').value = v; R.pesq(); e.target.value = ''; } });
$('#rCsv').addEventListener('click', () => download(`${rep.name}-${today()}.csv`, csv(rep.h, rep.rows), 'text/csv;charset=utf-8'));
$('#ioFile').addEventListener('change', e => { importFile(e.target.files[0], $('#ioMode').value, $('#ioMsg')); e.target.value = ''; });
$('#cfFile').addEventListener('change', e => { importFile(e.target.files[0], 'replace', $('#cfInfo')); e.target.value = ''; });
$('#cfDias').addEventListener('change', e => { const n = Math.round(+e.target.value); if (n >= 1 && n <= 3650) { db.cfg.diasParado = n; commit(); toast('Configuração salva.', 'ok'); } else toast('Valor inválido.', 'err'); });
$('#cfReset').addEventListener('click', () => {
  if (!confirm('Apagar TODOS os dados deste navegador? Um backup será baixado antes.')) return;
  if (prompt('Digite APAGAR para confirmar:') !== 'APAGAR') return toast('Operação cancelada.');
  exportJSON(); db = {bobinas: [], ocorrencias: [], excluidas: [], cfg: {diasParado: 30}}; commit(); toast('Dados apagados.', 'ok');
});

/* ---------- início ---------- */
$$('#nav button').forEach(b => b.insertAdjacentHTML('afterbegin', `<svg class="ic" viewBox="0 0 24 24"><path d="${ICONS[b.dataset.s]}"/></svg>`));
fillSel($('#ps'), ST, 'Todos'); fillSel($('#tS'), ST, 'Todos'); fillSel($('#mT'), Object.keys(TIPOS).concat('Edição de cadastro'), 'Todos'); fillSel($('#ocT'), OCT);
load(); alerts(); go('dash');

/* ---------- relatório em PDF (impressão do navegador -> "Salvar como PDF") ---------- */
$('#rPdf').addEventListener('click', () => {
  R.rel();
  if (!rep.rows.length) return toast('O relatório está vazio; nada para exportar.', 'err');
  const sel = $('#rT'), d1 = $('#rD1').value, d2 = $('#rD2').value, old = document.title;
  $('#printArea').innerHTML = `<h1>BobinaTrack — ${esc(sel.options[sel.selectedIndex].text)}</h1><p>Gerado em ${fmtDT(nowISO())}${d1 || d2 ? ' • Período: ' + fmtD(d1) + ' a ' + fmtD(d2) : ''} • ${rep.rows.length} registro(s)</p>` + tbl(rep.h, rep.rows);
  document.title = `${rep.name}-${today()}`;
  document.body.classList.add('printing');
  const done = () => { document.body.classList.remove('printing'); $('#printArea').innerHTML = ''; document.title = old; window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  window.print();
});
