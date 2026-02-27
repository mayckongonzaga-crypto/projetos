ALTER TABLE `download_logs` ADD `clienteNome` varchar(255);--> statement-breakpoint
ALTER TABLE `download_logs` ADD `clienteCnpj` varchar(18);--> statement-breakpoint
ALTER TABLE `download_logs` ADD `progresso` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `download_logs` ADD `totalEsperado` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `download_logs` ADD `certificadoVencido` boolean DEFAULT false;