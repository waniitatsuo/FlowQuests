// 1. Importar os pacotes necessários
const express = require('express');
const axios = require('axios');
const path = require('path');
const bodyParser = require('body-parser');

// 2. Inicializar a aplicação Express
const app = express();
const port = 3000;

// 3. Configurar o middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Define a pasta raiz do projeto para servir ficheiros estáticos (CSS, imagens)
app.use(express.static(__dirname));

// Configura o Express para encontrar e renderizar os ficheiros .ejs na pasta 'views'
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// 4. Definir a URL da nossa API Spring Boot
const apiUrl = 'http://localhost:8080/api';

// --- ROTAS PARA SERVIR AS PÁGINAS (VIEWS) ---

app.get('/', (req, res) => {
    res.render('index', { message: req.query.message });
});

app.get('/cadastrar', (req, res) => {
    res.render('cadastrar');
});

app.get('/esqueci-senha', (req, res) => {
    res.render('esqueci-senha');
});


// Em app.js

app.get('/dashboard', async (req, res) => {
    const { userId } = req.query;
    if (!userId) {
        return res.redirect('/?message=login_required');
    }

    // Pega os parâmetros da URL, com valores padrão se não existirem
    const search = req.query.search || '';
    const pendingPage = req.query.pending_page || 0;
    const completedPage = req.query.completed_page || 0;
    const tarefasApiUrl = 'http://localhost:8080/api/tarefas'; // URL da API de tarefas

    try {
        const [usuarioResponse, pendingTasksResponse, completedTasksResponse, conquistasResponse] = await Promise.all([
            axios.get(`${apiUrl}/usuarios/${userId}`),
            // Busca a página de tarefas pendentes
            axios.get(`${tarefasApiUrl}/usuario/${userId}?estado=pendente&search=${search}&page=${pendingPage}&size=5`),
            // Busca a página de tarefas concluídas
            axios.get(`${tarefasApiUrl}/usuario/${userId}?estado=concluida&search=${search}&page=${completedPage}&size=5`),
            axios.get(`${apiUrl}/conquistas`)
        ]);

        res.render('dashboard', {
            usuario: usuarioResponse.data,
            // Agora passamos o objeto de página inteiro para o EJS
            tarefasPendentes: pendingTasksResponse.data,
            tarefasConcluidas: completedTasksResponse.data,
            todasAsConquistas: conquistasResponse.data,
            // Passamos os parâmetros de volta para a view, para manter o estado
            search: search,
            pendingPage: pendingTasksResponse.data,
            completedPage: completedTasksResponse.data
        });
    } catch (error) {
        console.error('Erro ao buscar dados para o dashboard:', error.message);
        res.render('dashboard', {
            usuario: { nome: 'Erro', xpTotal: 0, id: 0, conquistas: [] },
            tarefasPendentes: { content: [], number: 0, totalPages: 0 },
            tarefasConcluidas: { content: [], number: 0, totalPages: 0 },
            todasAsConquistas: [],
            search: '',
            pendingPage: { content: [], number: 0, totalPages: 0 },
            completedPage: { content: [], number: 0, totalPages: 0 }
        });
    }
});

// --- ROTAS PARA PROCESSAR FORMULÁRIOS (AÇÕES) ---

app.post('/login', async (req, res) => {
    const { email, senha } = req.body;
    try {
        const response = await axios.post(`${apiUrl}/usuarios/login`, { email, senha });
        const usuario = response.data;
        res.redirect(`/dashboard?userId=${usuario.id}`);
    } catch (error) {
        console.error("Falha no login:", error.response ? error.response.status : error.message);
        res.redirect('/?message=login_failed');
    }
});

app.post('/cadastrar', async (req, res) => {
    try {
        const { nome, email, senha } = req.body;
        await axios.post(`${apiUrl}/usuarios`, { nome, email, senha });
        res.redirect('/?message=success');
    } catch (error) {
        console.error('Erro ao cadastrar usuário:', error.message);
        res.status(500).send('Erro ao cadastrar usuário.');
    }
});

app.post('/esqueci-senha', (req, res) => {
    res.redirect('/?message=recovery');
});

// --- ROTAS DA API (PONTE PARA O FRONT-END) ---

app.post('/api/tarefas', async (req, res) => {
    try {
        const response = await axios.post(`${apiUrl}/tarefas`, req.body);
        res.status(201).json(response.data);
    } catch (error) {
        console.error('Erro no Node.js ao criar tarefa:', error.message);
        res.status(500).json({ message: 'Erro ao criar tarefa' });
    }
});

// --- NOVA ROTA PARA COMPLETAR TAREFA ---
app.post('/api/tarefas/:id/completar', async (req, res) => {
    try {
        const response = await axios.post(`${apiUrl}/tarefas/${req.params.id}/completar`);
        res.status(200).json(response.data);
    } catch (error) {
        const message = error.response?.data?.message || error.message;
        res.status(error.response?.status || 500).json({ message });
    }
});


app.delete('/api/tarefas/:id', async (req, res) => {
    try {
        await axios.delete(`${apiUrl}/tarefas/${req.params.id}`);
        res.status(204).send();
    } catch (error) {
        console.error('Erro no Node.js ao deletar tarefa:', error.message);
        res.status(500).json({ message: 'Erro ao deletar tarefa' });
    }
});

// 6. Iniciar o servidor
app.listen(port, () => {
    console.log(`Servidor Node.js a rodar em http://localhost:${port}`);
});
