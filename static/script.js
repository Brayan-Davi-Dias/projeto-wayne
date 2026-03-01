/* ════════════════════════════════════════════════════════
   Wayne Industries — script.js
   Login corporativo → transição → Batcomputer real
   ════════════════════════════════════════════════════════ */

/* ─────────────────────────────────────────────────────────
   1. LOGIN CORPORATIVO (tela 1)
   Credenciais: ID  → bruce  / Senha → batman
   ───────────────────────────────────────────────────────── */
const corpBtn    = document.getElementById('corp-btn');
const corpIdEl   = document.getElementById('corp-id');
const corpPassEl = document.getElementById('corp-pass');
const corpError  = document.getElementById('corp-error');
const screenLogin = document.getElementById('screen-login');
const screenBat   = document.getElementById('screen-bat');

// No seu script.js, mude para:
const CRED = { id: 'adm', pass: 'adm1234' };

function doCorpLogin() {
  const id   = corpIdEl.value.trim().toLowerCase();
  const pass = corpPassEl.value.trim().toLowerCase();

  const btnTxt = corpBtn.querySelector('.cp-btn-text');
  const btnLd  = corpBtn.querySelector('.cp-btn-loading');
  btnTxt.style.display = 'none';
  btnLd.style.display  = 'inline';
  corpBtn.disabled     = true;
  corpError.style.display = 'none';

  setTimeout(() => {
    if (id === CRED.id && pass === CRED.pass) {
      // ─── Transição para o Batcomputer ───
      transitionToBatcomputer();
    } else {
      btnTxt.style.display = 'inline';
      btnLd.style.display  = 'none';
      corpBtn.disabled     = false;
      corpError.style.display = 'block';

      // Shake nos campos
      [corpIdEl, corpPassEl].forEach(el => {
        el.style.borderColor = '#c53030';
        el.style.animation   = 'none';
        void el.offsetWidth;
        el.style.animation   = 'shake .4s ease';
        el.addEventListener('input', () => {
          el.style.borderColor = '';
          el.style.animation   = '';
        }, { once: true });
      });
    }
  }, 1200);
}

corpBtn.addEventListener('click', doCorpLogin);
[corpIdEl, corpPassEl].forEach(el => {
  el.addEventListener('keydown', e => { if (e.key === 'Enter') doCorpLogin(); });
});

// CSS shake inline
const shakeStyle = document.createElement('style');
shakeStyle.textContent = `
  @keyframes shake {
    0%,100%{transform:translateX(0)}
    25%{transform:translateX(-5px)}
    75%{transform:translateX(5px)}
  }
`;
document.head.appendChild(shakeStyle);


/* ─────────────────────────────────────────────────────────
   2. TRANSIÇÃO — Wayne → Batcomputer
   ───────────────────────────────────────────────────────── */
function transitionToBatcomputer() {
  // Fase 1: fade-out corporativo
  screenLogin.style.transition = 'opacity .5s, transform .5s';
  screenLogin.style.opacity    = '0';
  screenLogin.style.transform  = 'scale(1.04)';

  setTimeout(() => {
    screenLogin.style.display = 'none';
    screenBat.style.display   = 'block';
    screenBat.style.opacity   = '0';
    screenBat.style.transition = 'opacity .8s';

    // Fase 2: init do Batcomputer
    initBatcomputer();

    // Fase 3: fade-in dark
    setTimeout(() => { screenBat.style.opacity = '1'; }, 80);
  }, 500);
}


/* ─────────────────────────────────────────────────────────
   3. BATCOMPUTER — inicialização completa
   ───────────────────────────────────────────────────────── */
function initBatcomputer() {
  initParticles();
  initRain();
  initClock();
  initBottomStatus();
  initActivityLog();
  initMainChart();
  initThreatChart();
  initThreatCounter();
  initLogout();
}


/* ─────────────────────────────────────────────────────────
   4. PARTÍCULAS (canvas)
   ───────────────────────────────────────────────────────── */
function initParticles() {
  const canvas = document.getElementById('bat-canvas');
  const ctx    = canvas.getContext('2d');

  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  const pts = Array.from({ length: 70 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    vx: (Math.random() - .5) * .3,
    vy: (Math.random() - .5) * .3,
    r:  Math.random() * 1.2 + .3,
    a:  Math.random() * .3 + .07,
  }));

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y;
        const d  = Math.hypot(dx, dy);
        if (d < 100) {
          ctx.beginPath();
          ctx.strokeStyle = `rgba(26,143,255,${.06*(1-d/100)})`;
          ctx.lineWidth = .5;
          ctx.moveTo(pts[i].x, pts[i].y);
          ctx.lineTo(pts[j].x, pts[j].y);
          ctx.stroke();
        }
      }
    }
    pts.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
      ctx.fillStyle = `rgba(255,255,255,${p.a})`;
      ctx.fill();
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0 || p.x > canvas.width)  p.vx *= -1;
      if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
    });
    requestAnimationFrame(draw);
  }
  draw();
}


