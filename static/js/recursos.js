// =============================================================================
// RECURSOS.JS — Gestão de equipamentos, veículos e dispositivos
// =============================================================================

let _recursos       = [];
let _recursoEditando = null;

// ── API ───────────────────────────────────────────────────────────────────────

async function apiFetch(url, opts = {}) {
  const res = await fetch(url, opts);
  if (res.status === 401) { window.location.href = '/'; return null; }
  return res.json();
}

async function carregarRecursos(tipo = '') {
  const url  = tipo ? `/api/recursos?tipo=${tipo}` : '/api/recursos';
  const data = await apiFetch(url);
  if (!data) return;
  _recursos = data;
  renderTabela();
  renderContadores();
}

// ── Renderizar tabela ─────────────────────────────────────────────────────────

function renderTabela() {
  const el = document.getElementById('recursos-tabela');
  if (!el) return;

  const filtroTipo   = document.getElementById('filtro-tipo')?.value   || '';
  const filtroStatus = document.getElementById('filtro-status')?.value || '';
  const busca        = document.getElementById('busca-recurso')?.value.toLowerCase() || '';

  const lista = _recursos.filter(r => {
    if (filtroTipo   && r.tipo   !== filtroTipo)   return false;
    if (filtroStatus && r.status !== filtroStatus)  return false;
    if (busca && !r.nome.toLowerCase().includes(busca) &&
                 !r.codigo.toLowerCase().includes(busca)) return false;
    return true;
  });

  el.innerHTML = lista.map(r => {
    const statusCfg = {
      disponivel:  { cor: '#00ff88', lbl: 'DISPONÍVEL' },
      operacional: { cor: '#00ff88', lbl: 'OPERACIONAL' },
      manutencao:  { cor: '#f0c020', lbl: 'MANUTENÇÃO' },
      standby:     { cor: '#0af',    lbl: 'STANDBY' },
      critico:     { cor: '#ff2233', lbl: 'CRÍTICO' },
    };
    const s    = statusCfg[r.status] || { cor: '#888', lbl: r.status };
    const tipo = { veiculo: '🚗', equipamento: '⚙', dispositivo: '📡' }[r.tipo] || '▪';

    return `
      <tr>
        <td><span class="rec-codigo">${r.codigo}</span></td>
        <td>${tipo} ${r.nome}</td>
        <td><span class="rec-tipo">${r.tipo}</span></td>
        <td>${r.subtipo || '—'}</td>
        <td><span class="rec-status" style="color:${s.cor};border-color:${s.cor}44">${s.lbl}</span></td>
        <td>${r.localizacao || '—'}</td>
        <td>${r.responsavel || '—'}</td>
        <td class="rec-acoes">
          <button class="btn-acao editar"  onclick="abrirEdicao('${r.codigo}')">✎ EDITAR</button>
          <button class="btn-acao deletar" onclick="confirmarDelete('${r.codigo}','${r.nome}')">✕</button>
        </td>
      </tr>`;
  }).join('') || `<tr><td colspan="8" class="sem-resultados">Nenhum recurso encontrado</td></tr>`;
}

// ── Contadores por tipo ───────────────────────────────────────────────────────

function renderContadores() {
  const tipos = ['veiculo', 'equipamento', 'dispositivo'];
  tipos.forEach(t => {
    const total  = _recursos.filter(r => r.tipo === t).length;
    const critico = _recursos.filter(r => r.tipo === t && ['critico','manutencao'].includes(r.status)).length;
    const elT = document.getElementById(`cnt-${t}`);
    const elC = document.getElementById(`cnt-${t}-critico`);
    if (elT) elT.textContent = total;
    if (elC) elC.textContent = critico;
  });
}

// ── Modal: Criar/Editar ───────────────────────────────────────────────────────

function abrirCriar() {
  _recursoEditando = null;
  document.getElementById('modal-titulo').textContent = 'NOVO RECURSO';
  document.getElementById('form-recurso').reset();
  document.getElementById('campo-codigo').disabled = false;
  document.getElementById('modal-recurso').classList.add('show');
}

