// =============================================================================
// AREAS.JS — Controle de acesso a áreas restritas
// =============================================================================

let _areas       = [];
let _logs        = [];
let _areaEditando = null;

// ── API ───────────────────────────────────────────────────────────────────────

async function apiFetch(url, opts = {}) {
  const res = await fetch(url, opts);
  if (res.status === 401) { window.location.href = '/'; return null; }
  return res.json();
}

async function carregarAreas() {
  const [areas, logs] = await Promise.all([
    apiFetch('/api/areas'),
    apiFetch('/api/logs/areas?limit=50'),
  ]);
  if (areas) { _areas = areas; renderAreas(); renderMapa(); }
  if (logs)  { _logs  = logs;  renderLogs();  }
  atualizarContadores();
}

// ── Renderizar cards de áreas ─────────────────────────────────────────────────

function renderAreas() {
  const el = document.getElementById('areas-grid');
  if (!el) return;

  const filtroNivel = document.getElementById('filtro-nivel')?.value || '';
  const filtroStatus = document.getElementById('filtro-status-area')?.value || '';

  const lista = _areas.filter(a => {
    if (filtroNivel  && a.nivel_acesso !== filtroNivel)  return false;
    if (filtroStatus && a.status       !== filtroStatus) return false;
    return true;
  });

  const nivelCor = {
    operador:    '#0af',
    funcionario: '#00ff88',
    gerente:     '#f0c020',
    admin:       '#ff2233',
  };
  const statusCfg = {
    normal:  { cor: '#00ff88', lbl: 'NORMAL' },
    alerta:  { cor: '#f0c020', lbl: 'ALERTA' },
    critico: { cor: '#ff2233', lbl: 'CRÍTICO' },
    bloqueado: { cor: '#ff2233', lbl: 'BLOQUEADO' },
  };

  el.innerHTML = lista.map(a => {
    const nc = nivelCor[a.nivel_acesso]  || '#888';
    const sc = statusCfg[a.status]       || statusCfg.normal;
    const icone = a.tem_acesso ? '🔓' : '🔒';

    return `
      <div class="area-card status-${a.status}${!a.tem_acesso ? ' sem-acesso' : ''}">
        <div class="ac-header">
          <span class="ac-codigo">${a.codigo}</span>
          <span class="ac-status" style="color:${sc.cor};border-color:${sc.cor}44">${sc.lbl}</span>
        </div>
        <div class="ac-nome">${icone} ${a.nome}</div>
        <div class="ac-andar">${a.andar}</div>
        <div class="ac-desc">${a.descricao || ''}</div>
        <div class="ac-footer">
          <span class="ac-nivel" style="color:${nc};border-color:${nc}44">
            NÍVEL: ${a.nivel_acesso.toUpperCase()}
          </span>
          <div class="ac-btns">
            ${a.tem_acesso
              ? `<button class="btn-acessar" onclick="tentarAcesso('${a.codigo}')">▶ ACESSAR</button>`
              : `<button class="btn-acessar negado" disabled>✕ BLOQUEADO</button>`
            }
            <button class="btn-editar-area" onclick="abrirEdicaoArea('${a.codigo}')">✎</button>
          </div>
        </div>
      </div>`;
  }).join('') || '<div class="sem-resultados">Nenhuma área encontrada</div>';
}

// ── Mapa de andares ───────────────────────────────────────────────────────────

function renderMapa() {
  const el = document.getElementById('mapa-andares');
  if (!el) return;

  const andares = {};
  _areas.forEach(a => {
    if (!andares[a.andar]) andares[a.andar] = [];
    andares[a.andar].push(a);
  });

  const ordem = ['Subsolo B2', 'Subsolo', 'Térreo', '1º Andar', '2º Andar', '3º Andar', 'Cobertura'];

  el.innerHTML = ordem
    .filter(a => andares[a])
    .map(andar => {
      const areas = andares[andar];
      return `
        <div class="mapa-andar">
          <div class="ma-label">${andar}</div>
          <div class="ma-areas">
            ${areas.map(a => {
              const cor = { normal: '#00ff88', alerta: '#f0c020', critico: '#ff2233', bloqueado: '#ff2233' }[a.status] || '#444';
              return `
                <div class="ma-area" style="border-color:${cor}44;background:${cor}11"
                     onclick="tentarAcesso('${a.codigo}')" title="${a.nome}">
                  <div class="ma-dot" style="background:${cor};box-shadow:0 0 4px ${cor}"></div>
                  <span>${a.nome}</span>
                </div>`;
            }).join('')}
          </div>
        </div>`;
    }).join('');
}

// ── Logs de acesso ────────────────────────────────────────────────────────────

function renderLogs() {
  const el = document.getElementById('logs-lista');
  if (!el) return;

  const tipoCfg = {
    entrada: { cor: '#00ff88', icone: '▶' },
    saida:   { cor: '#0af',    icone: '◀' },
    negado:  { cor: '#ff2233', icone: '✕' },
  };

  el.innerHTML = _logs.map(l => {
    const t = tipoCfg[l.tipo] || { cor: '#888', icone: '·' };
    const hora = fmtDateTime(l.criado_em);
    return `
      <div class="log-item tipo-${l.tipo}">
        <span class="li-icone" style="color:${t.cor}">${t.icone}</span>
        <div class="li-info">
          <span class="li-usuario">${l.usuario_id}</span>
          <span class="li-area">${l.area_codigo}</span>
        </div>
        <span class="li-motivo">${l.motivo || ''}</span>
        <span class="li-hora">${hora}</span>
      </div>`;
  }).join('') || '<div class="sem-resultados">Sem registros</div>';
}