/* ─────────────────────────────────────────────────────────
   5. CHUVA DE CÓDIGO
   ───────────────────────────────────────────────────────── */
function initRain() {
  const c  = document.getElementById('bat-rain');
  const ch = '01アカキＡＢ#$[]{}0123456789<>';
  for (let i = 0; i < 45; i++) {
    const s = document.createElement('span');
    s.textContent = Array.from({length: Math.floor(Math.random()*10)+5},
      () => ch[Math.floor(Math.random()*ch.length)]).join('');
    s.style.left              = Math.random()*100+'vw';
    s.style.animationDuration = (Math.random()*10+7)+'s';
    s.style.animationDelay    = (Math.random()*8)+'s';
    s.style.fontSize          = (Math.random()*3+9)+'px';
    c.appendChild(s);
  }
}


/* ─────────────────────────────────────────────────────────
   6. RELÓGIO
   ───────────────────────────────────────────────────────── */
function initClock() {
  const el  = document.getElementById('bat-clock');
  const pad = n => String(n).padStart(2,'0');
  const tick = () => {
    const d = new Date();
    el.textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  };
  tick(); setInterval(tick, 1000);
}


/* ─────────────────────────────────────────────────────────
   7. STATUS INFERIOR
   ───────────────────────────────────────────────────────── */
function initBottomStatus() {
  const el = document.getElementById('bat-bot-status');
  const msgs = [
    '▶ BATCOMPUTER ACTIVE — ALL SYSTEMS NOMINAL',
    '▶ MONITORING GOTHAM CITY NETWORK...',
    '▶ ENCRYPTION AES-512 — SECURE CHANNEL',
    '▶ BAT-SIGNAL: STANDBY MODE',
    '▶ SCANNING FOR ANOMALOUS ACTIVITY...',
  ];
  let i = 0;
  el.style.transition = 'opacity .3s';
  setInterval(() => {
    el.style.opacity = '0';
    setTimeout(() => {
      i = (i+1) % msgs.length;
      el.textContent = msgs[i];
      el.style.opacity = '1';
    }, 300);
  }, 3500);
}


/* ─────────────────────────────────────────────────────────
   8. ACTIVITY LOG
   ───────────────────────────────────────────────────────── */
