CREATE TABLE `agendamentos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`contabilidadeId` int NOT NULL,
	`clienteId` int,
	`frequencia` enum('diario','semanal','mensal') NOT NULL DEFAULT 'diario',
	`horario` varchar(5) NOT NULL DEFAULT '02:00',
	`diaSemana` int,
	`diaMes` int,
	`ativo` boolean NOT NULL DEFAULT true,
	`ultimaExecucao` timestamp,
	`proximaExecucao` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `agendamentos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `certificados` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clienteId` int NOT NULL,
	`contabilidadeId` int NOT NULL,
	`cnpj` varchar(18) NOT NULL,
	`razaoSocial` varchar(255),
	`certData` text NOT NULL,
	`certSenha` text NOT NULL,
	`serialNumber` varchar(128),
	`issuer` varchar(255),
	`validFrom` timestamp,
	`validTo` timestamp,
	`ativo` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `certificados_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `clientes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`contabilidadeId` int NOT NULL,
	`cnpj` varchar(18) NOT NULL,
	`razaoSocial` varchar(255) NOT NULL,
	`nomeFantasia` varchar(255),
	`email` varchar(320),
	`telefone` varchar(20),
	`endereco` text,
	`cidade` varchar(100),
	`uf` varchar(2),
	`cep` varchar(10),
	`ativo` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `clientes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `contabilidades` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nome` varchar(255) NOT NULL,
	`cnpj` varchar(18),
	`email` varchar(320),
	`telefone` varchar(20),
	`endereco` text,
	`ownerId` int NOT NULL,
	`ativo` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `contabilidades_id` PRIMARY KEY(`id`),
	CONSTRAINT `contabilidades_cnpj_unique` UNIQUE(`cnpj`)
);
--> statement-breakpoint
CREATE TABLE `download_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clienteId` int NOT NULL,
	`contabilidadeId` int NOT NULL,
	`tipo` enum('manual','agendado') NOT NULL DEFAULT 'manual',
	`status` enum('pendente','executando','concluido','erro') NOT NULL DEFAULT 'pendente',
	`totalNotas` int DEFAULT 0,
	`notasNovas` int DEFAULT 0,
	`ultimoNsu` bigint DEFAULT 0,
	`erro` text,
	`iniciadoEm` timestamp DEFAULT (now()),
	`finalizadoEm` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `download_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clienteId` int NOT NULL,
	`contabilidadeId` int NOT NULL,
	`chaveAcesso` varchar(60) NOT NULL,
	`nsu` bigint,
	`numeroNota` varchar(20),
	`serie` varchar(10),
	`tipoDocumento` enum('NFSE','EVENTO') NOT NULL,
	`tipoEvento` varchar(50),
	`direcao` enum('emitida','recebida') NOT NULL DEFAULT 'emitida',
	`status` enum('valida','cancelada','substituida') NOT NULL DEFAULT 'valida',
	`emitenteCnpj` varchar(18),
	`emitenteNome` varchar(255),
	`tomadorCnpj` varchar(18),
	`tomadorNome` varchar(255),
	`valorServico` decimal(15,2),
	`valorLiquido` decimal(15,2),
	`valorRetencao` decimal(15,2),
	`codigoServico` varchar(20),
	`descricaoServico` text,
	`dataEmissao` timestamp,
	`dataCompetencia` timestamp,
	`municipioPrestacao` varchar(100),
	`ufPrestacao` varchar(2),
	`xmlOriginal` text,
	`dataDownload` timestamp DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `notas_id` PRIMARY KEY(`id`),
	CONSTRAINT `notas_chaveAcesso_unique` UNIQUE(`chaveAcesso`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('admin','contabilidade','cliente') NOT NULL DEFAULT 'cliente';--> statement-breakpoint
ALTER TABLE `users` ADD `contabilidadeId` int;