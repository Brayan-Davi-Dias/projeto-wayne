// =============================================================================
// SCRIPT.JS — Login Wayne Industries
// =============================================================================

document.addEventListener('DOMContentLoaded', () => {
  const form    = document.getElementById('login-form');
  const btnText = document.querySelector('.cp-btn-text');
  const btnLoad = document.querySelector('.cp-btn-loading');
  const btnEl   = document.getElementById('corp-btn');
  const errorEl = document.getElementById('corp-error');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id    = document.getElementById('corp-id').value.trim();
    const senha = document.getElementById('corp-pass').value;

    if (!id || !senha) {
      mostrarErro('Preencha todos os campos.');
      return;
    }

    setCarregando(true);
    esconderErro();

    try {
      const res  = await fetch('/api/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ id, senha }),
      });
      const data = await res.json();

      if (data.sucesso) {
        btnText.textContent = '✓ ACESSO CONCEDIDO';
        btnEl.style.background = '#1a7f3c';
        setTimeout(() => {
          window.location.href = data.redirect || '/dashboard';
        }, 800);
      } else {
        mostrarErro(data.mensagem || 'Credenciais inválidas.');
        setCarregando(false);
        agitarFormulario();
      }
    } catch (err) {
      mostrarErro('Erro de conexão. Tente novamente.');
      setCarregando(false);
    }
  });

  function setCarregando(ativo) {
    btnEl.disabled    = ativo;
    btnText.style.display = ativo ? 'none' : 'inline';
    btnLoad.style.display = ativo ? 'inline' : 'none';
  }

  function mostrarErro(msg) {
    errorEl.textContent    = msg;
    errorEl.style.display  = 'block';
  }

  function esconderErro() {
    errorEl.style.display = 'none';
  }

  function agitarFormulario() {
    const panel = document.querySelector('.corp-panel');
    panel.style.animation = 'none';
    panel.offsetHeight; // reflow
    panel.style.animation = 'shake 0.4s ease';
  }

  // Shake animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes shake {
      0%,100%{transform:translateX(0)}
      20%{transform:translateX(-8px)}
      40%{transform:translateX(8px)}
      60%{transform:translateX(-4px)}
      80%{transform:translateX(4px)}
    }
  `;
  document.head.appendChild(style);
});