function initActivityLog() {
  const container = document.getElementById('bdl-items');
  const logs = [
    { text: 'Joker spotted — East End warehouse district', type: 'alert' },
    { text: 'Bat-signal activated by Commissioner Gordon', type: 'new' },
    { text: 'Alfred — cave systems check complete', type: '' },
    { text: 'Encrypted comms intercepted — Narrows sector', type: 'alert' },
    { text: 'Robin — on patrol, downtown Gotham', type: '' },
    { text: 'Wayne Tower security sweep — clear', type: '' },
    { text: 'Unknown vehicle — Gotham Bridge cam 07', type: 'new' },
  ];

  const pad = n => String(n).padStart(2,'0');
  function getTime() {
    const d = new Date();
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  // Mostra os primeiros 4 ao carregar
  logs.slice(0, 4).forEach((l, idx) => {
    const el = document.createElement('div');
    el.className = 'bdl-item' + (l.type ? ' '+l.type : '');
    el.innerHTML = `<span class="bdl-time">${getTime()}</span>${l.text}`;
    container.appendChild(el);
  });

  // Adiciona novos a cada 4s
  let li = 4;
  setInterval(() => {
    if (li >= logs.length) li = 0;
    const el = document.createElement('div');
    el.className = 'bdl-item new' + (logs[li].type === 'alert' ? ' alert' : '');
    el.innerHTML = `<span class="bdl-time">${getTime()}</span>${logs[li].text}`;
    container.prepend(el);
    // Max 4 items
    while (container.children.length > 4) container.removeChild(container.lastChild);
    li++;
  }, 4000);
}


/* ─────────────────────────────────────────────────────────
   9. GRÁFICO PRINCIPAL (actividade 24h)
   ───────────────────────────────────────────────────────── */
function initMainChart() {
  const canvas = document.getElementById('main-chart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const data = Array.from({length:60},()=>Math.random()*55+10);

  function draw() {
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0,0,W,H);

    // Linhas de grade
    ctx.strokeStyle = 'rgba(255,255,255,.04)';
    ctx.lineWidth = .5;
    for (let i=0;i<4;i++) {
      const y = (i/3)*H;
      ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke();
    }

    // Área
    ctx.beginPath();
    data.forEach((v,i) => {
      const x = (i/(data.length-1))*W;
      const y = H - (v/70)*H;
      i===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
    });
    ctx.lineTo(W,H); ctx.lineTo(0,H); ctx.closePath();
    ctx.fillStyle = 'rgba(26,143,255,.07)';
    ctx.fill();

    // Linha
    ctx.beginPath();
    data.forEach((v,i) => {
      const x = (i/(data.length-1))*W;
      const y = H - (v/70)*H;
      i===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
    });
    ctx.strokeStyle = 'rgba(26,143,255,.7)';
    ctx.lineWidth = 1.2;
    ctx.shadowColor = '#1a8fff'; ctx.shadowBlur = 4;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Pico (vermelho)
    const peak = data.indexOf(Math.max(...data));
    const px = (peak/(data.length-1))*W;
    const py = H - (data[peak]/70)*H;
    ctx.beginPath();
    ctx.arc(px, py, 3, 0, Math.PI*2);
    ctx.fillStyle = '#ff3b30';
    ctx.shadowColor = '#ff3b30'; ctx.shadowBlur = 8;
    ctx.fill(); ctx.shadowBlur = 0;
  }

  draw();
  setInterval(() => {
    data.shift(); data.push(Math.random()*55+10);
    draw();
  }, 500);
}


/* ─────────────────────────────────────────────────────────
   10. GRÁFICO DE AMEAÇAS (lateral)
   ───────────────────────────────────────────────────────── */
function initThreatChart() {
  const canvas = document.getElementById('threat-chart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const series = {
    red:    Array.from({length:30},()=>Math.random()*60+15),
    yellow: Array.from({length:30},()=>Math.random()*35+8),
    blue:   Array.from({length:30},()=>Math.random()*20+4),
  };

  function drawLine(data, color, W, H) {
    ctx.beginPath();
    data.forEach((v,i) => {
      const x = (i/(data.length-1))*W;
      const y = H - (v/90)*H;
      i===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
    });
    ctx.strokeStyle = color; ctx.lineWidth = 1;
    ctx.shadowColor = color; ctx.shadowBlur = 3;
    ctx.stroke(); ctx.shadowBlur = 0;
  }

  function draw() {
    const W=canvas.width, H=canvas.height;
    ctx.clearRect(0,0,W,H);
    ctx.strokeStyle='rgba(255,255,255,.04)'; ctx.lineWidth=.5;
    for(let i=0;i<5;i++){const y=(i/4)*H;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
    drawLine(series.red, '#ff3b30', W, H);
    drawLine(series.yellow, '#ffd600', W, H);
    drawLine(series.blue, '#1a8fff', W, H);
  }

  draw();
  setInterval(() => {
    ['red','yellow','blue'].forEach(k => {
      series[k].shift();
      series[k].push(Math.random()*(k==='red'?70:k==='yellow'?40:25)+5);
    });
    draw();
  }, 700);
}


/* ─────────────────────────────────────────────────────────
   11. CONTADOR DE AMEAÇAS (oscila)
   ───────────────────────────────────────────────────────── */
function initThreatCounter() {
  const els = [document.getElementById('b-threats'), document.getElementById('c-threats')];
  setInterval(() => {
    const n = String(Math.floor(Math.random()*5)+1).padStart(2,'0');
    els.forEach(el => { if(el) el.textContent = n; });
  }, 5000);
}


/* ─────────────────────────────────────────────────────────
   12. LOGOUT → volta para tela corporativa
   ───────────────────────────────────────────────────────── */
function initLogout() {
  document.getElementById('bat-logout').addEventListener('click', () => {
    screenBat.style.transition = 'opacity .5s';
    screenBat.style.opacity    = '0';
    setTimeout(() => {
      screenBat.style.display   = 'none';
      screenLogin.style.display = 'flex';
      screenLogin.style.opacity = '0';
      screenLogin.style.transform = 'scale(.97)';
      screenLogin.style.transition = 'opacity .5s, transform .5s';
      corpIdEl.value = ''; corpPassEl.value = '';
      setTimeout(() => {
        screenLogin.style.opacity   = '1';
        screenLogin.style.transform = 'scale(1)';
      }, 50);
    }, 500);
  });
}


/* ─────────────────────────────────────────────────────────
   13. KONAMI → auto-login
   ───────────────────────────────────────────────────────── */
const KONAMI = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
let ki = 0;
document.addEventListener('keydown', e => {
  ki = e.key === KONAMI[ki] ? ki + 1 : 0;
  if (ki === KONAMI.length) {
    ki = 0;
    corpIdEl.value   = 'bruce';
    corpPassEl.value = 'batman';
    corpIdEl.style.borderColor   = '#0a3c78';
    corpPassEl.style.borderColor = '#0a3c78';
    doCorpLogin();
    console.log('%c 🦇 I AM BATMAN ', 'background:#000;color:#1a8fff;font-size:18px;font-weight:bold;border:1px solid #1a8fff;padding:8px 20px;');
  }
});