const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Sequelize, DataTypes } = require('sequelize');
const multer = require('multer'); // Adiciona o multer
const path = require('path');
const fs = require('fs');

const app = express();
const port = 3001;

const uploadDir = 'uploads/';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

app.use(cors({
  origin: 'http://127.0.0.1:5501/index.html', // Substitua pela URL do seu frontend
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Adicione este middleware para logar todas as requisições
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

// Configura o armazenamento para as imagens
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/'); // Diretório onde as imagens serão salvas
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname)); // Nome único para cada arquivo
  }
});

const upload = multer({ storage: storage }); // Inicializa o multer

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
    type: DataTypes.STRING, // Campo para armazenar o caminho da imagem
    allowNull: true
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

// Rota raiz
app.get('/', (req, res) => {
  res.send('Bem-vindo à API de Cadastro de Produtos');
});

// Rota para cadastrar produtos com upload de imagem
app.post('/api/produtos', upload.single('imagem'), async (req, res) => {
  console.log('Requisição recebida para cadastrar produto');
  console.log('Corpo da requisição:', req.body);
  console.log('Arquivo:', req.file);

  try {
    const { descricao, marca, valor, quantidade } = req.body;
    const imagem = req.file ? req.file.path : null;

    if (!descricao || !marca || !valor || !quantidade) {
      throw new Error('Todos os campos são obrigatórios');
    }

    console.log('Criando produto no banco de dados');
    const produto = await Produto.create({
      descricao,
      marca,
      valor: parseFloat(valor),
      quantidade: parseInt(quantidade),
      imagem
    });

    console.log('Produto criado:', produto.toJSON());
    res.status(201).json(produto);
  } catch (error) {
    console.error('Erro ao criar produto:', error);
    res.status(400).json({ error: error.message, stack: error.stack });
  }
});

// Rota para listar produtos
app.get('/api/produtos', async (req, res) => {
  try {
    const produtos = await Produto.findAll();
    res.json(produtos);
  } catch (error) {
    console.error('Erro ao buscar produtos:', error);
    res.status(500).json({ error: error.message });
  }
});

// Rota para excluir um produto
app.delete('/api/produtos/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const resultado = await Produto.destroy({ where: { id: id } });
    if (resultado === 0) {
      res.status(404).json({ mensagem: 'Produto não encontrado' });
    } else {
      res.status(200).json({ mensagem: 'Produto excluído com sucesso' });
    }
  } catch (error) {
    console.error('Erro ao excluir produto:', error);
    res.status(500).json({ error: error.message });
  }
});

// Rota para atualizar um produto
app.put('/api/produtos/:id', upload.single('imagem'), async (req, res) => {
  try {
    const id = req.params.id;
    const { descricao, marca, valor, quantidade } = req.body;
    const imagem = req.file ? req.file.path : null;

    const produto = await Produto.findByPk(id);
    if (!produto) {
      return res.status(404).json({ mensagem: 'Produto não encontrado' });
    }

    await produto.update({
      descricao,
      marca,
      valor: parseFloat(valor),
      quantidade: parseInt(quantidade),
      imagem: imagem || produto.imagem
    });

    res.status(200).json(produto);
  } catch (error) {
    console.error('Erro ao atualizar produto:', error);
    res.status(500).json({ error: error.message });
  }
});

// Tratamento de erros global
app.use((err, req, res, next) => {
  console.error('Erro não tratado:', err);
  res.status(500).json({ error: 'Erro interno do servidor' });
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
