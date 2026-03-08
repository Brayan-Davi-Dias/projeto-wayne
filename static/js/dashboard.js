/* =============================================================================
   DASHBOARD.JS — Overview principal
   Responsável por: métricas, log, inventário, frota, ameaças, comunicações,
   radar canvas, gráfico de atividade (main-chart) e mapa de Gotham.
   Depende de: api() e toast() definidos no base_corp.html
   ============================================================================= */

// ─────────────────────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────────────────────

async function initOverview() {
  try {
    const res = await api('/api/dashboard/resumo');
    const { metricas, acessos, alertas, inventario, frota, ameacas, comunicacoes, atividade } = res;

    if (typeof window.renderMetricas === 'function') window.renderMetricas(metricas);
    if (typeof window.renderLog     === 'function') window.renderLog(acessos, alertas);

    renderInventario(inventario);
    renderFrota(frota);
    renderAmeacas(ameacas);
    renderComunicacoes(comunicacoes);
    renderMainChart(atividade);
    renderRadar(metricas);
    renderGotham();
  } catch (e) {
    console.error('[dashboard.js] Erro ao carregar overview:', e);
    toast('error', 'Erro ao carregar painel: ' + e.message);
  }
}

document.addEventListener('DOMContentLoaded', initOverview);

// ─────────────────────────────────────────────────────────────────────────────
// INVENTÁRIO
// ─────────────────────────────────────────────────────────────────────────────

function renderInventario(items) {
  const el = document.getElementById('inv-list');
  if (!el) return;
  if (!items?.length) {
    el.innerHTML = '<div class="empty-state"><span>Sem itens</span></div>'; return;
  }

  const statusCor = {
    disponivel:  'var(--green)',
    operacional: 'var(--blue2)',
    standby:     'var(--muted)',
    manutencao:  'var(--gold)',
    critico:     'var(--red)',
  };
  const tipIcon = { veiculo:'🚗', equipamento:'🛡', dispositivo:'📡' };

  el.innerHTML = items.map(i => `
    <div style="
      display:flex; align-items:center; gap:8px; padding:5px 8px;
      border:1px solid var(--border); border-radius:3px;
      border-left:3px solid ${statusCor[i.status]||'var(--border)'};
    ">
      <span style="font-size:12px">${tipIcon[i.tipo]||'◈'}</span>
      <span style="flex:1; font-size:11px; color:#b0bcd4; overflow:hidden; text-overflow:ellipsis; white-space:nowrap">${i.nome}</span>
      <span style="font-family:var(--font-mono); font-size:9px; color:${statusCor[i.status]||'var(--muted)'}">
        ${i.status.toUpperCase()}
      </span>
    </div>`).join('');
}

// ─────────────────────────────────────────────────────────────────────────────
// FROTA
// ─────────────────────────────────────────────────────────────────────────────

