const express = require('express');
const axios = require('axios');
const path = require('path');
const session = require('express-session');

const app = express();
const port = 3000;
const apiUrl = 'http://localhost:8080/api';

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(__dirname));

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Configuração de Sessão (Cookies)
app.use(session({
    secret: 'chave-super-secreta-do-wanii',
    resave: false,
    saveUninitialized: false
}));

// --- ROTAS DE NAVEGAÇÃO ---

app.get('/', (req, res) => {
    res.render('login', { message: req.query.message });
});

app.get('/dashboard', async (req, res) => {
    const userId = req.session.userId;
    if (!userId) return res.redirect('/?message=login_required');

    try {
        const config = { headers: { 'X-Usuario-Id': userId } };
        // Busca perfil, tarefas e conquistas em paralelo
        const [userRes, tasksRes, achievementsRes] = await Promise.all([
            axios.get(`${apiUrl}/usuarios/geral/meu-perfil`, config),
            axios.get(`${apiUrl}/tarefas/usuario/${userId}?estado=pendente`, config),
            axios.get(`${apiUrl}/conquistas`, config)
        ]);

        res.render('dashboard', {
            usuario: userRes.data,
            tarefas: tasksRes.data,
            conquistas: achievementsRes.data
        });
    } catch (error) {
        res.redirect('/?message=error');
    }
});

// --- ROTAS DE LOGIN/LOGOUT ---

app.post('/login', async (req, res) => {
    try {
        const response = await axios.post(`${apiUrl}/usuarios/login`, req.body);
        req.session.userId = response.data.id;
        res.redirect('/dashboard');
    } catch (error) {
        res.redirect('/?message=login_failed');
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// --- PAINEL ADMIN (MODERAÇÃO) ---

app.get('/admin/painel', async (req, res) => {
    const adminId = req.session.userId;
    if (!adminId) return res.redirect('/');

    try {
        const configAdmin = { headers: { 'X-Admin-Id': adminId } };
        const userRes = await axios.get(`${apiUrl}/usuarios/geral/meu-perfil`, { headers: { 'X-Usuario-Id': adminId } });
        
        if (userRes.data.perfil !== 'ADMIN') return res.status(403).send("Acesso Negado");

        // Rota que lista todos os usuários para o admin
        const listRes = await axios.get(`${apiUrl}/usuarios/admin/lista-users`, configAdmin);
        
        res.render('admin/admin-dashboard', { admin: userRes.data, usuarios: listRes.data });
    } catch (error) {
        res.redirect('/dashboard');
    }
});

// Ações do Admin (Promover, Editar, Deletar)
app.post('/admin/promover/:id', async (req, res) => {
    try {
        await axios.put(`${apiUrl}/usuarios/admin/adicionar-adm/${req.params.id}`, { perfil: 'ADMIN' }, { headers: { 'X-Admin-Id': req.session.userId } });
        res.redirect('/admin/painel');
    } catch (e) { res.status(500).send("Erro ao promover"); }
});

app.post('/admin/editar/:id', async (req, res) => {
    try {
        await axios.put(`${apiUrl}/usuarios/admin/atualiza/${req.params.id}`, req.body, { headers: { 'X-Admin-Id': req.session.userId } });
        res.redirect('/admin/painel');
    } catch (e) { res.status(500).send("Erro ao editar"); }
});

app.post('/admin/deletar/:id', async (req, res) => {
    try {
        await axios.delete(`${apiUrl}/usuarios/admin/deleta/${req.params.id}`, { headers: { 'X-Admin-Id': req.session.userId } });
        res.redirect('/admin/painel');
    } catch (e) { res.status(500).send("Erro ao deletar"); }
});

app.listen(port, () => console.log(`Rodando em http://localhost:${port}`));