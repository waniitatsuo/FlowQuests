// 1. Importa os pacotes necessários
const express = require('express');
const axios = require('axios');
const path = require('path');
const bodyParser = require('body-parser');

// 2. Inicializa a aplicação Express
const app = express();
const port = 3000;

// 3. Configura o middleware
// Lê dados de formulários enviados no formato x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: true }));
// Lê dados enviados no formato JSON
app.use(bodyParser.json());

// Define a pasta raiz do projeto para servir ficheiros estáticos (CSS, imagens)
app.use(express.static(__dirname));

// Configura o Express para encontrar e renderizar os ficheiros .ejs na pasta 'views'
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// 4. Define a URL da nossa API Spring Boot
const apiUrl = 'http://localhost:8080/api';


// --- ROTAS PARA SERVIR AS PÁGINAS (VIEWS) ---

// Rota principal que exibe a página de login
app.get('/', (req, res) => {
    res.render('index', { message: req.query.message });
});

// Rota para exibir a página de cadastro
app.get('/cadastrar', (req, res) => {
    res.render('cadastrar');
});

// Rota para exibir a página de "esqueci a senha"
app.get('/esqueci-senha', (req, res) => {
    res.render('esqueci-senha');
});

// Rota principal do Dashboard
app.get('/dashboard', async (req, res) => {
    const { userId } = req.query;
    if (!userId) {
        // Se não tiver userId, redireciona para o login
        return res.redirect('/?message=login_required');
    }

    // Pega os parâmetros da URL, com valores padrão se não existirem
    const search = req.query.search || '';
    const pendingPage = req.query.pending_page || 0;
    const completedPage = req.query.completed_page || 0;
    const tarefasApiUrl = 'http://localhost:8080/api/tarefas'; // URL da API de tarefas

    try {
        // Faz várias requisições para a API Spring em paralelo para ser mais rápido
        const [usuarioResponse, pendingTasksResponse, completedTasksResponse, conquistasResponse] = await Promise.all([
            // Pega os dados do usuário
            axios.get(`${apiUrl}/usuarios/${userId}`),

            // Busca a página de tarefas pendentes
            axios.get(`${tarefasApiUrl}/usuario/${userId}?estado=pendente&search=${search}&page=${pendingPage}&size=5`),

            // Busca a página de tarefas concluídas
            axios.get(`${tarefasApiUrl}/usuario/${userId}?estado=concluida&search=${search}&page=${completedPage}&size=5`),

            // Pega todas as conquistas possíveis
            axios.get(`${apiUrl}/conquistas`)
        ]);

        // Renderiza a página 'dashboard.ejs' com todos os dados recebidos da API
        res.render('dashboard', {
            usuario: usuarioResponse.data,
            tarefasPendentes: pendingTasksResponse.data,
            tarefasConcluidas: completedTasksResponse.data,
            todasAsConquistas: conquistasResponse.data,
            search: search,
            pendingPage: pendingTasksResponse.data,
            completedPage: completedTasksResponse.data
        });
    } catch (error) {
        // Se der algum erro na comunicação com a API, exibe uma mensagem no console
        console.error('Erro ao buscar dados para o dashboard:', error.message);
        // E renderiza a página com dados de erro para não quebrar
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

// Rota que recebe os dados do formulário de login
app.post('/login', async (req, res) => {
    // Pega o email e a senha do corpo da requisição
    const { email, senha } = req.body;
    try {
        // Envia os dados para a API Spring verificar o login, se o login for bem-sucedido, redireciona para o dashboard com o ID do usuário!
        const response = await axios.post(`${apiUrl}/usuarios/login`, { email, senha });
        const usuario = response.data;
        res.redirect(`/dashboard?userId=${usuario.id}`);
    } catch (error) {
        // Se o login falhar, redireciona de volta para a página inicial com uma mensagem de erro
        console.error("Falha no login:", error.response ? error.response.status : error.message);
        res.redirect('/?message=login_failed');
    }
});

// Rota que recebe os dados do formulário de cadastro
app.post('/cadastrar', async (req, res) => {
    try {
        // Envia os dados do novo usuário para a API Spring criar a conta, se for bem-sucedido, redireciona para a página de login com uma mensagem de sucesso!
        const { nome, email, senha } = req.body;
        await axios.post(`${apiUrl}/usuarios`, { nome, email, senha });
        res.redirect('/?message=success');
    } catch (error) {
        // Se der erro, exibe no console e envia uma resposta de erro
        console.error('Erro ao cadastrar usuário:', error.message);
        res.status(500).send('Erro ao cadastrar usuário.');
    }
});

// Rota para redirecionar para a pagina principal!
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

// Rota para completar tarefa (chamada pelo JavaScript do dashboard)
app.post('/api/tarefas/:id/completar', async (req, res) => {
    try {
        // Repassa a requisição para a API Spring
        const response = await axios.post(`${apiUrl}/tarefas/${req.params.id}/completar`);
        res.status(200).json(response.data);
    } catch (error) {
        const message = error.response?.data?.message || error.message;
        res.status(error.response?.status || 500).json({ message });
    }
});

// 6. Inicializa o servidor
app.listen(port, () => {
    console.log(`Servidor Node.js a rodar em http://localhost:${port}`);
});
