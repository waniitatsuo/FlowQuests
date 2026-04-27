// 1. Importa os pacotes necessários
const express = require('express');
const axios = require('axios');
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session'); // <-- NOVO: Gerenciador de Sessão

// 2. Inicializa a aplicação Express
const app = express();
const port = 3000;

// 3. Configura o middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(__dirname));

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// <-- NOVO: Configurando a Sessão do navegador -->
app.use(session({
    secret: 'chave-super-secreta-do-wanii', // Protege os cookies
    resave: false,
    saveUninitialized: false
}));

// 4. Define a URL da nossa API Spring Boot
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

// --- ROTA PRINCIPAL DO DASHBOARD (AGORA BLINDADA) ---
app.get('/dashboard', async (req, res) => {
    // <-- NOVO: Pega o ID direto da Sessão, e não mais da URL!
    const userId = req.session.userId; 

    if (!userId) {
        return res.redirect('/?message=login_required');
    }

    const search = req.query.search || '';
    const pendingPage = req.query.pending_page || 0;
    const completedPage = req.query.completed_page || 0;

    // <-- NOVO: Configuração do crachá para mandar pro Spring Boot
    const configSeguranca = {
        headers: { 'X-Usuario-Id': userId }
    };

    try {
        /* NOTA IMPORTANTE PARA O BACKEND: 
         * Lembre-se que nós bloqueamos a busca por ID para usuários comuns!
         * Se o `GET /api/usuarios/${userId}` der erro 403 Forbidden, nós precisaremos 
         * criar uma rota `GET /api/usuarios/geral/meu-perfil` no Spring Boot depois, ok?
         */
        
        const [usuarioResponse, pendingTasksResponse, completedTasksResponse, conquistasResponse] = await Promise.all([
            // Passamos o configSeguranca como último parâmetro em todas as requisições!
            axios.get(`${apiUrl}/usuarios/geral/meu-perfil`, configSeguranca),
            axios.get(`${apiUrl}/tarefas/usuario/${userId}?estado=pendente&search=${search}&page=${pendingPage}&size=5`, configSeguranca),
            axios.get(`${apiUrl}/tarefas/usuario/${userId}?estado=concluida&search=${search}&page=${completedPage}&size=5`, configSeguranca),
            axios.get(`${apiUrl}/conquistas`, configSeguranca) 
        ]);

        res.render('dashboard', {
        
            usuario: usuarioResponse.data,
            tarefasPendentes: pendingTasksResponse.data,
            tarefasConcluidas: completedTasksResponse.data,
            todasAsConquistas: conquistasResponse.data,
            search: search,
            pendingPage: pendingTasksResponse.data, // Corrigido (antes estava enviando o response inteiro)
            completedPage: completedTasksResponse.data // Corrigido
        });
    } catch (error) {
        console.error('Erro ao buscar dados para o dashboard:', error.message);
        
        // Se der erro de acesso negado (conta apagada ou banida)
        if (error.response && error.response.status === 403) {
            req.session.destroy(); // Destrói a sessão
            return res.redirect('/?message=acesso_negado');
        }

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
        
        // <-- NOVO: Salva o ID do usuário na SESSÃO em vez de mandar na URL!
        req.session.userId = usuario.id; 
        
        // Redireciona para o dashboard com a URL limpinha
        res.redirect('/dashboard'); 
    } catch (error) {
        console.error("Falha no login:", error.response ? error.response.status : error.message);
        res.redirect('/?message=login_failed');
    }
});

// <-- NOVO: Rota para fazer Logout (Sair da conta) -->
app.get('/logout', (req, res) => {
    req.session.destroy(); // Apaga o crachá
    res.redirect('/?message=logout_success');
});

app.post('/cadastrar', async (req, res) => {
    try {
        const { nome, email, senha } = req.body;
        await axios.post(`${apiUrl}/usuarios/registrar`, { nome, email, senha });
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
        const configSeguranca = { headers: { 'X-Usuario-Id': req.session.userId } };
        
        // Manda os dados e o crachá
        const response = await axios.post(`${apiUrl}/tarefas`, req.body, configSeguranca);
        res.status(201).json(response.data);
    } catch (error) {
        console.error('Erro no Node.js ao criar tarefa:', error.message);
        res.status(500).json({ message: 'Erro ao criar tarefa' });
    }
});