function renderFrota(frota) {
  const el = document.getElementById('veh-stats');
  if (!el) return;
  if (!frota) {
    el.innerHTML = '<div class="empty-state"><span>Sem dados</span></div>'; return;
  }

  // frota pode vir como array de veículos ou como objeto de contadores
  const items = Array.isArray(frota) ? frota : Object.entries(frota).map(([k,v]) => ({ label:k, valor:v }));

  if (Array.isArray(frota) && frota.length) {
    // array de veículos
    const statusCor = {
      disponivel:'var(--green)', operacional:'var(--blue2)',
      standby:'var(--muted)',    manutencao:'var(--gold)', critico:'var(--red)',
    };
    el.innerHTML = frota.slice(0,6).map(v => `
      <div style="display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid var(--border)">
        <span style="font-size:10px">🚗</span>
        <span style="flex:1;font-size:11px;color:#b0bcd4">${v.nome}</span>
        <span style="font-family:var(--font-mono);font-size:9px;color:${statusCor[v.status]||'var(--muted)'}">
          ${v.status?.toUpperCase()||'—'}
        </span>
      </div>`).join('');
  } else {
    // objeto de contadores { disponivel: 3, manutencao: 1, ... }
    const corMap = { disponivel:'var(--green)', operacional:'var(--blue2)', manutencao:'var(--gold)', critico:'var(--red)', standby:'var(--muted)' };
    el.innerHTML = items.map(({label, valor}) => `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--border)">
        <span style="font-family:var(--font-mono);font-size:10px;color:var(--muted);text-transform:uppercase">${label}</span>
        <span style="font-family:var(--font-mono);font-size:13px;font-weight:700;color:${corMap[label]||'var(--blue2)'}">
          ${valor}
        </span>
      </div>`).join('');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// AMEAÇAS
// ─────────────────────────────────────────────────────────────────────────────

function renderAmeacas(ameacas) {
  const el = document.getElementById('threats-body');
  if (!el) return;
  if (!ameacas?.length) {
    el.innerHTML = `
      <div style="text-align:center;padding:20px;color:var(--green);font-family:var(--font-mono);font-size:11px">
        ✓ NENHUMA AMEAÇA ATIVA
      </div>`; return;
  }

  const nivelCor = { baixo:'var(--green)', medio:'var(--gold)', alto:'var(--red)', critico:'var(--red)' };
  const nivelGlow = { critico:'0 0 6px var(--red)', alto:'0 0 4px var(--red)' };

  el.innerHTML = ameacas.map(a => `
    <div style="
      padding:8px 10px; border-radius:3px;
      border:1px solid ${nivelCor[a.nivel]||'var(--border)'}44;
      border-left:3px solid ${nivelCor[a.nivel]||'var(--border)'};
      box-shadow:${nivelGlow[a.nivel]||'none'};
      margin-bottom:2px;
    ">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">
        <span style="font-size:11px;font-weight:700;color:#d0ddf0">${a.titulo||a.tipo||'Ameaça'}</span>
        <span style="font-family:var(--font-mono);font-size:9px;font-weight:700;color:${nivelCor[a.nivel]||'var(--muted)'}">
          ${(a.nivel||'').toUpperCase()}
        </span>
      </div>
      <div style="font-size:10px;color:var(--muted);font-family:var(--font-mono)">
        ${a.area_codigo||'—'} · ${fmtTs(a.criado_em)}
      </div>
    </div>`).join('');
}

// ─────────────────────────────────────────────────────────────────────────────
// COMUNICAÇÕES
// ─────────────────────────────────────────────────────────────────────────────

function renderComunicacoes(comms) {
  const el = document.getElementById('comms-body');
  if (!el) return;
  if (!comms?.length) {
    el.innerHTML = '<div class="empty-state"><span>Sem comunicações</span></div>'; return;
  }

  el.innerHTML = comms.map(c => `
    <div style="
      display:flex; gap:10px; align-items:flex-start;
      padding:7px 0; border-bottom:1px solid var(--border);
    ">
      <div style="
        width:28px; height:28px; border-radius:50%; flex-shrink:0;
        background:var(--bg3); border:1px solid var(--border2);
        display:flex;align-items:center;justify-content:center;
        font-size:11px; color:var(--blue2);
      ">${(c.de||'?')[0].toUpperCase()}</div>
      <div style="flex:1;overflow:hidden">
        <div style="display:flex;justify-content:space-between;margin-bottom:2px">
          <span style="font-size:11px;font-weight:700;color:#b0bcd4">${c.de||'—'}</span>
          <span style="font-family:var(--font-mono);font-size:9px;color:var(--muted)">${fmtTs(c.criado_em)}</span>
        </div>
        <div style="font-size:11px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
          ${c.mensagem||''}
        </div>
      </div>
    </div>`).join('');
}

// ─────────────────────────────────────────────────────────────────────────────
// GRÁFICO DE ATIVIDADE — main-chart (canvas puro)
// ─────────────────────────────────────────────────────────────────────────────

function renderMainChart(atividade) {
  const canvas = document.getElementById('main-chart');
  if (!canvas) return;

  // Gera dados fictícios se a API não retornar
  const dados = Array.isArray(atividade) && atividade.length
    ? atividade
    : Array.from({ length: 24 }, (_, i) => ({ hora: i, total: Math.floor(Math.random() * 30) }));

  const ctx   = canvas.getContext('2d');
  const dpr   = window.devicePixelRatio || 1;
  const W     = canvas.parentElement?.clientWidth || 400;
  const H     = 60;

  canvas.width  = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width  = W + 'px';
  canvas.style.height = H + 'px';
  ctx.scale(dpr, dpr);

  const vals   = dados.map(d => d.total ?? d.valor ?? 0);
  const maxVal = Math.max(...vals, 1);
  const pad    = { top: 6, bottom: 16, left: 4, right: 4 };
  const cW     = W - pad.left - pad.right;
  const cH     = H - pad.top - pad.bottom;
  const step   = cW / (vals.length - 1 || 1);

  ctx.clearRect(0, 0, W, H);

  // Linha de grade
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth   = 1;
  [0.25, 0.5, 0.75].forEach(p => {
    const y = pad.top + cH * (1 - p);
    ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(W - pad.right, y); ctx.stroke();
  });

  // Pontos do path
  const pts = vals.map((v, i) => ({
    x: pad.left + i * step,
    y: pad.top  + cH * (1 - v / maxVal),
  }));

  // Área preenchida
  const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + cH);
  grad.addColorStop(0,   'rgba(29,110,245,0.35)');
  grad.addColorStop(1,   'rgba(29,110,245,0)');
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pad.top + cH);
  pts.forEach(p => ctx.lineTo(p.x, p.y));
  ctx.lineTo(pts[pts.length - 1].x, pad.top + cH);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // Linha
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  pts.forEach(p => ctx.lineTo(p.x, p.y));
  ctx.strokeStyle = '#1d6ef5';
  ctx.lineWidth   = 1.5;
  ctx.lineJoin    = 'round';
  ctx.stroke();

  // Labels de hora (a cada 6h)
  ctx.fillStyle   = 'rgba(140,155,180,0.7)';
  ctx.font        = `${9 * dpr / dpr}px monospace`;
  ctx.textAlign   = 'center';
  [0, 6, 12, 18, 23].forEach(h => {
    const idx = dados.findIndex(d => (d.hora ?? d.h) === h);
    if (idx < 0) return;
    const x = pad.left + idx * step;
    ctx.fillText(`${String(h).padStart(2,'0')}h`, x, H - 3);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// RADAR CANVAS
// ─────────────────────────────────────────────────────────────────────────────

function renderRadar(metricas) {
  const canvas = document.getElementById('radar-canvas');
  if (!canvas) return;

  const ctx    = canvas.getContext('2d');
  const dpr    = window.devicePixelRatio || 1;
  const SIZE   = 182;

  canvas.width  = SIZE * dpr;
  canvas.height = SIZE * dpr;
  canvas.style.width  = SIZE + 'px';
  canvas.style.height = SIZE + 'px';
  ctx.scale(dpr, dpr);

  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const R  = 70;

  // Anéis
  ctx.strokeStyle = 'rgba(29,110,245,0.18)';
  ctx.lineWidth   = 1;
  [0.33, 0.66, 1].forEach(f => {
    ctx.beginPath();
    ctx.arc(cx, cy, R * f, 0, Math.PI * 2);
    ctx.stroke();
  });

  // Cruz
  ctx.beginPath(); ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R); ctx.stroke();

  // Varredura animada
  let angle = 0;
  const sweep = () => {
    ctx.clearRect(0, 0, SIZE, SIZE);

    // Re-desenha anéis
    ctx.strokeStyle = 'rgba(29,110,245,0.18)';
    ctx.lineWidth = 1;
    [0.33, 0.66, 1].forEach(f => {
      ctx.beginPath(); ctx.arc(cx, cy, R * f, 0, Math.PI * 2); ctx.stroke();
    });
    ctx.beginPath(); ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R); ctx.stroke();

    // Cone de varredura
    const grad = ctx.createConicalGradient
      ? null // fallback abaixo
      : null;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    const sweep_grad = ctx.createLinearGradient(0, 0, R, 0);
    sweep_grad.addColorStop(0,   'rgba(29,110,245,0.5)');
    sweep_grad.addColorStop(1,   'rgba(29,110,245,0)');
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, R, -0.35, 0.35);
    ctx.closePath();
    ctx.fillStyle = sweep_grad;
    ctx.fill();
    ctx.restore();

    // Linha de varredura
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(R, 0);
    ctx.strokeStyle = 'rgba(29,110,245,0.9)';
    ctx.lineWidth   = 1.5;
    ctx.stroke();
    ctx.restore();

    // Blip de alerta se houver ameaças
    const temAmeaca = (metricas?.alertas_ativos ?? 0) > 0;
    if (temAmeaca) {
      const bx = cx + R * 0.55 * Math.cos(0.9);
      const by = cy + R * 0.55 * Math.sin(0.9);
      const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 300);
      ctx.beginPath();
      ctx.arc(bx, by, 3 + pulse * 2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(240,64,64,${0.6 + pulse * 0.4})`;
      ctx.fill();
    }

    // Centro
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#1d6ef5';
    ctx.fill();

    angle += 0.03;
    requestAnimationFrame(sweep);
  };
  sweep();
}

// ─────────────────────────────────────────────────────────────────────────────
// MAPA DE GOTHAM — gotham-canvas
// ─────────────────────────────────────────────────────────────────────────────

function renderGotham() {
  const canvas = document.getElementById('gotham-canvas');
  if (!canvas) return;

  const ctx  = canvas.getContext('2d');
  const dpr  = window.devicePixelRatio || 1;
  const W    = canvas.parentElement?.clientWidth || 224;
  const H    = 128;

  canvas.width  = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width  = W + 'px';
  canvas.style.height = H + 'px';
  ctx.scale(dpr, dpr);

  // Fundo
  ctx.fillStyle = '#0a0d14';
  ctx.fillRect(0, 0, W, H);

  // Grade de ruas
  ctx.strokeStyle = 'rgba(29,110,245,0.12)';
  ctx.lineWidth   = 1;
  const cols = 8, rows = 5;
  for (let i = 0; i <= cols; i++) {
    const x = (W / cols) * i;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let j = 0; j <= rows; j++) {
    const y = (H / rows) * j;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }

  // Blocos de quarteirão (prédios)
  const blocos = [
    [1,1,2,2], [4,0,2,1], [6,2,1,2], [0,3,3,1],
    [5,3,2,1], [3,2,1,1], [2,0,1,1], [7,1,1,1],
    [0,0,1,2], [3,4,2,1],
  ];
  blocos.forEach(([col, row, cw, rh]) => {
    const bx = (W / cols) * col + 2;
    const by = (H / rows) * row + 2;
    const bw = (W / cols) * cw - 4;
    const bh = (H / rows) * rh - 4;
    ctx.fillStyle = 'rgba(20,30,50,0.9)';
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = 'rgba(29,110,245,0.2)';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(bx, by, bw, bh);
  });

  // Ponto Wayne Tower
  const wx = W * 0.5, wy = H * 0.42;
  const pulsarWT = () => {
    const t = Date.now() / 800;
    const r = 4 + 2 * Math.sin(t);
    ctx.save();
    ctx.beginPath();
    ctx.arc(wx, wy, r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(29,110,245,${0.3 + 0.2 * Math.sin(t)})`;
    ctx.fill();
    ctx.restore();

    ctx.beginPath();
    ctx.arc(wx, wy, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#1d6ef5';
    ctx.fill();

    ctx.fillStyle = 'rgba(150,180,230,0.8)';
    ctx.font      = '7px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('W', wx, wy + 12);
  };

  // Re-render loop
  const loop = () => {
    ctx.fillStyle = '#0a0d14';
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = 'rgba(29,110,245,0.12)';
    ctx.lineWidth   = 1;
    for (let i = 0; i <= cols; i++) {
      const x = (W / cols) * i;
      ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke();
    }
    for (let j = 0; j <= rows; j++) {
      const y = (H / rows) * j;
      ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke();
    }
    blocos.forEach(([col, row, cw, rh]) => {
      const bx = (W/cols)*col+2, by = (H/rows)*row+2;
      const bw = (W/cols)*cw-4,  bh = (H/rows)*rh-4;
      ctx.fillStyle   = 'rgba(20,30,50,0.9)'; ctx.fillRect(bx,by,bw,bh);
      ctx.strokeStyle = 'rgba(29,110,245,0.2)'; ctx.lineWidth=0.5; ctx.strokeRect(bx,by,bw,bh);
    });
    pulsarWT();
    requestAnimationFrame(loop);
  };
  loop();
}

// ─────────────────────────────────────────────────────────────────────────────
// UTIL
// ─────────────────────────────────────────────────────────────────────────────

function fmtTs(ts) {
  if (!ts) return '—';
  try {
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  } catch { return '—'; }
}