// ── Tentar acesso a área ──────────────────────────────────────────────────────

async function tentarAcesso(codigo) {
  const area = _areas.find(a => a.codigo === codigo);
  if (!area) return;

  const res = await apiFetch(`/api/areas/${codigo}/acessar`, { method: 'POST' });
  if (!res) return;

  if (res.sucesso) {
    mostrarToast('success', res.mensagem);
    mostrarPainelAcesso(area, true);
  } else {
    mostrarToast('error', res.mensagem);
    mostrarPainelAcesso(area, false);
  }

  // Recarrega logs
  const logs = await apiFetch('/api/logs/areas?limit=50');
  if (logs) { _logs = logs; renderLogs(); }
  atualizarContadores();
}

// ── Painel de resultado de acesso ─────────────────────────────────────────────

function mostrarPainelAcesso(area, autorizado) {
  const modal = document.getElementById('modal-acesso');
  if (!modal) return;

  document.getElementById('ma-titulo').textContent  = autorizado ? '✓ ACESSO AUTORIZADO' : '✕ ACESSO NEGADO';
  document.getElementById('ma-titulo').style.color  = autorizado ? '#00ff88' : '#ff2233';
  document.getElementById('ma-area-nome').textContent = area.nome;
  document.getElementById('ma-area-cod').textContent  = area.codigo;
  document.getElementById('ma-area-andar').textContent = area.andar;
  document.getElementById('ma-msg').textContent = autorizado
    ? 'Acesso físico registrado. Bem-vindo.'
    : `Nível "${area.nivel_acesso}" exigido. Acesso negado e registrado.`;

  modal.classList.add('show');
  setTimeout(() => modal.classList.remove('show'), 3000);
}

// ── Modal edição de área ──────────────────────────────────────────────────────

function abrirEdicaoArea(codigo) {
  const a = _areas.find(x => x.codigo === codigo);
  if (!a) return;
  _areaEditando = codigo;

  document.getElementById('ae-codigo').textContent        = a.codigo;
  document.getElementById('ae-nome').value                = a.nome;
  document.getElementById('ae-nivel-acesso').value        = a.nivel_acesso;
  document.getElementById('ae-status').value              = a.status;
  document.getElementById('ae-andar').value               = a.andar;
  document.getElementById('ae-descricao').value           = a.descricao || '';

  document.getElementById('modal-edicao-area').classList.add('show');
}

function fecharEdicaoArea() {
  document.getElementById('modal-edicao-area').classList.remove('show');
  _areaEditando = null;
}

async function salvarArea() {
  if (!_areaEditando) return;

  const payload = {
    nome:         document.getElementById('ae-nome').value.trim(),
    nivel_acesso: document.getElementById('ae-nivel-acesso').value,
    status:       document.getElementById('ae-status').value,
    andar:        document.getElementById('ae-andar').value.trim(),
    descricao:    document.getElementById('ae-descricao').value.trim(),
  };

  const res = await apiFetch(`/api/areas/${_areaEditando}`, {
    method:  'PUT',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  });

  if (res?.sucesso) {
    mostrarToast('success', 'Área atualizada com sucesso.');
    fecharEdicaoArea();
    carregarAreas();
  } else {
    mostrarToast('error', res?.erro || 'Erro ao salvar.');
  }
}

// ── Contadores ────────────────────────────────────────────────────────────────

function atualizarContadores() {
  const total    = _areas.length;
  const alertas  = _areas.filter(a => a.status === 'alerta').length;
  const criticos = _areas.filter(a => a.status === 'critico').length;
  const negados  = _logs.filter(l => l.tipo === 'negado').length;

  const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
  set('cnt-total-areas',   total);
  set('cnt-alerta-areas',  alertas);
  set('cnt-critico-areas', criticos);
  set('cnt-negados',       negados);
}

// ── Filtros ───────────────────────────────────────────────────────────────────

function filtrarAreas() { renderAreas(); }

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDateTime(ts) {
  if (!ts) return '—';
  try {
    const d = new Date(ts);
    const p = n => String(n).padStart(2,'0');
    return `${p(d.getDate())}/${p(d.getMonth()+1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
  } catch { return '—'; }
}

function mostrarToast(type, msg) {
  const ct = document.getElementById('toast-container');
  if (!ct) return;
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  const icons = { success:'✓', warning:'⚠', error:'✕', info:'ℹ' };
  t.innerHTML = `<span>${icons[type]||'·'}</span><span>${msg}</span>`;
  ct.appendChild(t);
  setTimeout(() => {
    t.style.opacity='0'; t.style.transform='translateX(20px)'; t.style.transition='all 0.3s';
    setTimeout(()=>t.remove(), 300);
  }, 3500);
}

async function fazerLogout() {
  await fetch('/api/logout', { method: 'POST' });
  window.location.href = '/';
}

// ── Init ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  carregarAreas();

  document.getElementById('modal-edicao-area')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) fecharEdicaoArea();
  });
});