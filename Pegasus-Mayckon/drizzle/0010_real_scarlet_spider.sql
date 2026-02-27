CREATE TABLE `audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`contabilidadeId` int NOT NULL,
	`userId` int NOT NULL,
	`userName` varchar(255) NOT NULL,
	`acao` varchar(100) NOT NULL,
	`entidade` varchar(100) NOT NULL,
	`entidadeId` int,
	`detalhes` text,
	`ip` varchar(45),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
