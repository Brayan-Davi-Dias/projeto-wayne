from flask import Flask, render_template, request, redirect, url_for, flash, session

app = Flask(__name__)
app.secret_key = 'bat-caverna-key'


usuarios_autorizados = {
    "adm": {"nome": "Brayan", "senha": "adm1234", "nivel": "admin"}
}
@app.route('/')
def index():
    return render_template('login.html')

@app.route('/login', methods=['POST'])
def login():
    id_funcionario = request.form.get('usuario')
    senha = request.form.get('senha')

    user = usuarios_autorizados.get(id_funcionario)

    # Verifica se o usuário é 'adm' e a senha é 'adm1234'
    if user and user['senha'] == senha:
        session['usuario_logado'] = user['nome']
        session['nivel_acesso'] = user['nivel']
        return redirect(url_for('dashboard'))
    else:
        return "Acesso Negado: Credenciais inválidas em Gotham."

@app.route('/dashboard')
def dashboard():
    if 'usuario_logado' not in session:
        return redirect(url_for('index'))
    return render_template('dashboard.html', nome=session['usuario_logado'])

if __name__ == '__main__':
    import os
    # O Render define a porta automaticamente, por isso usamos os.environ
    port = int(os.environ.get("PORT", 5000))
    # host='0.0.0.0' permite que o servidor seja acessado externamente
    app.run(host='0.0.0.0', port=port)
