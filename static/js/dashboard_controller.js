/* =============================================================================
   DASHBOARD CONTROLLER — dashboard_controller.js
   Coordena todas as abas. Cada aba é inicializada por lazy-load na 1ª visita.
   Reaproveita: dashboard.js (overview), recursos.js, usuarios.js
   ============================================================================= */

const _tabsCarregadas = {};

// ── Navegação entre abas ──────────────────────────────────────────────────────

function switchTab(id, btn) {
  document.querySelectorAll('.dash-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('.dash-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('panel-' + id).classList.add('active');

  if (!_tabsCarregadas[id]) {
    _tabsCarregadas[id] = true;
    ({
      cameras:  initCameras,
      areas:    initAreas,
      recursos: initRecursos,
      alertas:  initAlertas,
      usuarios: initUsuarios,
      logs:     initLogs,
    })[id]?.();
  }
}

function switchTabByName(id) {
  const btn = [...document.querySelectorAll('.dash-tab')]
    .find(b => b.getAttribute('onclick')?.includes(`'${id}'`));
  if (btn) switchTab(id, btn);
}

// ═════════════════════════════════════════════════════════════════════════════
// ABA OVERVIEW — adapta dashboard.js
// Sobrescreve renderMetricas para atualizar os cards da aba overview E os badges
// ═════════════════════════════════════════════════════════════════════════════

window.renderMetricas = function(m) {
  const s = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
  s('ov-cam-online',    m.cameras_online);
  s('ov-cam-total',     m.total_cameras);
  s('ov-alertas',       m.alertas_ativos);
  s('ov-negados',       m.acessos_negados);
  s('ov-rec-criticos',  m.recursos_criticos);
  s('badge-alertas',    m.alertas_ativos);
  const bc = document.getElementById('badge-cameras');
  if (bc) bc.textContent = `${m.cameras_online}/${m.total_cameras}`;
};

// Sobrescreve renderLog para também popular acessos recentes do overview
window.renderLog = function(acessos, alertas) {
  // Log principal (log-body)
  const el = document.getElementById('log-body');
  if (el) {
    const entries = [];
    (alertas||[]).slice(0,5).forEach(a => {
      const t = a.nivel==='critico'?'critical':a.nivel==='alto'?'warning':'info';
      entries.push({ tipo:t, tag:'ALERTA', msg:a.titulo, time:fmtTimeOV(a.criado_em) });
    });
    (acessos||[]).slice(0,8).forEach(a => {
      const t = a.tipo==='negado'?'critical':a.tipo==='entrada'?'success':'info';
      const g = a.tipo==='negado'?'NEGADO':a.tipo==='entrada'?'ENTRADA':'SAÍDA';
      entries.push({ tipo:t, tag:g, msg:`${a.usuario_id} — ${a.area_codigo||''} ${a.motivo||''}`, time:fmtTimeOV(a.criado_em) });
    });
    el.innerHTML = entries.map(e => `
      <div class="log-entry ${e.tipo}">
        <span class="log-time">${e.time}</span>
        <span class="log-tag ${e.tipo}">${e.tag}</span>
        <span class="log-msg">${e.msg}</span>
      </div>`).join('');
  }
  // Acessos recentes (missions-body)
  renderAcessosOV(acessos);
};

function renderAcessosOV(acessos) {
  const el = document.getElementById('missions-body');
  if (!el) return;
  const pri = { negado:'high', entrada:'low', saida:'done' };
  const lbl = { negado:'NEGADO', entrada:'ENTRADA', saida:'SAÍDA' };
  el.innerHTML = (acessos||[]).slice(0,8).map(a => `
    <div class="mission-item">
      <div class="m-priority ${pri[a.tipo]||'low'}"></div>
      <span class="m-code">${a.area_codigo||'—'}</span>
      <span class="m-name">${a.usuario_id}</span>
      <span class="m-agent">${lbl[a.tipo]||a.tipo}</span>
    </div>`).join('') || '<div class="sem-resultados">Sem registros</div>';
}

function fmtTimeOV(ts) {
  if (!ts) return '--:--';
  try { const d=new Date(ts); return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; }
  catch { return '--:--'; }
}

// ═════════════════════════════════════════════════════════════════════════════
// ABA CÂMERAS
// ═════════════════════════════════════════════════════════════════════════════

let _cameras = [];

function initCameras() { carregarCamerasTab(); }

async function carregarCamerasTab() {
  try {
    _cameras = await api('/api/cameras');
    renderCameras(_cameras);
    atualizarCardsCam(_cameras);
  } catch(e) { toast('error', 'Erro ao carregar câmeras: ' + e.message); }
}

function atualizarCardsCam(list) {
  const s = (id,v) => { const e=document.getElementById(id); if(e) e.textContent=v; };
  s('c-online',  list.filter(c=>c.status==='online').length);
  s('c-offline', list.filter(c=>c.status==='offline').length);
  s('c-manut',   list.filter(c=>c.status==='manutencao').length);
  s('c-total',   list.length);
  s('cam-count', list.length);
}

function renderCameras(list) {
  const grid = document.getElementById('cameras-grid');
  if (!grid) return;
  document.getElementById('cam-count').textContent = list.length;
  if (!list.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
      <div class="empty-state-icon">◉</div><span>Nenhuma câmera encontrada</span></div>`; return;
  }
  const statusBadge = {
    online:     '<span class="badge badge-green">Online</span>',
    offline:    '<span class="badge badge-red">Offline</span>',
    manutencao: '<span class="badge badge-gold">Manutenção</span>',
  };
  const nivelCor = { operador:'badge-muted', funcionario:'badge-green', gerente:'badge-blue', admin:'badge-purple' };
  grid.innerHTML = list.map(c => {
    if (!c.tem_acesso) return `
      <div class="cam-card offline">
        <div class="cam-thumb-wrap">
          <div class="locked-overlay"><div class="locked-icon">🔒</div><span>Acesso Restrito</span>
            <span class="badge ${nivelCor[c.nivel_acesso]||'badge-muted'}" style="margin-top:4px">${c.nivel_acesso}</span>
          </div>
        </div>
        <div class="cam-info"><div class="cam-name">${c.nome}</div><div class="cam-loc">${c.localizacao}</div></div>
        <div class="cam-footer"><span class="cam-code">${c.codigo}</span><span class="cam-locked">🔒 Sem acesso</span></div>
      </div>`;
    return `
      <div class="cam-card ${c.status==='offline'?'offline':''}" onclick="abrirCameraTab('${c.codigo}')">
        <div class="cam-thumb-wrap">
          <img class="cam-thumb" src="${c.feed_url}" alt="${c.nome}" onerror="this.src='';this.style.background='var(--bg3)'">
          <div class="cam-overlay"></div>
          <div class="cam-status-dot ${c.status}"></div>
          ${c.status==='online'?'<div class="cam-rec">● REC</div>':''}
        </div>
        <div class="cam-info"><div class="cam-name">${c.nome}</div><div class="cam-loc">${c.localizacao}</div></div>
        <div class="cam-footer"><span class="cam-code">${c.codigo}</span>${statusBadge[c.status]||''}</div>
      </div>`;
  }).join('');
}

function filtrarCameras() {
  const q = document.getElementById('cam-search')?.value.toLowerCase()||'';
  const s = document.getElementById('cam-filter-status')?.value||'';
  const a = document.getElementById('cam-filter-acesso')?.value||'';
  renderCameras(_cameras.filter(c =>
    (!q || c.nome.toLowerCase().includes(q) || c.codigo.toLowerCase().includes(q) || c.localizacao.toLowerCase().includes(q)) &&
    (!s || c.status===s) && (!a || c.nivel_acesso===a)
  ));
}

async function abrirCameraTab(codigo) {
  try {
    const c = await api(`/api/cameras/${codigo}`);
    const sLabel = {online:'Online',offline:'Offline',manutencao:'Manutenção'}[c.status]||c.status;
    const sBadge = {online:'badge-green',offline:'badge-red',manutencao:'badge-gold'}[c.status];
    const podeAlt = ['gerente','admin'].includes(window._sessao?.nivel);
    document.getElementById('modal-cam-content').innerHTML = `
      <div style="margin-bottom:12px">
        <img class="cam-modal-img" src="${c.feed_url}" alt="${c.nome}" onerror="this.style.display='none'">
      </div>
      <div style="margin-bottom:14px">
        <div style="font-size:15px;font-weight:800;margin-bottom:4px">${c.nome}</div>
        <div style="font-size:11px;color:var(--muted);font-family:var(--font-mono)">${c.codigo} · ${c.localizacao}</div>
      </div>
      <div class="cam-modal-meta">
        <div class="cmm-item"><span class="cmm-label">Status</span><span><span class="badge ${sBadge}">${sLabel}</span></span></div>
        <div class="cmm-item"><span class="cmm-label">Área</span><span class="cmm-value">${c.area_codigo||'—'}</span></div>
        <div class="cmm-item"><span class="cmm-label">Nível de acesso</span><span class="cmm-value">${c.nivel_acesso}</span></div>
        <div class="cmm-item"><span class="cmm-label">Cadastrada em</span><span class="cmm-value">${c.criado_em?.slice(0,10)||'—'}</span></div>
      </div>
      ${podeAlt?`
      <div style="margin-top:16px;padding-top:14px;border-top:1px solid var(--border)">
        <div class="section-title">Alterar Status</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-sm btn-ghost" onclick="alterarStatusCamTab('${c.codigo}','online')">● Online</button>
          <button class="btn btn-sm btn-ghost" onclick="alterarStatusCamTab('${c.codigo}','offline')">● Offline</button>
          <button class="btn btn-sm btn-ghost" onclick="alterarStatusCamTab('${c.codigo}','manutencao')">● Manutenção</button>
        </div>
      </div>`:''}`;
    abrirModal('modal-camera');
  } catch(e) { toast('error', e.message); }
}

async function alterarStatusCamTab(codigo, status) {
  try {
    await api(`/api/cameras/${codigo}/status`,{method:'PUT',body:JSON.stringify({status})});
    toast('success',`Câmera ${codigo} → ${status}`);
    fecharModal('modal-camera');
    carregarCamerasTab();
  } catch(e) { toast('error',e.message); }
}

// ═════════════════════════════════════════════════════════════════════════════
// ABA ÁREAS
// ═════════════════════════════════════════════════════════════════════════════

let _areas = [];
let _editandoArea = null;

function initAreas() { carregarAreasTab(); carregarLogAreas(); }

async function carregarAreasTab() {
  try {
    _areas = await api('/api/areas');
    renderAreasCards(_areas);
    atualizarCardsArea(_areas);
    popularFiltroLog(_areas);
    if (window._sessao?.nivel==='admin') {
      const btn=document.getElementById('btn-nova-area');
      if(btn) btn.style.display='inline-flex';
    }
  } catch(e) { toast('error','Erro ao carregar áreas: '+e.message); }
}

function atualizarCardsArea(list) {
  const s=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};
  s('a-total',   list.length);
  s('a-acesso',  list.filter(a=>a.tem_acesso).length);
  s('a-restrict',list.filter(a=>!a.tem_acesso).length);
  s('a-alert',   list.filter(a=>a.status!=='normal').length);
  s('area-count',list.length);
}

function popularFiltroLog(areas) {
  ['log-filter-area','log-filter-area-aba'].forEach(id=>{
    const sel=document.getElementById(id);
    if(!sel) return;
    sel.innerHTML='<option value="">Todas as áreas</option>'+
      areas.map(a=>`<option value="${a.codigo}">${a.codigo} — ${a.nome}</option>`).join('');
  });
}

function renderAreasCards(list) {
  const grid = document.getElementById('areas-grid');
  if (!grid) return;
  document.getElementById('area-count').textContent = list.length;

  const ncor = { operador:'#00c8d4', funcionario:'#22c97a', gerente:'#f0c020', admin:'#f04040' };
  const scfg = {
    normal:   {cor:'#22c97a',lbl:'NORMAL'},
    alerta:   {cor:'#f0c020',lbl:'ALERTA'},
    critico:  {cor:'#f04040',lbl:'CRÍTICO'},
    bloqueado:{cor:'#f04040',lbl:'BLOQUEADO'},
  };
  const podeEditar = ['gerente','admin'].includes(window._sessao?.nivel);

  const q  = document.getElementById('area-search')?.value.toLowerCase()||'';
  const fn = document.getElementById('area-filter-nivel')?.value||'';
  const fs = document.getElementById('area-filter-status')?.value||'';

  const filtered = list.filter(a=>
    (!q || a.nome.toLowerCase().includes(q) || a.codigo.toLowerCase().includes(q)) &&
    (!fn || a.nivel_acesso===fn) && (!fs || a.status===fs)
  );

  grid.innerHTML = filtered.map(a=>{
    const nc = ncor[a.nivel_acesso]||'#888';
    const sc = scfg[a.status]||scfg.normal;
    const icone = a.tem_acesso?'🔓':'🔒';
    return `
      <div class="area-card status-${a.status}${!a.tem_acesso?' sem-acesso':''}">
        <div class="ac-header">
          <span class="ac-codigo">${a.codigo}</span>
          <span class="ac-status" style="color:${sc.cor};border-color:${sc.cor}44">${sc.lbl}</span>
        </div>
        <div class="ac-nome">${icone} ${a.nome}</div>
        <div class="ac-andar">${a.andar}</div>
        <div class="ac-desc">${a.descricao||''}</div>
        <div class="ac-footer">
          <span class="ac-nivel" style="color:${nc};border-color:${nc}44">NÍVEL: ${a.nivel_acesso.toUpperCase()}</span>
          <div class="ac-btns">
            ${a.tem_acesso
              ?`<button class="btn-acessar" onclick="solicitarAcessoArea('${a.codigo}','${a.nome.replace(/'/g,"\\'")}')">▶ ACESSAR</button>`
              :`<button class="btn-acessar negado" disabled>✕ BLOQUEADO</button>`}
            ${podeEditar?`<button class="btn-editar-area" onclick="editarAreaModal('${a.codigo}')">✎</button>`:''}
          </div>
        </div>
      </div>`;
  }).join('') || `<div class="sem-resultados" style="grid-column:1/-1">Nenhuma área encontrada</div>`;
}

function filtrarAreasTab() { renderAreasCards(_areas); }

function solicitarAcessoArea(codigo, nome) {
  document.getElementById('acesso-titulo').textContent = `Entrar em: ${nome}`;
  document.getElementById('acesso-corpo').textContent  = `Confirmar acesso físico à área ${codigo}? O evento será registrado.`;
  document.getElementById('acesso-btn-confirmar').onclick = async () => {
    try {
      const res = await api(`/api/areas/${codigo}/acessar`,{method:'POST'});
      fecharModal('modal-acesso');
      toast('success', res.mensagem||'Acesso registrado.');
      carregarLogAreas();
    } catch(e) { fecharModal('modal-acesso'); toast('error',e.message); }
  };
  abrirModal('modal-acesso');
}

function editarAreaModal(codigo) {
  const a = _areas.find(x=>x.codigo===codigo);
  if (a) abrirFormArea(a);
}

function abrirFormArea(area=null) {
  _editandoArea = area?.codigo||null;
  document.getElementById('modal-area-title').textContent = area?'Editar Área':'Nova Área';
  document.getElementById('area-f-codigo').value  = area?.codigo||'';
  document.getElementById('area-f-nome').value    = area?.nome||'';
  document.getElementById('area-f-andar').value   = area?.andar||'';
  document.getElementById('area-f-nivel').value   = area?.nivel_acesso||'funcionario';
  document.getElementById('area-f-status').value  = area?.status||'normal';
  document.getElementById('area-f-desc').value    = area?.descricao||'';
  document.getElementById('area-f-codigo').disabled = !!area;
  abrirModal('modal-area');
}

async function salvarArea() {
  const payload = {
    codigo:       document.getElementById('area-f-codigo').value.trim(),
    nome:         document.getElementById('area-f-nome').value.trim(),
    andar:        document.getElementById('area-f-andar').value.trim(),
    nivel_acesso: document.getElementById('area-f-nivel').value,
    status:       document.getElementById('area-f-status').value,
    descricao:    document.getElementById('area-f-desc').value.trim(),
  };
  if (!payload.codigo||!payload.nome||!payload.andar) {
    toast('warning','Código, nome e andar são obrigatórios.'); return;
  }
  try {
    if (_editandoArea)
      await api(`/api/areas/${_editandoArea}`,{method:'PUT',body:JSON.stringify(payload)});
    else
      await api('/api/areas',{method:'POST',body:JSON.stringify(payload)});
    toast('success', _editandoArea?'Área atualizada.':'Área criada.');
    fecharModal('modal-area');
    carregarAreasTab();
  } catch(e) { toast('error',e.message); }
}

async function carregarLogAreas() {
  const area = document.getElementById('log-filter-area')?.value||'';
  try {
    const url = area?`/api/logs/areas?area=${area}&limit=30`:'/api/logs/areas?limit=30';
    const rows = await api(url);
    const tbody = document.getElementById('log-tbody');
    if (!tbody) return;
    const tb = {entrada:'badge-green',saida:'badge-blue',negado:'badge-red'};
    tbody.innerHTML = rows.map(r=>`
      <tr>
        <td class="mono">${r.usuario_id||'—'}</td>
        <td class="mono">${r.area_codigo||'—'}</td>
        <td><span class="badge ${tb[r.tipo]||'badge-muted'}">${r.tipo}</span></td>
        <td class="text-muted">${r.motivo||'—'}</td>
        <td class="mono text-muted">${r.criado_em?.slice(0,16).replace('T',' ')||'—'}</td>
      </tr>`).join('') || '<tr><td colspan="5"><div class="sem-resultados">Sem registros</div></td></tr>';
  } catch(e) {
    const p=document.getElementById('panel-log-areas');
    if(p) p.style.display='none';
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// ABA RECURSOS — usa recursos.js diretamente
// ═════════════════════════════════════════════════════════════════════════════

function initRecursos() {
  if (typeof carregarRecursos === 'function') carregarRecursos();
}

// Patch renderContadores para também atualizar os s-cards
const _origRenderContadores = window.renderContadores;
window.renderContadores = function() {
  if (typeof _recursos !== 'undefined') {
    ['veiculo','equipamento','dispositivo'].forEach(t=>{
      const n = _recursos.filter(r=>r.tipo===t).length;
      const c = _recursos.filter(r=>r.tipo===t&&['critico','manutencao'].includes(r.status)).length;
      const eN=document.getElementById(`cnt-${t}`);
      const eC=document.getElementById(`cnt-${t}-critico`);
      if(eN) eN.textContent=n;
      if(eC) eC.textContent=c;
    });
    const tot=document.getElementById('cnt-recursos-total');
    if(tot) tot.textContent=_recursos.length;
  }
  if (_origRenderContadores) _origRenderContadores();
};

// ═════════════════════════════════════════════════════════════════════════════
// ABA ALERTAS
// ═════════════════════════════════════════════════════════════════════════════

let _alertas = [];

function initAlertas() { carregarAlertas(); }

async function carregarAlertas() {
  try {
    _alertas = await api('/api/alertas');
    renderizarAlertas();
  } catch(e) { toast('error','Erro ao carregar alertas.'); }
}

function renderizarAlertas() {
  const tbody = document.getElementById('alertas-tbody');
  if (!tbody) return;
  const fn = document.getElementById('filtro-nivel-alerta')?.value||'';
  const fr = document.getElementById('filtro-resolvido-alerta')?.value||'';
  const list = _alertas.filter(a=>
    (!fn||a.nivel===fn) && (fr===''||String(a.resolvido)===fr)
  );
  document.getElementById('alerta-count').textContent = list.length;

  const nb = {baixo:'badge-green',medio:'badge-gold',alto:'badge-red',critico:'badge-red'};
  const podeResolver = ['gerente','admin'].includes(window._sessao?.nivel);

  tbody.innerHTML = list.map(a=>`
    <tr>
      <td><span class="badge ${nb[a.nivel]||'badge-muted'}">${a.nivel}</span></td>
      <td class="mono text-muted">${a.tipo}</td>
      <td class="bold">${a.titulo}</td>
      <td class="mono text-muted">${a.area_codigo||'—'}</td>
      <td class="mono text-muted">${a.criado_por||'—'}</td>
      <td class="mono text-muted">${a.criado_em?.slice(0,16).replace('T',' ')||'—'}</td>
      <td>${a.resolvido?'<span class="badge badge-muted">Resolvido</span>':'<span class="badge badge-gold">Ativo</span>'}</td>
      <td>
        ${!a.resolvido&&podeResolver
          ?`<button class="btn-acao editar" onclick="resolverAlerta(${a.id})">✓ Resolver</button>`:''}
      </td>
    </tr>`).join('')||'<tr><td colspan="8"><div class="sem-resultados">Nenhum alerta encontrado</div></td></tr>';
}

async function resolverAlerta(id) {
  try {
    await api(`/api/alertas/${id}/resolver`,{method:'PUT'});
    toast('success','Alerta resolvido.');
    carregarAlertas();
  } catch(e) { toast('error',e.message); }
}

async function criarAlerta() {
  const payload = {
    tipo:        document.getElementById('alerta-f-tipo').value.trim(),
    titulo:      document.getElementById('alerta-f-titulo').value.trim(),
    nivel:       document.getElementById('alerta-f-nivel').value,
    area_codigo: document.getElementById('alerta-f-area').value.trim()||null,
    descricao:   document.getElementById('alerta-f-desc').value.trim(),
  };
  if (!payload.tipo||!payload.titulo) { toast('warning','Tipo e título são obrigatórios.'); return; }
  try {
    await api('/api/alertas',{method:'POST',body:JSON.stringify(payload)});
    toast('success','Alerta registrado.');
    fecharModal('modal-alerta');
    carregarAlertas();
  } catch(e) { toast('error',e.message); }
}

// ═════════════════════════════════════════════════════════════════════════════
// ABA USUÁRIOS — usa usuarios.js diretamente
// ═════════════════════════════════════════════════════════════════════════════

function initUsuarios() {
  if (typeof carregarUsuarios === 'function') carregarUsuarios();
}

// ═════════════════════════════════════════════════════════════════════════════
// ABA LOGS
// ═════════════════════════════════════════════════════════════════════════════

async function initLogs() {
  if (_areas.length) popularFiltroLog(_areas);
  try {
    const [sistema, areas] = await Promise.all([
      api('/api/logs/acesso?limit=50'),
      api('/api/logs/areas?limit=50'),
    ]);
    renderLogSistema(sistema);
    renderLogAreas(areas);
  } catch(e) { toast('error','Sem acesso aos logs.'); }
}

function renderLogSistema(rows) {
  const tbody=document.getElementById('logs-sistema-tbody');
  if(!tbody) return;
  tbody.innerHTML = rows.map(r=>`
    <tr>
      <td class="mono">${r.usuario_id||'—'}</td>
      <td class="mono text-muted">${r.ip||'—'}</td>
      <td><span class="badge ${r.sucesso?'badge-green':'badge-red'}">${r.sucesso?'Sucesso':'Falha'}</span></td>
      <td class="text-muted">${r.mensagem||'—'}</td>
      <td class="mono text-muted">${r.criado_em?.slice(0,16).replace('T',' ')||'—'}</td>
    </tr>`).join()||'<tr><td colspan="5"><div class="sem-resultados">Sem registros</div></td></tr>';
}

function renderLogAreas(rows) {
  const tbody=document.getElementById('logs-areas-tbody');
  if(!tbody) return;
  const tb={entrada:'badge-green',saida:'badge-blue',negado:'badge-red'};
  tbody.innerHTML = rows.map(r=>`
    <tr>
      <td class="mono">${r.usuario_id||'—'}</td>
      <td class="mono">${r.area_codigo||'—'}</td>
      <td><span class="badge ${tb[r.tipo]||'badge-muted'}">${r.tipo}</span></td>
      <td class="text-muted">${r.motivo||'—'}</td>
      <td class="mono text-muted">${r.criado_em?.slice(0,16).replace('T',' ')||'—'}</td>
    </tr>`).join()||'<tr><td colspan="5"><div class="sem-resultados">Sem registros</div></td></tr>';
}

async function carregarLogAreaAba() {
  const area=document.getElementById('log-filter-area-aba')?.value||'';
  try {
    const rows=await api(area?`/api/logs/areas?area=${area}&limit=30`:'/api/logs/areas?limit=30');
    renderLogAreas(rows);
  } catch(e) {}
}

// ═════════════════════════════════════════════════════════════════════════════
// INICIALIZAÇÃO GERAL
// ═════════════════════════════════════════════════════════════════════════════

async function initDashboard() {
  let tentativas = 0;
  while (!window._sessao && tentativas < 20) {
    await new Promise(r=>setTimeout(r,100));
    tentativas++;
  }
  const nivel = window._sessao?.nivel;

  // Revela abas privilegiadas
  if (['gerente','admin'].includes(nivel)) {
    const tl=document.getElementById('tab-logs');
    if(tl) tl.style.display='flex';
  }
  if (nivel==='admin') {
    const tu=document.getElementById('tab-usuarios');
    if(tu) tu.style.display='flex';
  }

  // Botões "Gerenciar →" — câmeras, áreas e recursos: gerente+
  if (['gerente','admin'].includes(nivel)) {
    ['btn-gerenciar-cameras','btn-gerenciar-areas','btn-gerenciar-recursos'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'inline-flex';
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initDashboard();
  // Auto-refresh câmeras se aba estiver ativa
  setInterval(()=>{ if(_tabsCarregadas['cameras']) carregarCamerasTab(); }, 30000);
  // Auto-refresh badge de alertas
  setInterval(async()=>{
    try {
      const r = await api('/api/dashboard/resumo');
      const ba=document.getElementById('badge-alertas');
      if(ba) ba.textContent=r.metricas?.alertas_ativos??'0';
    } catch(e){}
  }, 60000);
});