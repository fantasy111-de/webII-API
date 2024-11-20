const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Sequelize, DataTypes } = require('sequelize');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const expressSession = require('express-session');
const bcrypt = require('bcryptjs');

const app = express();
const port = 3005;

// Configuração do diretório de upload
const uploadDir = 'uploads/';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

app.use(cors({
  origin: ['http://127.0.0.1:5501', 'http://localhost:5501'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Configuração de sessão
app.use(expressSession({
  secret: 'minhaChaveSecreta', // Alterar para algo mais seguro em produção
  resave: false,
  saveUninitialized: true,
}));

// Middleware para logar todas as requisições
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

// Configura o armazenamento para as imagens
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

// Configuração do Sequelize com PostgreSQL
const sequelize = new Sequelize('cesta_cheia', 'postgres', 'vivi', {
  host: 'localhost',
  dialect: 'postgres',
  port: 5432,
  logging: console.log
});

// Definição do modelo Produto
const Produto = sequelize.define('Produto', {
  descricao: {
    type: DataTypes.STRING,
    allowNull: false
  },
  marca: {
    type: DataTypes.STRING,
    allowNull: false
  },
  valor: {
    type: DataTypes.FLOAT,
    allowNull: false
  },
  quantidade: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  imagem: {
    type: DataTypes.STRING,
    allowNull: true
  }
});

// Definição do modelo Usuário para autenticação
const Usuario = sequelize.define('Usuario', {
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  senha: {
    type: DataTypes.STRING,
    allowNull: false
  }
});

// Sincroniza o modelo com o banco de dados
sequelize.sync({ force: true })
  .then(() => {
    console.log('Banco de dados sincronizado');
  })
  .catch(err => {
    console.error('Erro ao sincronizar o banco de dados:', err);
  });

// Middleware para verificar se o usuário está autenticado
function isAuthenticated(req, res, next) {
  if (req.session.usuario) {
    return next();
  } else {
    res.redirect('/login');
  }
}

// Rota de login
app.get('/login.html', (req, res) => {
  res.send(`
    <form action="/login" method="POST">
      <label for="email">E-mail:</label><br>
      <input type="email" name="email" required><br>
      <label for="senha">Senha:</label><br>
      <input type="password" name="senha" required><br>
      <button type="submit">Entrar</button>
    </form>
    <p>Não tem uma conta? <a href="/registro">Cadastre-se aqui</a></p>
  `);
});

app.post('/login.html', async (req, res) => {
  const { email, senha } = req.body;
  try {
    const usuario = await Usuario.findOne({ where: { email } });
    if (usuario && bcrypt.compareSync(senha, usuario.senha)) {
      req.session.usuario = usuario; // Armazena usuário na sessão
      res.redirect('/cadastro'); // Redireciona para a página de cadastro
    } else {
      res.status(401).send('Credenciais inválidas');
    }
  } catch (error) {
    res.status(500).send('Erro ao autenticar');
  }
});

// Rota de cadastro de novo usuário
app.get('/registro.html', (req, res) => {
  res.send(`
    <form action="/registro" method="POST">
      <label for="email">E-mail:</label><br>
      <input type="email" name="email" required><br>
      <label for="senha">Senha:</label><br>
      <input type="password" name="senha" required><br>
      <label for="confirmarSenha">Confirmar Senha:</label><br>
      <input type="password" name="confirmarSenha" required><br>
      <button type="submit">Cadastrar</button>
    </form>
    <p>Já tem uma conta? <a href="/login">Faça login aqui</a></p>
  `);
});

app.post('/registro.html', async (req, res) => {
  const { email, senha, confirmarSenha } = req.body;
  if (senha !== confirmarSenha) {
    return res.status(400).send('As senhas não coincidem');
  }

  try {
    const hashedPassword = bcrypt.hashSync(senha, 10);
    const usuario = await Usuario.create({
      email,
      senha: hashedPassword
    });
    res.redirect('/login.html');
  } catch (error) {
    res.status(500).send('Erro ao criar usuário');
  }
});

// Rota de cadastro de produtos (apenas autenticado)
app.get('/index.html', isAuthenticated, (req, res) => {
  res.send(`
    <form action="/api/produtos" method="POST" enctype="multipart/form-data">
      <label for="descricao">Descrição:</label><br>
      <input type="text" name="descricao" required><br>
      <label for="marca">Marca:</label><br>
      <input type="text" name="marca" required><br>
      <label for="valor">Valor:</label><br>
      <input type="number" step="0.01" name="valor" required><br>
      <label for="quantidade">Quantidade:</label><br>
      <input type="number" name="quantidade" required><br>
      <label for="imagem">Imagem:</label><br>
      <input type="file" name="imagem"><br>
      <button type="submit">Cadastrar Produto</button>
    </form>
  `);
});

// Rota para cadastrar produtos com upload de imagem
app.post('/api/produtos', upload.single('imagem'), async (req, res) => {
  try {
    const { descricao, marca, valor, quantidade } = req.body;
    const imagem = req.file ? req.file.path : null;

    if (!descricao || !marca || !valor || !quantidade) {
      throw new Error('Todos os campos são obrigatórios');
    }

    const produto = await Produto.create({
      descricao,
      marca,
      valor: parseFloat(valor),
      quantidade: parseInt(quantidade),
      imagem
    });

    res.status(201).json(produto);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Rota para listar produtos (apenas acessível se autenticado)
app.get('/api/produtos', isAuthenticated, async (req, res) => {
  try {
    const produtos = await Produto.findAll();
    res.json(produtos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Inicia o servidor
const startServer = async () => {
  try {
    await sequelize.authenticate();
    console.log('Conexão com o banco de dados estabelecida com sucesso.');
    
    app.listen(port, () => {
      console.log(`Servidor rodando em http://localhost:${port}`);
    });
  } catch (error) {
    console.error('Não foi possível iniciar o servidor:', error);
  }
};

startServer();
