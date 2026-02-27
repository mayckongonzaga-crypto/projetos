ALTER TABLE `cte_notas` ADD `produtoPredominante` varchar(255);--> statement-breakpoint
ALTER TABLE `cte_notas` ADD `pesoBruto` decimal(15,4);--> statement-breakpoint
ALTER TABLE `cte_notas` ADD `valorCarga` decimal(15,2);--> statement-breakpoint
ALTER TABLE `cte_notas` ADD `cstIcms` varchar(10);--> statement-breakpoint
ALTER TABLE `cte_notas` ADD `baseCalcIcms` decimal(15,2);--> statement-breakpoint
ALTER TABLE `cte_notas` ADD `aliqIcms` decimal(5,2);--> statement-breakpoint
ALTER TABLE `cte_notas` ADD `rntrc` varchar(20);--> statement-breakpoint
ALTER TABLE `cte_notas` ADD `placa` varchar(20);--> statement-breakpoint
ALTER TABLE `cte_notas` ADD `protocolo` varchar(30);--> statement-breakpoint
ALTER TABLE `cte_notas` ADD `chavesNfe` text;--> statement-breakpoint
ALTER TABLE `cte_notas` ADD `observacoes` text;--> statement-breakpoint
ALTER TABLE `cte_notas` ADD `remetenteUf` varchar(2);--> statement-breakpoint
ALTER TABLE `cte_notas` ADD `destinatarioUf` varchar(2);--> statement-breakpoint
ALTER TABLE `cte_notas` ADD `tomadorUf` varchar(2);