CREATE TABLE `planos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nome` varchar(100) NOT NULL,
	`descricao` text,
	`maxClientes` int NOT NULL DEFAULT 10,
	`maxCertificados` int NOT NULL DEFAULT 10,
	`maxDownloadsDia` int NOT NULL DEFAULT 100,
	`permiteAgendamento` boolean NOT NULL DEFAULT true,
	`preco` decimal(10,2) DEFAULT '0.00',
	`ativo` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `planos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `contabilidades` ADD `planoId` int;--> statement-breakpoint
ALTER TABLE `contabilidades` ADD `bloqueadoMotivo` text;--> statement-breakpoint
ALTER TABLE `contabilidades` ADD `dataExpiracao` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `ativo` boolean DEFAULT true NOT NULL;