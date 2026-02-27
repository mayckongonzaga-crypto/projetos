ALTER TABLE `agendamentos` MODIFY COLUMN `frequencia` enum('diario','semanal','mensal','dia_util') NOT NULL DEFAULT 'diario';--> statement-breakpoint
ALTER TABLE `agendamentos` ADD `diaUtil` int;--> statement-breakpoint
ALTER TABLE `agendamentos` ADD `mesAlvo` int;