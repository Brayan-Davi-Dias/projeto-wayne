from flask import Flask, render_template, request, jsonify, session, redirect, url_for
import sqlite3
import hashlib
import os
import secrets
from datetime import datetime, timedelta
from functools import wraps

app = Flask(__name__)

# =============================================================================
# SECRET KEY — gera uma chave segura por processo
# Para produção, defina a variável de ambiente SECRET_KEY com um valor fixo,
# caso contrário cada reinício do servidor invalida todas as sessões.
# =============================================================================
app.secret_key = os.environ.get('SECRET_KEY') or secrets.token_hex(32)

# =============================================================================
# CONFIGURAÇÕES DE SESSÃO
# =============================================================================
app.config['SESSION_COOKIE_HTTPONLY'] = True        # JS não acessa o cookie
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'      # Proteção CSRF básica
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(hours=8)  # Expira em 8h

DB_PATH = 'database.db'


# =============================================================================
# HIERARQUIA DE NÍVEIS
# =============================================================================
NIVEL_HIERARQUIA = {
    'operador':    1,
    'funcionario': 2,
    'gerente':     3,
    'admin':       4,
}


# =============================================================================
# DECORATORS DE AUTORIZAÇÃO
# =============================================================================

def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'usuario_id' not in session:
            if request.is_json:
                return jsonify({"erro": "Não autenticado."}), 401
            return redirect(url_for('index'))

        # ── Verifica se a sessão expirou ──────────────────────────────────────
        ultimo_acesso = session.get('ultimo_acesso')
        if ultimo_acesso:
            try:
                delta = datetime.utcnow() - datetime.fromisoformat(ultimo_acesso)
                if delta > timedelta(hours=8):
                    session.clear()
                    if request.is_json:
                        return jsonify({"erro": "Sessão expirada."}), 401
                    return redirect(url_for('index'))
            except Exception:
                pass

        # Atualiza timestamp de último acesso
        session['ultimo_acesso'] = datetime.utcnow().isoformat()
        session.modified = True

        return f(*args, **kwargs)
    return decorated


def nivel_required(nivel_minimo):
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            if 'usuario_id' not in session:
                if request.is_json:
                    return jsonify({"erro": "Não autenticado."}), 401
                return redirect(url_for('index'))

            # Mesmo timeout check
            ultimo_acesso = session.get('ultimo_acesso')
            if ultimo_acesso:
                try:
                    delta = datetime.utcnow() - datetime.fromisoformat(ultimo_acesso)
                    if delta > timedelta(hours=8):
                        session.clear()
                        if request.is_json:
                            return jsonify({"erro": "Sessão expirada."}), 401
                        return redirect(url_for('index'))
                except Exception:
                    pass

            nivel_usuario = session.get('nivel', 'operador')
            if NIVEL_HIERARQUIA.get(nivel_usuario, 0) < NIVEL_HIERARQUIA.get(nivel_minimo, 99):
                if request.is_json:
                    return jsonify({"erro": "Acesso negado. Nível insuficiente."}), 403
                return render_template('403.html'), 403

            session['ultimo_acesso'] = datetime.utcnow().isoformat()
            session.modified = True

            return f(*args, **kwargs)
        return decorated
    return decorator