app.post('/api/tarefas/:id/completar', async (req, res) => {
    try {
        const configSeguranca = { headers: { 'X-Usuario-Id': req.session.userId } };

        // Manda a requisição pro Spring Boot junto com o crachá
        const response = await axios.post(`${apiUrl}/tarefas/${req.params.id}/completar`, {}, configSeguranca);
        res.status(200).json(response.data);
    } catch (error) {
        const message = error.response?.data?.message || error.message;
        res.status(error.response?.status || 500).json({ message });
    }
});

// ==========================================
// ROTAS DO PAINEL ADMIN
// ==========================================

// ==========================================
// ROTAS DO PAINEL ADMIN
// ==========================================

// 1. Exibir o Painel com a Tabela
app.get('/admin/admin-dashboard', async (req, res) => {
    const adminId = req.session.userId; 
    if (!adminId) return res.redirect('/'); 

    try {
        const configAdmin = { headers: { 'X-Admin-Id': adminId } };

        const perfilResponse = await axios.get(`${apiUrl}/usuarios/geral/meu-perfil`, { headers: { 'X-Usuario-Id': adminId } });
        const adminLogado = perfilResponse.data;

        if (adminLogado.perfil !== 'ADMIN') {
            return res.status(403).send("Acesso Negado!");
        }

        // AGORA SIM, BATENDO NA ROTA CORRETA DO SEU CONTROLLER!
        const listaResponse = await axios.get(`${apiUrl}/usuarios/admin/lista-users`, configAdmin);
        const todosUsuarios = listaResponse.data;

        res.render('admin/admin-dashboard', { admin: adminLogado, usuarios: todosUsuarios });

    } catch (error) {
        console.error("Erro ao carregar o painel admin:", error.message);
        res.status(500).send("Erro ao carregar painel.");
    }
});

// 2. Rota para Deletar Usuário
app.post('/admin/deletar/:id', async (req, res) => {
    const adminId = req.session.userId;
    const alvoId = req.params.id;

    try {
        // Rota corrigida para bater com o seu @DeleteMapping("/admin/deleta/{id}")
        await axios.delete(`${apiUrl}/usuarios/admin/deleta/${alvoId}`, { headers: { 'X-Admin-Id': adminId } });
        res.redirect('/admin/admin-dashboard');
    } catch (error) {
        console.error("Erro ao deletar usuário:", error.message);
        res.status(500).send("Erro ao tentar apagar o usuário.");
    }
});

// 3. Rota para Editar Usuário
app.post('/admin/editar/:id', async (req, res) => {
    const adminId = req.session.userId;
    const alvoId = req.params.id;
    // Pega os dados que vieram do modal no front-end
    const { nome, email, senha } = req.body; 

    try {
        const configAdmin = { headers: { 'X-Admin-Id': adminId } };
        
        // Monta o objeto que o Spring Boot espera receber
        const dadosAtualizados = { nome, email, senha };

        // Rota corrigida para bater com o seu @PutMapping("/admin/atualiza/{id}")
        await axios.put(`${apiUrl}/usuarios/admin/atualiza/${alvoId}`, dadosAtualizados, configAdmin);
        
        res.redirect('/admin/admin-dashboard');
    } catch (error) {
        console.error("Erro ao editar usuário:", error.message);
        res.status(500).send("Erro ao tentar editar o usuário.");
    }
});

// 4. Rota para Promover um Usuário a Admin
app.post('/admin/promover/:id', async (req, res) => {
    const adminId = req.session.userId;
    const alvoId = req.params.id;

    try {
        const configAdmin = { headers: { 'X-Admin-Id': adminId } };
        
        // Manda os dados atualizados para o Spring Boot
        // (Enviando o perfil como ADMIN)
        const dadosAtualizados = { perfil: 'ADMIN' };

        await axios.put(`${apiUrl}/usuarios/admin/promover/${alvoId}`, dadosAtualizados, configAdmin);
        
        // Recarrega a página para vermos a tag vermelha de ADMIN aparecer na tabela!
        res.redirect('/admin/admin-dashboard');
    } catch (error) {
        console.error("Erro ao promover usuário:", error.message);
        res.status(500).send("Erro ao tentar promover o usuário a Administrador.");
    }
});

// 6. Inicializa o servidor
app.listen(port, () => {
    console.log(`🚀 Servidor Node.js a rodar lindamente em http://localhost:${port}`);
});