// =============================================================================
// CAMERAS.JS — Monitoramento de câmeras
// =============================================================================

let _cameras     = [];
let _cameraAtiva = null;

// ── API ───────────────────────────────────────────────────────────────────────

async function apiFetch(url, opts = {}) {
  const res = await fetch(url, opts);
  if (res.status === 401) { window.location.href = '/'; return null; }
  return res.json();
}

async function carregarCameras() {
  const data = await apiFetch('/api/cameras');
  if (!data) return;
  _cameras = data;
  renderGrid();
  renderLista();
  atualizarContadores();
}

// ── Renderizar grid de câmeras ────────────────────────────────────────────────

function renderGrid() {
  const el = document.getElementById('cameras-grid');
  if (!el) return;

  const filtro = document.getElementById('filtro-status')?.value || 'todos';

  const lista = _cameras.filter(c => {
    if (filtro === 'todos') return true;
    return c.status === filtro;
  });

  el.innerHTML = lista.map(c => {
    const statusCfg = {
      online:     { cor: '#00ff88', lbl: 'ONLINE' },
      offline:    { cor: '#ff2233', lbl: 'OFFLINE' },
      manutencao: { cor: '#f0c020', lbl: 'MANUTENÇÃO' },
    };
    const s = statusCfg[c.status] || statusCfg.offline;
    const bloqueada = !c.tem_acesso;

    return `
      <div class="camera-card${bloqueada ? ' bloqueada' : ''}" onclick="${bloqueada ? "mostrarAcessoNegado()" : `abrirCamera('${c.codigo}')`}">
        <div class="cc-feed">
          ${bloqueada
            ? `<div class="cc-bloqueado">🔒 ACESSO RESTRITO</div>`
            : c.status === 'online'
              ? `<img src="${c.feed_url}" alt="${c.nome}" loading="lazy" onerror="this.src=''" />`
              : `<div class="cc-offline">⊗ ${s.lbl}</div>`
          }
          <div class="cc-overlay">
            <span class="cc-codigo">${c.codigo}</span>
            <span class="cc-status-dot" style="background:${s.cor};box-shadow:0 0 6px ${s.cor}"></span>
          </div>
        </div>
        <div class="cc-info">
          <span class="cc-nome">${c.nome}</span>
          <span class="cc-loc">${c.localizacao}</span>
          <span class="cc-status-lbl" style="color:${s.cor}">${s.lbl}</span>
        </div>
      </div>`;
  }).join('') || '<div class="sem-resultados">Nenhuma câmera encontrada</div>';
}

// ── Lista lateral ─────────────────────────────────────────────────────────────

function renderLista() {
  const el = document.getElementById('cameras-lista');
  if (!el) return;

  el.innerHTML = _cameras.map(c => {
    const cor = c.status === 'online' ? '#00ff88' : c.status === 'offline' ? '#ff2233' : '#f0c020';
    return `
      <div class="cl-item${_cameraAtiva === c.codigo ? ' ativa' : ''}" onclick="abrirCamera('${c.codigo}')">
        <div class="cl-dot" style="background:${cor};box-shadow:0 0 4px ${cor}"></div>
        <div class="cl-info">
          <span class="cl-nome">${c.nome}</span>
          <span class="cl-area">${c.area_codigo}</span>
        </div>
        <span class="cl-badge" style="color:${cor}">${c.status.toUpperCase()}</span>
      </div>`;
  }).join('');
}

// ── Abrir câmera em destaque ──────────────────────────────────────────────────

async function abrirCamera(codigo) {
  const data = await apiFetch(`/api/cameras/${codigo}`);
  if (!data || data.erro) {
    mostrarToast('error', data?.erro || 'Erro ao acessar câmera');
    return;
  }

  _cameraAtiva = codigo;
  renderLista();

  const modal = document.getElementById('modal-camera');
  if (!modal) return;

  document.getElementById('mc-titulo').textContent    = data.nome;
  document.getElementById('mc-codigo').textContent    = data.codigo;
  document.getElementById('mc-area').textContent      = data.area_codigo;
  document.getElementById('mc-localizacao').textContent = data.localizacao;
  document.getElementById('mc-nivel').textContent     = data.nivel_acesso.toUpperCase();

  const statusEl = document.getElementById('mc-status');
  statusEl.textContent = data.status.toUpperCase();
  statusEl.className   = `mc-status-val ${data.status}`;

  const feedEl = document.getElementById('mc-feed');
  if (data.status === 'online') {
    feedEl.innerHTML = `<img src="${data.feed_url}?t=${Date.now()}" alt="${data.nome}" style="width:100%;height:100%;object-fit:cover" />`;
  } else {
    feedEl.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#ff2233;font-size:14px">⊗ CÂMERA ${data.status.toUpperCase()}</div>`;
  }

  modal.classList.add('show');
}