# =============================================================================
# BANCO DE DADOS
# =============================================================================

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    c = conn.cursor()

    c.execute('''
        CREATE TABLE IF NOT EXISTS usuarios (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_id   TEXT UNIQUE NOT NULL,
            senha_hash   TEXT NOT NULL,
            nome         TEXT,
            nivel        TEXT DEFAULT 'operador',
            departamento TEXT DEFAULT 'Geral',
            ativo        INTEGER DEFAULT 1,
            criado_em    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    c.execute('''
        CREATE TABLE IF NOT EXISTS logs_acesso (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_id TEXT,
            ip         TEXT,
            sucesso    INTEGER,
            mensagem   TEXT,
            criado_em  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    c.execute('''
        CREATE TABLE IF NOT EXISTS areas (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            codigo       TEXT UNIQUE NOT NULL,
            nome         TEXT NOT NULL,
            descricao    TEXT,
            nivel_acesso TEXT DEFAULT 'funcionario',
            status       TEXT DEFAULT 'normal',
            andar        TEXT,
            criado_em    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    c.execute('''
        CREATE TABLE IF NOT EXISTS controle_acesso (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_id  TEXT,
            area_codigo TEXT,
            tipo        TEXT,
            motivo      TEXT,
            criado_em   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    c.execute('''
        CREATE TABLE IF NOT EXISTS recursos (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            codigo        TEXT UNIQUE NOT NULL,
            nome          TEXT NOT NULL,
            tipo          TEXT NOT NULL,
            subtipo       TEXT,
            status        TEXT DEFAULT 'disponivel',
            localizacao   TEXT,
            responsavel   TEXT,
            descricao     TEXT,
            criado_em     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    c.execute('''
        CREATE TABLE IF NOT EXISTS cameras (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            codigo       TEXT UNIQUE NOT NULL,
            nome         TEXT NOT NULL,
            area_codigo  TEXT,
            localizacao  TEXT,
            status       TEXT DEFAULT 'online',
            feed_url     TEXT,
            nivel_acesso TEXT DEFAULT 'operador',
            criado_em    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    c.execute('''
        CREATE TABLE IF NOT EXISTS alertas (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            tipo        TEXT NOT NULL,
            titulo      TEXT NOT NULL,
            descricao   TEXT,
            area_codigo TEXT,
            nivel       TEXT DEFAULT 'baixo',
            resolvido   INTEGER DEFAULT 0,
            criado_por  TEXT,
            criado_em   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    c.execute('SELECT COUNT(*) FROM usuarios')
    if c.fetchone()[0] == 0:
        _seed_usuarios(c)

    c.execute('SELECT COUNT(*) FROM areas')
    if c.fetchone()[0] == 0:
        _seed_areas(c)

    c.execute('SELECT COUNT(*) FROM recursos')
    if c.fetchone()[0] == 0:
        _seed_recursos(c)

    c.execute('SELECT COUNT(*) FROM cameras')
    if c.fetchone()[0] == 0:
        _seed_cameras(c)

    conn.commit()
    conn.close()


def _seed_usuarios(c):
    usuarios = [
        ('WI-00123', 'batman',     'Bruce Wayne',        'admin',       'Diretoria'),
        ('bruce',    'batman',     'Bruce Wayne',        'admin',       'Diretoria'),
        ('alfred',   'pennyworth', 'Alfred Pennyworth',  'admin',       'Operações'),
        ('adm',      'adm1234',    'Administrador',      'admin',       'TI'),
        ('gordon',   'gcpd1234',   'James Gordon',       'gerente',     'Segurança'),
        ('lucius',   'fox1234',    'Lucius Fox',         'gerente',     'P&D'),
        ('robin',    'robin123',   'Dick Grayson',       'funcionario', 'Operações'),
        ('barbara',  'oracle123',  'Barbara Gordon',     'funcionario', 'TI'),
        ('seguranca1','seg1234',   'Agente Silva',       'operador',    'Segurança'),
    ]
    for uid, senha, nome, nivel, dept in usuarios:
        c.execute(
            'INSERT INTO usuarios (usuario_id, senha_hash, nome, nivel, departamento) VALUES (?,?,?,?,?)',
            (uid, hash_senha(senha), nome, nivel, dept)
        )


def _seed_areas(c):
    areas = [
        ('AREA-01', 'Saguão Principal',    'Entrada geral das instalações',       'operador',    'normal', 'Térreo'),
        ('AREA-02', 'Escritórios Gerais',  'Área de trabalho dos funcionários',   'funcionario', 'normal', '1º Andar'),
        ('AREA-03', 'Laboratório P&D',     'Pesquisa e desenvolvimento avançado', 'gerente',     'normal', '3º Andar'),
        ('AREA-04', 'Servidor Central',    'Infraestrutura de TI crítica',        'admin',       'alerta', '2º Andar'),
        ('AREA-05', 'Cofre Corporativo',   'Ativos financeiros e documentos',     'admin',       'normal', 'Subsolo'),
        ('AREA-06', 'Hangar de Veículos',  'Garagem e veículos especiais',        'gerente',     'normal', 'Subsolo'),
        ('AREA-07', 'Centro de Segurança', 'Monitoramento e controle',            'gerente',     'normal', '2º Andar'),
        ('AREA-08', 'Telhado / Heliponto', 'Acesso aeronáutico restrito',         'admin',       'normal', 'Cobertura'),
        ('AREA-09', 'Batcaverna',          'Instalação ultrassecreta',            'admin',       'critico','Subsolo B2'),
    ]
    for cod, nome, desc, nivel, status, andar in areas:
        c.execute(
            'INSERT INTO areas (codigo, nome, descricao, nivel_acesso, status, andar) VALUES (?,?,?,?,?,?)',
            (cod, nome, desc, nivel, status, andar)
        )


def _seed_recursos(c):
    recursos = [
        ('REC-V01', 'Batmóvel Mk.VII',        'veiculo',     'blindado',       'disponivel', 'Hangar',       'Bruce Wayne'),
        ('REC-V02', 'Batwing',                'veiculo',     'aeronave',       'manutencao', 'Hangar',       'Bruce Wayne'),
        ('REC-V03', 'Batpod',                 'veiculo',     'moto',           'disponivel', 'Hangar',       'Dick Grayson'),
        ('REC-V04', 'Helicóptero WE-01',      'veiculo',     'aeronave',       'disponivel', 'Heliponto',    'Lucius Fox'),
        ('REC-E01', 'Batarangue (x48)',        'equipamento', 'armamento',      'disponivel', 'Arsenal',      'Bruce Wayne'),
        ('REC-E02', 'Gancho de Combate',       'equipamento', 'armamento',      'disponivel', 'Arsenal',      'Bruce Wayne'),
        ('REC-E03', 'Bat-Traçador GPS (x12)',  'equipamento', 'eletrônico',     'disponivel', 'Lab P&D',      'Lucius Fox'),
        ('REC-E04', 'Antídoto Coringa (x3)',   'equipamento', 'médico',         'critico',    'Lab P&D',      'Lucius Fox'),
        ('REC-E05', 'EMP Portátil',            'equipamento', 'eletrônico',     'disponivel', 'Arsenal',      'Bruce Wayne'),
        ('REC-E06', 'Traje Blindado Mk.X',     'equipamento', 'proteção',       'manutencao', 'Arsenal',      'Bruce Wayne'),
        ('REC-D01', 'Servidor Batcomputador',  'dispositivo', 'TI',             'operacional','Sala Servers', 'Alfred Pennyworth'),
        ('REC-D02', 'Central de Câmeras',      'dispositivo', 'segurança',      'operacional','Seg. Central', 'Agente Silva'),
        ('REC-D03', 'Sistema de Alarme',       'dispositivo', 'segurança',      'operacional','Seg. Central', 'Agente Silva'),
        ('REC-D04', 'Drones de Patrulha (x4)', 'dispositivo', 'vigilância',     'disponivel', 'Hangar',       'Barbara Gordon'),
        ('REC-D05', 'Gerador de Emergência',   'dispositivo', 'infraestrutura', 'standby',    'Subsolo',      'Alfred Pennyworth'),
    ]
    for cod, nome, tipo, subtipo, status, loc, resp in recursos:
        c.execute(
            'INSERT INTO recursos (codigo, nome, tipo, subtipo, status, localizacao, responsavel) VALUES (?,?,?,?,?,?,?)',
            (cod, nome, tipo, subtipo, status, loc, resp)
        )


def _seed_cameras(c):
    cameras = [
        ('CAM-01', 'Entrada Principal',  'AREA-01', 'Saguão - Portão A',  'online',  'https://picsum.photos/seed/cam01/640/360', 'operador'),
        ('CAM-02', 'Recepção',           'AREA-01', 'Saguão - Recepção',  'online',  'https://picsum.photos/seed/cam02/640/360', 'operador'),
        ('CAM-03', 'Corredor 1º Andar',  'AREA-02', 'Corredor Leste',     'online',  'https://picsum.photos/seed/cam03/640/360', 'funcionario'),
        ('CAM-04', 'Escritório P&D',     'AREA-03', 'Lab Principal',      'online',  'https://picsum.photos/seed/cam04/640/360', 'gerente'),
        ('CAM-05', 'Sala de Servidores', 'AREA-04', 'Rack Central',       'online',  'https://picsum.photos/seed/cam05/640/360', 'admin'),
        ('CAM-06', 'Cofre B1',           'AREA-05', 'Corredor Cofre',     'online',  'https://picsum.photos/seed/cam06/640/360', 'admin'),
        ('CAM-07', 'Hangar - Vista 1',   'AREA-06', 'Hangar Norte',       'online',  'https://picsum.photos/seed/cam07/640/360', 'gerente'),
        ('CAM-08', 'Hangar - Vista 2',   'AREA-06', 'Hangar Sul',         'online',  'https://picsum.photos/seed/cam08/640/360', 'gerente'),
        ('CAM-09', 'Centro Segurança',   'AREA-07', 'Sala de Controle',   'online',  'https://picsum.photos/seed/cam09/640/360', 'gerente'),
        ('CAM-10', 'Telhado',            'AREA-08', 'Heliponto',          'offline', 'https://picsum.photos/seed/cam10/640/360', 'admin'),
        ('CAM-11', 'Batcaverna E1',      'AREA-09', 'Entrada Batcaverna', 'online',  'https://picsum.photos/seed/cam11/640/360', 'admin'),
        ('CAM-12', 'Batcaverna Central', 'AREA-09', 'Centro Operações',   'online',  'https://picsum.photos/seed/cam12/640/360', 'admin'),
    ]
    for cod, nome, area, loc, status, feed, nivel in cameras:
        c.execute(
            'INSERT INTO cameras (codigo, nome, area_codigo, localizacao, status, feed_url, nivel_acesso) VALUES (?,?,?,?,?,?,?)',
            (cod, nome, area, loc, status, feed, nivel)
        )


# =============================================================================
# HELPERS
# =============================================================================

def hash_senha(senha: str) -> str:
    return hashlib.sha256(senha.encode()).hexdigest()


def verificar_credenciais(usuario_id: str, senha: str):
    conn = get_db()
    usuario = conn.execute(
        'SELECT * FROM usuarios WHERE usuario_id = ? AND ativo = 1', (usuario_id,)
    ).fetchone()
    conn.close()
    if usuario and usuario['senha_hash'] == hash_senha(senha):
        return usuario
    return None


def registrar_log(usuario_id, ip, sucesso, mensagem):
    conn = get_db()
    conn.execute(
        'INSERT INTO logs_acesso (usuario_id, ip, sucesso, mensagem) VALUES (?,?,?,?)',
        (usuario_id, ip, int(sucesso), mensagem)
    )
    conn.commit()
    conn.close()


def registrar_acesso_area(usuario_id, area_codigo, tipo, motivo=None):
    conn = get_db()
    conn.execute(
        'INSERT INTO controle_acesso (usuario_id, area_codigo, tipo, motivo) VALUES (?,?,?,?)',
        (usuario_id, area_codigo, tipo, motivo)
    )
    conn.commit()
    conn.close()


def nivel_usuario_pode_acessar(nivel_usuario, nivel_area):
    return NIVEL_HIERARQUIA.get(nivel_usuario, 0) >= NIVEL_HIERARQUIA.get(nivel_area, 99)


def dict_rows(rows):
    return [dict(r) for r in rows]


# =============================================================================
# ROTAS — PÁGINAS
# =============================================================================

@app.route('/')
def index():
    # ── Se já tiver sessão válida e não expirada, vai pro dashboard ──────────
    if 'usuario_id' in session:
        ultimo = session.get('ultimo_acesso')
        if ultimo:
            try:
                delta = datetime.utcnow() - datetime.fromisoformat(ultimo)
                if delta <= timedelta(hours=8):
                    return redirect(url_for('dashboard'))
            except Exception:
                pass
        # Sessão inválida ou expirada — limpa e mostra login
        session.clear()
    return render_template('login.html')


@app.route('/dashboard')
@login_required
def dashboard():
    return render_template('dashboard.html')


@app.route('/cameras')
@login_required
def cameras_page():
    return render_template('cameras.html')


@app.route('/cameras/editar')
@login_required
@nivel_required('gerente')
def cameras_editar():
    return render_template('edit_cameras.html')


@app.route('/recursos')
@login_required
@nivel_required('funcionario')
def recursos_page():
    return render_template('recursos.html')


@app.route('/recursos/editar')
@login_required
@nivel_required('gerente')
def recursos_editar():
    return render_template('edit_recursos.html')


@app.route('/areas')
@login_required
@nivel_required('funcionario')
def areas_page():
    return render_template('areas.html')


@app.route('/areas/editar')
@login_required
@nivel_required('gerente')
def areas_editar():
    return render_template('edit_areas.html')


@app.route('/usuarios')
@login_required
@nivel_required('admin')
def usuarios_page():
    return render_template('usuarios.html')


@app.route('/usuarios/editar')
@login_required
@nivel_required('admin')
def usuarios_editar():
    return render_template('edit_usuarios.html')


@app.route('/seguranca')
@login_required
def seguranca_page():
    return render_template('edit_seguranca.html')


# =============================================================================
# API — AUTENTICAÇÃO
# =============================================================================

@app.route('/api/login', methods=['POST'])
def api_login():
    # Bloqueia se já estiver logado
    if 'usuario_id' in session:
        return jsonify({"sucesso": False, "mensagem": "Já autenticado."}), 400

    dados = request.get_json()
    if not dados:
        return jsonify({"sucesso": False, "mensagem": "Nenhum dado recebido."}), 400

    usuario_id = dados.get('id', '').strip()
    senha      = dados.get('senha', '')
    ip         = request.remote_addr

    if not usuario_id or not senha:
        return jsonify({"sucesso": False, "mensagem": "Preencha todos os campos."}), 400

    usuario = verificar_credenciais(usuario_id, senha)

    if usuario:
        # Regenera a sessão para evitar session fixation
        session.clear()
        session.permanent = True  # Aplica PERMANENT_SESSION_LIFETIME
        session['usuario_id']    = usuario['usuario_id']
        session['nome']          = usuario['nome']
        session['nivel']         = usuario['nivel']
        session['departamento']  = usuario['departamento']
        session['ultimo_acesso'] = datetime.utcnow().isoformat()

        registrar_log(usuario_id, ip, True, "Acesso concedido.")
        registrar_acesso_area(usuario_id, 'AREA-01', 'entrada', 'Login no sistema')

        return jsonify({
            "sucesso":  True,
            "mensagem": "Acesso concedido. Bem-vindo à Batcaverna.",
            "usuario":  usuario['nome'],
            "nivel":    usuario['nivel'],
            "redirect": "/dashboard"
        }), 200
    else:
        registrar_log(usuario_id, ip, False, "Credenciais inválidas.")
        return jsonify({"sucesso": False, "mensagem": "Credenciais inválidas. Tente novamente."}), 401


@app.route('/api/logout', methods=['POST'])
def api_logout():
    uid = session.get('usuario_id')
    if uid:
        registrar_acesso_area(uid, 'AREA-01', 'saida', 'Logout do sistema')
        registrar_log(uid, request.remote_addr, True, 'Logout.')
    session.clear()
    return jsonify({"sucesso": True, "redirect": "/"}), 200


@app.route('/api/sessao')
@login_required
def api_sessao():
    return jsonify({
        "usuario_id":   session.get('usuario_id'),
        "nome":         session.get('nome'),
        "nivel":        session.get('nivel'),
        "departamento": session.get('departamento'),
    })


@app.route('/api/auth/alterar-senha', methods=['POST'])
@login_required
def api_alterar_senha():
    d = request.get_json()
    senha_atual = d.get('senha_atual', '')
    nova_senha  = d.get('nova_senha', '')

    if not senha_atual or not nova_senha:
        return jsonify({"erro": "Preencha todos os campos."}), 400
    if len(nova_senha) < 8:
        return jsonify({"erro": "A nova senha deve ter ao menos 8 caracteres."}), 400

    uid = session.get('usuario_id')
    usuario = verificar_credenciais(uid, senha_atual)
    if not usuario:
        return jsonify({"erro": "Senha atual incorreta."}), 401

    conn = get_db()
    conn.execute(
        'UPDATE usuarios SET senha_hash = ? WHERE usuario_id = ?',
        (hash_senha(nova_senha), uid)
    )
    conn.commit()
    conn.close()
    registrar_log(uid, request.remote_addr, True, 'Senha alterada.')
    return jsonify({"sucesso": True})


# =============================================================================
# API — USUÁRIOS
# =============================================================================

@app.route('/api/usuarios', methods=['GET'])
@nivel_required('admin')
def api_usuarios_listar():
    conn = get_db()
    rows = conn.execute(
        'SELECT id, usuario_id as id, nome, nivel, departamento, ativo, criado_em FROM usuarios ORDER BY nivel DESC, nome'
    ).fetchall()
    conn.close()
    return jsonify(dict_rows(rows))


@app.route('/api/usuarios/<usuario_id>', methods=['GET'])
@nivel_required('admin')
def api_usuario_detalhe(usuario_id):
    conn = get_db()
    row = conn.execute(
        'SELECT id, usuario_id as id, nome, nivel, departamento, ativo, criado_em FROM usuarios WHERE usuario_id = ?',
        (usuario_id,)
    ).fetchone()
    conn.close()
    if not row:
        return jsonify({"erro": "Usuário não encontrado."}), 404
    return jsonify(dict(row))


@app.route('/api/usuarios', methods=['POST'])
@nivel_required('admin')
def api_usuarios_criar():
    d = request.get_json()
    if not all(d.get(c) for c in ['id', 'senha', 'nome', 'nivel', 'departamento']):
        return jsonify({"erro": "Todos os campos são obrigatórios."}), 400
    if d['nivel'] not in NIVEL_HIERARQUIA:
        return jsonify({"erro": "Nível inválido."}), 400
    try:
        conn = get_db()
        conn.execute(
            'INSERT INTO usuarios (usuario_id, senha_hash, nome, nivel, departamento) VALUES (?,?,?,?,?)',
            (d['id'], hash_senha(d['senha']), d['nome'], d['nivel'], d['departamento'])
        )
        conn.commit()
        conn.close()
        return jsonify({"sucesso": True, "mensagem": "Usuário criado."}), 201
    except sqlite3.IntegrityError:
        return jsonify({"erro": "ID de usuário já existe."}), 409


@app.route('/api/usuarios/<usuario_id>', methods=['PUT'])
@nivel_required('admin')
def api_usuarios_atualizar(usuario_id):
    d = request.get_json()
    conn = get_db()
    campos, valores = [], []
    for campo in ['nome', 'nivel', 'departamento', 'ativo']:
        if campo in d:
            campos.append(f'{campo} = ?')
            valores.append(d[campo])
    if d.get('senha'):
        campos.append('senha_hash = ?')
        valores.append(hash_senha(d['senha']))
    if not campos:
        return jsonify({"erro": "Nenhum campo para atualizar."}), 400
    valores.append(usuario_id)
    conn.execute(f'UPDATE usuarios SET {", ".join(campos)} WHERE usuario_id = ?', valores)
    conn.commit()
    conn.close()
    return jsonify({"sucesso": True})


@app.route('/api/usuarios/<usuario_id>', methods=['DELETE'])
@nivel_required('admin')
def api_usuarios_desativar(usuario_id):
    if usuario_id == session.get('usuario_id'):
        return jsonify({"erro": "Não é possível desativar a própria conta."}), 400
    conn = get_db()
    conn.execute('DELETE FROM usuarios WHERE usuario_id = ?', (usuario_id,))
    conn.commit()
    conn.close()
    return jsonify({"sucesso": True})


# =============================================================================
# API — ÁREAS
# =============================================================================

@app.route('/api/areas', methods=['GET'])
@login_required
def api_areas_listar():
    conn = get_db()
    rows = conn.execute('SELECT * FROM areas ORDER BY andar, nome').fetchall()
    conn.close()
    nivel_usuario = session.get('nivel', 'operador')
    resultado = []
    for r in rows:
        d = dict(r)
        d['tem_acesso'] = nivel_usuario_pode_acessar(nivel_usuario, r['nivel_acesso'])
        resultado.append(d)
    return jsonify(resultado)


@app.route('/api/areas/<codigo>', methods=['GET'])
@login_required
def api_area_detalhe(codigo):
    conn = get_db()
    row = conn.execute('SELECT * FROM areas WHERE codigo = ?', (codigo,)).fetchone()
    conn.close()
    if not row:
        return jsonify({"erro": "Área não encontrada."}), 404
    d = dict(row)
    d['tem_acesso'] = nivel_usuario_pode_acessar(session.get('nivel', 'operador'), row['nivel_acesso'])
    return jsonify(d)


@app.route('/api/areas/<codigo>/acessar', methods=['POST'])
@login_required
def api_area_acessar(codigo):
    conn = get_db()
    area = conn.execute('SELECT * FROM areas WHERE codigo = ?', (codigo,)).fetchone()
    conn.close()
    if not area:
        return jsonify({"erro": "Área não encontrada."}), 404

    uid           = session.get('usuario_id')
    nivel_usuario = session.get('nivel', 'operador')

    if nivel_usuario_pode_acessar(nivel_usuario, area['nivel_acesso']):
        registrar_acesso_area(uid, codigo, 'entrada', 'Acesso físico autorizado')
        return jsonify({"sucesso": True, "mensagem": f"Acesso autorizado — {area['nome']}", "area": dict(area)})
    else:
        registrar_acesso_area(uid, codigo, 'negado', 'Nível de acesso insuficiente')
        return jsonify({"sucesso": False, "mensagem": f"Acesso negado — nível '{area['nivel_acesso']}' exigido."}), 403


@app.route('/api/areas', methods=['POST'])
@nivel_required('admin')
def api_areas_criar():
    d = request.get_json()
    if not all(d.get(c) for c in ['codigo', 'nome', 'nivel_acesso', 'andar']):
        return jsonify({"erro": "Campos obrigatórios: codigo, nome, nivel_acesso, andar."}), 400
    try:
        conn = get_db()
        conn.execute(
            'INSERT INTO areas (codigo, nome, descricao, nivel_acesso, status, andar) VALUES (?,?,?,?,?,?)',
            (d['codigo'], d['nome'], d.get('descricao', ''), d['nivel_acesso'], d.get('status', 'normal'), d['andar'])
        )
        conn.commit()
        conn.close()
        return jsonify({"sucesso": True}), 201
    except sqlite3.IntegrityError:
        return jsonify({"erro": "Código de área já existe."}), 409


@app.route('/api/areas/<codigo>', methods=['PUT'])
@nivel_required('gerente')
def api_areas_atualizar(codigo):
    d = request.get_json()
    conn = get_db()
    campos, valores = [], []
    for campo in ['nome', 'descricao', 'nivel_acesso', 'status', 'andar']:
        if campo in d:
            campos.append(f'{campo} = ?')
            valores.append(d[campo])
    if not campos:
        return jsonify({"erro": "Nenhum campo para atualizar."}), 400
    valores.append(codigo)
    conn.execute(f'UPDATE areas SET {", ".join(campos)} WHERE codigo = ?', valores)
    conn.commit()
    conn.close()
    return jsonify({"sucesso": True})


@app.route('/api/areas/<codigo>', methods=['DELETE'])
@nivel_required('admin')
def api_areas_deletar(codigo):
    conn = get_db()
    conn.execute('DELETE FROM areas WHERE codigo = ?', (codigo,))
    conn.commit()
    conn.close()
    return jsonify({"sucesso": True})


# =============================================================================
# API — RECURSOS
# =============================================================================

@app.route('/api/recursos', methods=['GET'])
@login_required
def api_recursos_listar():
    tipo = request.args.get('tipo')
    conn = get_db()
    if tipo:
        rows = conn.execute('SELECT * FROM recursos WHERE tipo = ? ORDER BY nome', (tipo,)).fetchall()
    else:
        rows = conn.execute('SELECT * FROM recursos ORDER BY tipo, nome').fetchall()
    conn.close()
    return jsonify(dict_rows(rows))


@app.route('/api/recursos/<codigo>', methods=['GET'])
@login_required
def api_recurso_detalhe(codigo):
    conn = get_db()
    row = conn.execute('SELECT * FROM recursos WHERE codigo = ?', (codigo,)).fetchone()
    conn.close()
    if not row:
        return jsonify({"erro": "Recurso não encontrado."}), 404
    return jsonify(dict(row))


@app.route('/api/recursos', methods=['POST'])
@nivel_required('gerente')
def api_recursos_criar():
    d = request.get_json()
    if not all(d.get(c) for c in ['codigo', 'nome', 'tipo']):
        return jsonify({"erro": "Campos obrigatórios: codigo, nome, tipo."}), 400
    try:
        conn = get_db()
        conn.execute(
            'INSERT INTO recursos (codigo, nome, tipo, subtipo, status, localizacao, responsavel, descricao) VALUES (?,?,?,?,?,?,?,?)',
            (d['codigo'], d['nome'], d['tipo'], d.get('subtipo', ''), d.get('status', 'disponivel'),
             d.get('localizacao', ''), d.get('responsavel', ''), d.get('descricao', ''))
        )
        conn.commit()
        conn.close()
        return jsonify({"sucesso": True}), 201
    except sqlite3.IntegrityError:
        return jsonify({"erro": "Código de recurso já existe."}), 409


@app.route('/api/recursos/<codigo>', methods=['PUT'])
@nivel_required('gerente')
def api_recursos_atualizar(codigo):
    d = request.get_json()
    conn = get_db()
    campos, valores = [], []
    for campo in ['nome', 'tipo', 'subtipo', 'status', 'localizacao', 'responsavel', 'descricao']:
        if campo in d:
            campos.append(f'{campo} = ?')
            valores.append(d[campo])
    if not campos:
        return jsonify({"erro": "Nenhum campo para atualizar."}), 400
    campos.append('atualizado_em = ?')
    valores.append(datetime.now().isoformat())
    valores.append(codigo)
    conn.execute(f'UPDATE recursos SET {", ".join(campos)} WHERE codigo = ?', valores)
    conn.commit()
    conn.close()
    return jsonify({"sucesso": True})


@app.route('/api/recursos/<codigo>', methods=['DELETE'])
@nivel_required('admin')
def api_recursos_deletar(codigo):
    conn = get_db()
    conn.execute('DELETE FROM recursos WHERE codigo = ?', (codigo,))
    conn.commit()
    conn.close()
    return jsonify({"sucesso": True})


# =============================================================================
# API — CÂMERAS
# =============================================================================

@app.route('/api/cameras', methods=['GET'])
@login_required
def api_cameras_listar():
    nivel_usuario = session.get('nivel', 'operador')
    area = request.args.get('area')
    conn = get_db()
    if area:
        rows = conn.execute('SELECT * FROM cameras WHERE area_codigo = ? ORDER BY codigo', (area,)).fetchall()
    else:
        rows = conn.execute('SELECT * FROM cameras ORDER BY codigo').fetchall()
    conn.close()
    resultado = []
    for r in rows:
        d = dict(r)
        d['tem_acesso'] = nivel_usuario_pode_acessar(nivel_usuario, r['nivel_acesso'])
        resultado.append(d)
    return jsonify(resultado)


@app.route('/api/cameras/<codigo>', methods=['GET'])
@login_required
def api_camera_detalhe(codigo):
    conn = get_db()
    cam = conn.execute('SELECT * FROM cameras WHERE codigo = ?', (codigo,)).fetchone()
    conn.close()
    if not cam:
        return jsonify({"erro": "Câmera não encontrada."}), 404
    if not nivel_usuario_pode_acessar(session.get('nivel', 'operador'), cam['nivel_acesso']):
        return jsonify({"erro": "Acesso negado a esta câmera."}), 403
    return jsonify(dict(cam))


@app.route('/api/cameras', methods=['POST'])
@nivel_required('gerente')
def api_cameras_criar():
    d = request.get_json()
    if not all(d.get(c) for c in ['codigo', 'nome', 'localizacao']):
        return jsonify({"erro": "Campos obrigatórios: codigo, nome, localizacao."}), 400
    try:
        conn = get_db()
        conn.execute(
            'INSERT INTO cameras (codigo, nome, area_codigo, localizacao, status, feed_url, nivel_acesso) VALUES (?,?,?,?,?,?,?)',
            (d['codigo'], d['nome'], d.get('area_codigo'), d['localizacao'],
             d.get('status', 'offline'), d.get('feed_url'), d.get('nivel_acesso', 'operador'))
        )
        conn.commit()
        conn.close()
        return jsonify({"sucesso": True}), 201
    except sqlite3.IntegrityError:
        return jsonify({"erro": "Código de câmera já existe."}), 409


@app.route('/api/cameras/<codigo>', methods=['PUT'])
@nivel_required('gerente')
def api_cameras_atualizar(codigo):
    d = request.get_json()
    conn = get_db()
    campos, valores = [], []
    for campo in ['nome', 'area_codigo', 'localizacao', 'feed_url', 'nivel_acesso']:
        if campo in d:
            campos.append(f'{campo} = ?')
            valores.append(d[campo])
    if not campos:
        return jsonify({"erro": "Nenhum campo para atualizar."}), 400
    valores.append(codigo)
    conn.execute(f'UPDATE cameras SET {", ".join(campos)} WHERE codigo = ?', valores)
    conn.commit()
    conn.close()
    return jsonify({"sucesso": True})


@app.route('/api/cameras/<codigo>/status', methods=['PUT'])
@nivel_required('gerente')
def api_camera_status(codigo):
    d = request.get_json()
    status = d.get('status')
    if status not in ['online', 'offline', 'manutencao']:
        return jsonify({"erro": "Status inválido."}), 400
    conn = get_db()
    conn.execute('UPDATE cameras SET status = ? WHERE codigo = ?', (status, codigo))
    conn.commit()
    conn.close()
    return jsonify({"sucesso": True})


@app.route('/api/cameras/<codigo>', methods=['DELETE'])
@nivel_required('admin')
def api_cameras_deletar(codigo):
    conn = get_db()
    conn.execute('DELETE FROM cameras WHERE codigo = ?', (codigo,))
    conn.commit()
    conn.close()
    return jsonify({"sucesso": True})


# =============================================================================
# API — ALERTAS
# =============================================================================

@app.route('/api/alertas', methods=['GET'])
@login_required
def api_alertas_listar():
    conn = get_db()
    rows = conn.execute('SELECT * FROM alertas ORDER BY criado_em DESC LIMIT 50').fetchall()
    conn.close()
    return jsonify(dict_rows(rows))


@app.route('/api/alertas', methods=['POST'])
@nivel_required('funcionario')
def api_alertas_criar():
    d = request.get_json()
    if not all(d.get(c) for c in ['tipo', 'titulo']):
        return jsonify({"erro": "Campos obrigatórios: tipo, titulo."}), 400
    conn = get_db()
    conn.execute(
        'INSERT INTO alertas (tipo, titulo, descricao, area_codigo, nivel, criado_por) VALUES (?,?,?,?,?,?)',
        (d['tipo'], d['titulo'], d.get('descricao', ''), d.get('area_codigo'),
         d.get('nivel', 'baixo'), session.get('usuario_id'))
    )
    conn.commit()
    conn.close()
    return jsonify({"sucesso": True}), 201


@app.route('/api/alertas/<int:alerta_id>/resolver', methods=['PUT'])
@nivel_required('gerente')
def api_alertas_resolver(alerta_id):
    conn = get_db()
    conn.execute('UPDATE alertas SET resolvido = 1 WHERE id = ?', (alerta_id,))
    conn.commit()
    conn.close()
    return jsonify({"sucesso": True})


# =============================================================================
# API — LOGS
# =============================================================================

@app.route('/api/logs/acesso', methods=['GET'])
@nivel_required('gerente')
def api_logs_acesso():
    limit    = request.args.get('limit', 100, type=int)
    usuario  = request.args.get('usuario')
    conn     = get_db()
    if usuario:
        rows = conn.execute(
            'SELECT * FROM logs_acesso WHERE usuario_id = ? ORDER BY criado_em DESC LIMIT ?', (usuario, limit)
        ).fetchall()
    else:
        rows = conn.execute(
            'SELECT * FROM logs_acesso ORDER BY criado_em DESC LIMIT ?', (limit,)
        ).fetchall()
    conn.close()
    return jsonify(dict_rows(rows))


@app.route('/api/logs/areas', methods=['GET'])
@nivel_required('gerente')
def api_logs_areas():
    limit   = request.args.get('limit', 100, type=int)
    area    = request.args.get('area')
    usuario = request.args.get('usuario')
    conn    = get_db()
    if area:
        rows = conn.execute(
            'SELECT * FROM controle_acesso WHERE area_codigo = ? ORDER BY criado_em DESC LIMIT ?', (area, limit)
        ).fetchall()
    elif usuario:
        rows = conn.execute(
            'SELECT * FROM controle_acesso WHERE usuario_id = ? ORDER BY criado_em DESC LIMIT ?', (usuario, limit)
        ).fetchall()
    else:
        rows = conn.execute(
            'SELECT * FROM controle_acesso ORDER BY criado_em DESC LIMIT ?', (limit,)
        ).fetchall()
    conn.close()
    return jsonify(dict_rows(rows))


# =============================================================================
# API — DASHBOARD RESUMO
# =============================================================================

@app.route('/api/dashboard/resumo')
@login_required
def api_dashboard_resumo():
    conn = get_db()
    metricas = {
        "usuarios_ativos":   conn.execute('SELECT COUNT(*) FROM usuarios WHERE ativo = 1').fetchone()[0],
        "total_recursos":    conn.execute('SELECT COUNT(*) FROM recursos').fetchone()[0],
        "total_areas":       conn.execute('SELECT COUNT(*) FROM areas').fetchone()[0],
        "cameras_online":    conn.execute("SELECT COUNT(*) FROM cameras WHERE status = 'online'").fetchone()[0],
        "total_cameras":     conn.execute('SELECT COUNT(*) FROM cameras').fetchone()[0],
        "alertas_ativos":    conn.execute('SELECT COUNT(*) FROM alertas WHERE resolvido = 0').fetchone()[0],
        "acessos_negados":   conn.execute("SELECT COUNT(*) FROM controle_acesso WHERE tipo = 'negado'").fetchone()[0],
        "recursos_criticos": conn.execute("SELECT COUNT(*) FROM recursos WHERE status IN ('critico','manutencao')").fetchone()[0],
    }

    alertas  = conn.execute('SELECT * FROM alertas WHERE resolvido = 0 ORDER BY criado_em DESC LIMIT 5').fetchall()
    acessos  = conn.execute('SELECT * FROM controle_acesso ORDER BY criado_em DESC LIMIT 10').fetchall()
    recursos = conn.execute("SELECT * FROM recursos WHERE status IN ('critico','manutencao') ORDER BY nome LIMIT 8").fetchall()
    frota    = conn.execute("SELECT * FROM recursos WHERE tipo = 'veiculo' ORDER BY nome").fetchall()

    # Atividade por hora (últimas 24h) — agrupa logs por hora
    atividade_raw = conn.execute('''
        SELECT strftime('%H', criado_em) as hora, COUNT(*) as total
        FROM logs_acesso
        WHERE criado_em >= datetime('now', '-1 day')
        GROUP BY hora ORDER BY hora
    ''').fetchall()
    atividade = [{"hora": int(r['hora']), "total": r['total']} for r in atividade_raw]

    conn.close()

    return jsonify({
        "metricas":    metricas,
        "acessos":     dict_rows(acessos),
        "alertas":     dict_rows(alertas),
        "inventario":  dict_rows(recursos),
        "frota":       dict_rows(frota),
        "atividade":   atividade,
    })


# =============================================================================
# INICIALIZAÇÃO
# =============================================================================

if __name__ == '__main__':
    init_db()
    app.run(debug=True, port=5000)