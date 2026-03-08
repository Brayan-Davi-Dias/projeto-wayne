// =============================================================================
// USUARIOS.JS — Gerenciamento de usuários (somente admin)
// =============================================================================

let _usuarios      = [];
let _usuarioEditando = null;

// ── API ───────────────────────────────────────────────────────────────────────

async function apiFetch(url, opts = {}) {
  const res = await fetch(url, opts);
  if (res.status === 401) { window.location.href = '/'; return null; }
  if (res.status === 403) { mostrarToast('error', 'Acesso negado — somente administradores.'); return null; }
  return res.json();
}

async function carregarUsuarios() {
  const data = await apiFetch('/api/usuarios');
  if (!data) return;
  _usuarios = data;
  renderTabela();
  renderContadores();
}

// ── Renderizar tabela ─────────────────────────────────────────────────────────

function renderTabela() {
  const el = document.getElementById('usuarios-tabela');
  if (!el) return;

  const filtroNivel = document.getElementById('filtro-nivel-usuario')?.value || '';
  const filtroDept  = document.getElementById('filtro-dept')?.value           || '';
  const busca       = document.getElementById('busca-usuario')?.value.toLowerCase() || '';

  const lista = _usuarios.filter(u => {
    if (filtroNivel && u.nivel        !== filtroNivel) return false;
    if (filtroDept  && u.departamento !== filtroDept)  return false;
    if (busca && !u.nome.toLowerCase().includes(busca) &&
                 !u.usuario_id.toLowerCase().includes(busca)) return false;
    return true;
  });

  const nivelCfg = {
    admin:       { cor: '#ff2233', lbl: 'ADMIN',       icone: '★' },
    gerente:     { cor: '#f0c020', lbl: 'GERENTE',     icone: '◆' },
    funcionario: { cor: '#00ff88', lbl: 'FUNCIONÁRIO', icone: '●' },
    operador:    { cor: '#0af',    lbl: 'OPERADOR',    icone: '○' },
  };

  el.innerHTML = lista.map(u => {
    const n = nivelCfg[u.nivel] || { cor: '#888', lbl: u.nivel, icone: '·' };
    return `
      <tr class="${!u.ativo ? 'usuario-inativo' : ''}">
        <td><span class="u-id">${u.usuario_id}</span></td>
        <td>${u.nome}</td>
        <td>
          <span class="u-nivel" style="color:${n.cor};border-color:${n.cor}44">
            ${n.icone} ${n.lbl}
          </span>
        </td>
        <td>${u.departamento}</td>
        <td>
          <span class="u-ativo ${u.ativo ? 'sim' : 'nao'}">
            ${u.ativo ? '● ATIVO' : '○ INATIVO'}
          </span>
        </td>
        <td>${fmtDate(u.criado_em)}</td>
        <td class="u-acoes">
          <button class="btn-acao editar"  onclick="abrirEdicao('${u.usuario_id}')">✎ EDITAR</button>
          ${u.ativo
            ? `<button class="btn-acao deletar" onclick="confirmarDesativar('${u.usuario_id}','${u.nome}')">✕ DESATIVAR</button>`
            : `<button class="btn-acao reativar" onclick="reativarUsuario('${u.usuario_id}')">✓ REATIVAR</button>`
          }
        </td>
      </tr>`;
  }).join('') || '<tr><td colspan="7" class="sem-resultados">Nenhum usuário encontrado</td></tr>';

  // Preencher filtro de departamentos dinamicamente
  const depts = [...new Set(_usuarios.map(u => u.departamento))].sort();
  const deptEl = document.getElementById('filtro-dept');
  if (deptEl && deptEl.options.length <= 1) {
    depts.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d; opt.textContent = d;
      deptEl.appendChild(opt);
    });
  }
}

// ── Contadores ────────────────────────────────────────────────────────────────

function renderContadores() {
  const ativos = _usuarios.filter(u => u.ativo);
  const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };

  set('cnt-total-usuarios', _usuarios.length);
  set('cnt-ativos',  ativos.length);
  set('cnt-admin',   ativos.filter(u => u.nivel === 'admin').length);
  set('cnt-gerente', ativos.filter(u => u.nivel === 'gerente').length);
  set('cnt-func',    ativos.filter(u => u.nivel === 'funcionario').length);
  set('cnt-op',      ativos.filter(u => u.nivel === 'operador').length);
}

// ── Modal: Criar usuário ──────────────────────────────────────────────────────