function fecharModal() {
  const modal = document.getElementById('modal-camera');
  if (modal) modal.classList.remove('show');
  _cameraAtiva = null;
  renderLista();
}

// ── Alterar status da câmera ──────────────────────────────────────────────────

async function alterarStatusCamera(codigo, status) {
  const res = await apiFetch(`/api/cameras/${codigo}/status`, {
    method:  'PUT',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ status }),
  });

  if (res?.sucesso) {
    mostrarToast('success', `Câmera ${codigo} → ${status.toUpperCase()}`);
    fecharModal();
    carregarCameras();
  } else {
    mostrarToast('error', res?.erro || 'Erro ao alterar status');
  }
}

// ── Contadores HUD ────────────────────────────────────────────────────────────

function atualizarContadores() {
  const total   = _cameras.length;
  const online  = _cameras.filter(c => c.status === 'online').length;
  const offline = _cameras.filter(c => c.status === 'offline').length;
  const manut   = _cameras.filter(c => c.status === 'manutencao').length;

  setText('cnt-total',   total);
  setText('cnt-online',  online);
  setText('cnt-offline', offline);
  setText('cnt-manut',   manut);
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// ── Acesso negado ─────────────────────────────────────────────────────────────

function mostrarAcessoNegado() {
  mostrarToast('error', 'Acesso negado — nível insuficiente para esta câmera');
}

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
    t.style.opacity   = '0';
    t.style.transform = 'translateX(20px)';
    t.style.transition = 'all 0.3s';
    setTimeout(() => t.remove(), 300);
  }, 3500);
}

// ── Filtros e busca ───────────────────────────────────────────────────────────

function filtrarStatus() {
  renderGrid();
}

function buscarCamera(q) {
  const els = document.querySelectorAll('.camera-card');
  // Re-render com filtro de texto
  const el     = document.getElementById('cameras-grid');
  const filtro = q.toLowerCase();
  if (!el) return;
  const lista = _cameras.filter(c =>
    c.nome.toLowerCase().includes(filtro) ||
    c.codigo.toLowerCase().includes(filtro) ||
    c.localizacao.toLowerCase().includes(filtro)
  );
  renderGridFiltrado(lista);
}

function renderGridFiltrado(lista) {
  const el = document.getElementById('cameras-grid');
  if (!el) return;
  const statusCfg = {
    online:     { cor: '#00ff88', lbl: 'ONLINE' },
    offline:    { cor: '#ff2233', lbl: 'OFFLINE' },
    manutencao: { cor: '#f0c020', lbl: 'MANUTENÇÃO' },
  };
  el.innerHTML = lista.map(c => {
    const s = statusCfg[c.status] || statusCfg.offline;
    const bloqueada = !c.tem_acesso;
    return `
      <div class="camera-card${bloqueada ? ' bloqueada' : ''}" onclick="${bloqueada ? "mostrarAcessoNegado()" : `abrirCamera('${c.codigo}')`}">
        <div class="cc-feed">
          ${bloqueada
            ? `<div class="cc-bloqueado">🔒 ACESSO RESTRITO</div>`
            : c.status === 'online'
              ? `<img src="${c.feed_url}" alt="${c.nome}" loading="lazy" />`
              : `<div class="cc-offline">⊗ ${s.lbl}</div>`
          }
          <div class="cc-overlay">
            <span class="cc-codigo">${c.codigo}</span>
            <span class="cc-status-dot" style="background:${s.cor};box-shadow:0 0 6px ${s.cor}"></span>
          </div>
        </div>
        <div class="cc-info">
          <span class="cc-nome">${c.nome}</span>
          <span class="cc-loc">${c.localizacao}</span>
          <span class="cc-status-lbl" style="color:${s.cor}">${s.lbl}</span>
        </div>
      </div>`;
  }).join('') || '<div class="sem-resultados">Nenhuma câmera encontrada</div>';
}

// ── Logout ────────────────────────────────────────────────────────────────────

async function fazerLogout() {
  await fetch('/api/logout', { method: 'POST' });
  window.location.href = '/';
}

// ── Init ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  carregarCameras();
  // Recarrega a cada 15s para simular feed ao vivo
  setInterval(carregarCameras, 15000);
});