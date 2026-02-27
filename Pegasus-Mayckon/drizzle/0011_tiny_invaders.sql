ALTER TABLE `users` MODIFY COLUMN `role` enum('admin','contabilidade','usuario','cliente') NOT NULL DEFAULT 'cliente';--> statement-breakpoint
ALTER TABLE `users` ADD `permissoes` text;--> statement-breakpoint
ALTER TABLE `users` ADD `criadoPor` int;