function abrirEdicao(codigo) {
  const r = _recursos.find(x => x.codigo === codigo);
  if (!r) return;

  _recursoEditando = codigo;
  document.getElementById('modal-titulo').textContent = `EDITAR — ${codigo}`;

  document.getElementById('campo-codigo').value       = r.codigo;
  document.getElementById('campo-codigo').disabled    = true;
  document.getElementById('campo-nome').value         = r.nome;
  document.getElementById('campo-tipo').value         = r.tipo;
  document.getElementById('campo-subtipo').value      = r.subtipo || '';
  document.getElementById('campo-status').value       = r.status;
  document.getElementById('campo-localizacao').value  = r.localizacao || '';
  document.getElementById('campo-responsavel').value  = r.responsavel || '';
  document.getElementById('campo-descricao').value    = r.descricao || '';

  document.getElementById('modal-recurso').classList.add('show');
}

function fecharModal() {
  document.getElementById('modal-recurso').classList.remove('show');
  _recursoEditando = null;
}

async function salvarRecurso() {
  const payload = {
    codigo:      document.getElementById('campo-codigo').value.trim(),
    nome:        document.getElementById('campo-nome').value.trim(),
    tipo:        document.getElementById('campo-tipo').value,
    subtipo:     document.getElementById('campo-subtipo').value.trim(),
    status:      document.getElementById('campo-status').value,
    localizacao: document.getElementById('campo-localizacao').value.trim(),
    responsavel: document.getElementById('campo-responsavel').value.trim(),
    descricao:   document.getElementById('campo-descricao').value.trim(),
  };

  if (!payload.codigo || !payload.nome || !payload.tipo) {
    mostrarToast('error', 'Preencha código, nome e tipo.');
    return;
  }

  const url    = _recursoEditando ? `/api/recursos/${_recursoEditando}` : '/api/recursos';
  const method = _recursoEditando ? 'PUT' : 'POST';

  const res = await apiFetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  });

  if (res?.sucesso) {
    mostrarToast('success', _recursoEditando ? 'Recurso atualizado.' : 'Recurso criado.');
    fecharModal();
    carregarRecursos();
  } else {
    mostrarToast('error', res?.erro || 'Erro ao salvar recurso.');
  }
}

// ── Deletar ───────────────────────────────────────────────────────────────────

function confirmarDelete(codigo, nome) {
  if (!confirm(`Remover recurso "${nome}" (${codigo})?\n\nEsta ação não pode ser desfeita.`)) return;
  deletarRecurso(codigo);
}

async function deletarRecurso(codigo) {
  const res = await apiFetch(`/api/recursos/${codigo}`, { method: 'DELETE' });
  if (res?.sucesso) {
    mostrarToast('success', `Recurso ${codigo} removido.`);
    carregarRecursos();
  } else {
    mostrarToast('error', res?.erro || 'Erro ao remover recurso.');
  }
}

// ── Filtros ───────────────────────────────────────────────────────────────────

function filtrar() { renderTabela(); }
function buscar()  { renderTabela(); }

// ── Toast ─────────────────────────────────────────────────────────────────────

function mostrarToast(type, msg) {
  const ct = document.getElementById('toast-container');
  if (!ct) return;
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  const icons = { success: '✓', warning: '⚠', error: '✕', info: 'ℹ' };
  t.innerHTML = `<span>${icons[type] || '·'}</span><span>${msg}</span>`;
  ct.appendChild(t);
  setTimeout(() => {
    t.style.opacity = '0'; t.style.transform = 'translateX(20px)'; t.style.transition = 'all 0.3s';
    setTimeout(() => t.remove(), 300);
  }, 3500);
}

// ── Logout ────────────────────────────────────────────────────────────────────

async function fazerLogout() {
  await fetch('/api/logout', { method: 'POST' });
  window.location.href = '/';
}

// ── Init ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  carregarRecursos();

  // Fechar modal clicando fora
  document.getElementById('modal-recurso')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) fecharModal();
  });
});