function abrirCriar() {
  _usuarioEditando = null;
  document.getElementById('modal-titulo-usuario').textContent = 'NOVO USUÁRIO';
  document.getElementById('form-usuario').reset();
  document.getElementById('u-campo-id').disabled    = false;
  document.getElementById('u-campo-senha').required = true;
  document.getElementById('label-senha').textContent = 'SENHA';
  document.getElementById('modal-usuario').classList.add('show');
}

function abrirEdicao(usuario_id) {
  const u = _usuarios.find(x => x.usuario_id === usuario_id);
  if (!u) return;

  _usuarioEditando = usuario_id;
  document.getElementById('modal-titulo-usuario').textContent = `EDITAR — ${usuario_id}`;

  document.getElementById('u-campo-id').value           = u.usuario_id;
  document.getElementById('u-campo-id').disabled        = true;
  document.getElementById('u-campo-nome').value         = u.nome;
  document.getElementById('u-campo-nivel').value        = u.nivel;
  document.getElementById('u-campo-dept').value         = u.departamento;
  document.getElementById('u-campo-senha').value        = '';
  document.getElementById('u-campo-senha').required     = false;
  document.getElementById('label-senha').textContent    = 'NOVA SENHA (deixe vazio para manter)';

  document.getElementById('modal-usuario').classList.add('show');
}

function fecharModal() {
  document.getElementById('modal-usuario').classList.remove('show');
  _usuarioEditando = null;
}

async function salvarUsuario() {
  const payload = {
    usuario_id:   document.getElementById('u-campo-id').value.trim(),
    nome:         document.getElementById('u-campo-nome').value.trim(),
    nivel:        document.getElementById('u-campo-nivel').value,
    departamento: document.getElementById('u-campo-dept').value.trim(),
    senha:        document.getElementById('u-campo-senha').value,
  };

  if (!payload.nome || !payload.nivel || !payload.departamento) {
    mostrarToast('error', 'Preencha todos os campos obrigatórios.');
    return;
  }
  if (!_usuarioEditando && !payload.senha) {
    mostrarToast('error', 'Senha obrigatória para novo usuário.');
    return;
  }

  const url    = _usuarioEditando ? `/api/usuarios/${_usuarioEditando}` : '/api/usuarios';
  const method = _usuarioEditando ? 'PUT' : 'POST';

  const res = await apiFetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  });

  if (res?.sucesso || res?.mensagem?.includes('criado')) {
    mostrarToast('success', _usuarioEditando ? 'Usuário atualizado.' : 'Usuário criado.');
    fecharModal();
    carregarUsuarios();
  } else {
    mostrarToast('error', res?.erro || 'Erro ao salvar usuário.');
  }
}

// ── Desativar / Reativar ──────────────────────────────────────────────────────

function confirmarDesativar(usuario_id, nome) {
  if (!confirm(`Desativar o usuário "${nome}" (${usuario_id})?\n\nO usuário perderá acesso ao sistema.`)) return;
  desativarUsuario(usuario_id);
}

async function desativarUsuario(usuario_id) {
  const res = await apiFetch(`/api/usuarios/${usuario_id}`, { method: 'DELETE' });
  if (res?.sucesso) {
    mostrarToast('success', `Usuário ${usuario_id} desativado.`);
    carregarUsuarios();
  } else {
    mostrarToast('error', res?.erro || 'Erro ao desativar.');
  }
}

async function reativarUsuario(usuario_id) {
  const res = await apiFetch(`/api/usuarios/${usuario_id}`, {
    method:  'PUT',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ ativo: 1 }),
  });
  if (res?.sucesso) {
    mostrarToast('success', `Usuário ${usuario_id} reativado.`);
    carregarUsuarios();
  } else {
    mostrarToast('error', res?.erro || 'Erro ao reativar.');
  }
}

// ── Filtros e busca ───────────────────────────────────────────────────────────

function filtrar() { renderTabela(); }
function buscar()  { renderTabela(); }

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(ts) {
  if (!ts) return '—';
  try {
    const d = new Date(ts);
    const p = n => String(n).padStart(2, '0');
    return `${p(d.getDate())}/${p(d.getMonth()+1)}/${d.getFullYear()}`;
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
    setTimeout(()=>t.remove(),300);
  }, 3500);
}

async function fazerLogout() {
  await fetch('/api/logout', { method: 'POST' });
  window.location.href = '/';
}

// ── Init ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  carregarUsuarios();

  document.getElementById('modal-usuario')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) fecharModal();
  });
});