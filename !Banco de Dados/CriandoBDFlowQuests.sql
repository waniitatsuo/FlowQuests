DROP DATABASE IF EXISTS `flowquests_db`;

CREATE DATABASE IF NOT EXISTS `flowquests_db` 
CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Seleciona o banco de dados recém-criado para usar
USE `flowquests_db`;

-- -----------------------------------------------------
-- Tabela: usuario
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `usuario` (
  `usuario_id` INT PRIMARY KEY AUTO_INCREMENT,
  `nome` VARCHAR(100) NOT NULL,
  `email` VARCHAR(100) NOT NULL UNIQUE,
  `senha` VARCHAR(255) NOT NULL,
  `xp_total` INT DEFAULT 0,
  `criado_em` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------
-- Tabela: tarefas
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `tarefas` (
  `tarefa_id` INT PRIMARY KEY AUTO_INCREMENT,
  `usuario_id` INT NOT NULL,
  `titulo` VARCHAR(255) NOT NULL,
  `data_prazo` DATE,
  `hora_prazo` TIME,
  `categoria` ENUM('remedios', 'atividades', 'trabalhos', 'eventos') NOT NULL,
  `estado` ENUM('pendente', 'concluida','atrasada') DEFAULT 'pendente',
  `recompensa_xp` INT DEFAULT 50,
  `criado_em` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (`usuario_id`) REFERENCES `usuario`(`usuario_id`) ON DELETE CASCADE
);

-- -----------------------------------------------------
-- Tabela: conquistas
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `conquistas` (
  `conquista_id` INT PRIMARY KEY AUTO_INCREMENT,
  `nome` VARCHAR(100) NOT NULL,
  `descricao` TEXT,
  `icone` VARCHAR(50)
);

-- -----------------------------------------------------
-- Tabela: usuario_conquistas
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `usuario_conquistas` (
  `usuario_id` INT NOT NULL,
  `conquista_id` INT NOT NULL,
  `obtido_em` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  PRIMARY KEY (`usuario_id`, `conquista_id`),
  FOREIGN KEY (`usuario_id`) REFERENCES `usuario`(`usuario_id`) ON DELETE CASCADE,
  FOREIGN KEY (`conquista_id`) REFERENCES `conquistas`(`conquista_id`) ON DELETE CASCADE
);


-- -----------------------------------------------------
-- Inserir conquistas
-- -----------------------------------------------------
INSERT INTO sua_tabela (comgusta_id, nome, descricao, icone) VALUES
(1, 'Primeiros Passos', 'Você completou sua primeira tarefa!', 'fas fa-shoe-prints'),
(2, 'Mestre das Tarefas', 'Complete 10 tarefas.', 'fas fa-star'),
(3, 'Semana Produtiva', 'Complete tarefas por 7 dias seguidos.', 'fas fa-calendar-check');