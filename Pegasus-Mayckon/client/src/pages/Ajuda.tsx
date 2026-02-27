import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  BookOpen, Download, HelpCircle, CheckCircle2, ArrowRight,
  ChevronDown
} from "lucide-react";
import { useState, useRef } from "react";

// Imagens ilustrativas locais
const IMAGES = {
  fluxoGeral: "/ajuda/fluxo-geral.png",
  login: "/ajuda/login.png",
  clientes: "/ajuda/clientes.png",
  certificados: "/ajuda/certificados.png",
  downloads: "/ajuda/downloads.png",
  historico: "/ajuda/historico.png",
  zip: "/ajuda/zip.png",
  validade: "/ajuda/validade.png",
  notas: "/ajuda/notas.png",
};

// Componente de imagem ilustrativa
function ManualImage({ src, alt, caption }: { src: string; alt: string; caption?: string }) {
  return (
    <div className="my-4">
      <div className="border rounded-lg overflow-hidden shadow-sm bg-white dark:bg-white/5">
        <img src={src} alt={alt} className="w-full h-auto" loading="lazy" />
      </div>
      {caption && (
        <p className="text-xs text-muted-foreground text-center mt-2 italic">{caption}</p>
      )}
    </div>
  );
}

// Componente de seção colapsável
function Section({ 
  number, title, children, defaultOpen = false 
}: { 
  number: number; title: string; children: React.ReactNode; defaultOpen?: boolean 
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 p-4 bg-card hover:bg-accent/50 transition-colors text-left"
      >
        <span className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold shrink-0">
          {number}
        </span>
        <h2 className="text-lg font-bold flex-1">{title}</h2>
        <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="p-4 pt-0 space-y-4">
          <Separator className="mb-4" />
          {children}
        </div>
      )}
    </section>
  );
}

// Componente de passo
function Step({ number, title, description }: { number: number; title: string; description: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="h-7 w-7 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
        {number}
      </span>
      <div>
        <p className="font-semibold text-sm">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

// =============================================
// MANUAL DO USUÁRIO ILUSTRADO
// =============================================
function ManualUsuario() {
  return (
    <div className="space-y-4 max-w-4xl">
      {/* Capa */}
      <div className="text-center space-y-3 pb-6 border-b">
        <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-primary/10 mx-auto">
          <BookOpen className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Manual do Usuário</h1>
        <p className="text-muted-foreground text-lg">Pegasus — Sistema de Gestão de NFSe</p>
        <Badge variant="secondary" className="text-xs">Versão 1.0 — Fevereiro 2026 | Lan7 Tecnologia</Badge>
      </div>

      {/* Fluxo Geral */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 dark:border-blue-800">
        <CardContent className="p-5">
          <h3 className="text-lg font-bold text-center mb-2">Fluxo de Utilização do Pegasus</h3>
          <p className="text-sm text-muted-foreground text-center mb-4">
            Siga estes 4 passos para baixar suas notas fiscais de serviço.
          </p>
          <ManualImage 
            src={IMAGES.fluxoGeral} 
            alt="Fluxo geral do sistema Pegasus" 
            caption="Visão geral: Cadastrar Clientes → Upload de Certificados → Baixar Notas → Acompanhar e Exportar"
          />
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mt-4">
            <div className="text-center p-3 bg-white dark:bg-white/5 rounded-lg border">
              <div className="h-8 w-8 rounded-full bg-blue-50 dark:bg-blue-500/15 text-white flex items-center justify-center text-sm font-bold mx-auto mb-2">1</div>
              <p className="text-xs font-semibold">Cadastrar Clientes</p>
              <p className="text-[10px] text-muted-foreground">Empresas com CNPJ</p>
            </div>
            <div className="text-center p-3 bg-white dark:bg-white/5 rounded-lg border">
              <div className="h-8 w-8 rounded-full bg-green-50 dark:bg-green-500/15 text-white flex items-center justify-center text-sm font-bold mx-auto mb-2">2</div>
              <p className="text-xs font-semibold">Upload Certificados</p>
              <p className="text-[10px] text-muted-foreground">Arquivos .pfx</p>
            </div>
            <div className="text-center p-3 bg-white dark:bg-white/5 rounded-lg border">
              <div className="h-8 w-8 rounded-full bg-orange-50 dark:bg-orange-500/15 text-white flex items-center justify-center text-sm font-bold mx-auto mb-2">3</div>
              <p className="text-xs font-semibold">Baixar Notas</p>
              <p className="text-[10px] text-muted-foreground">XMLs e PDFs</p>
            </div>
            <div className="text-center p-3 bg-white dark:bg-white/5 rounded-lg border">
              <div className="h-8 w-8 rounded-full bg-purple-500 text-white flex items-center justify-center text-sm font-bold mx-auto mb-2">4</div>
              <p className="text-xs font-semibold">Acompanhar e Exportar</p>
              <p className="text-[10px] text-muted-foreground">Histórico e ZIP</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Seção 1: Login */}
      <Section number={1} title="Login — Acessar o Sistema" defaultOpen={true}>
        <p className="text-sm text-muted-foreground">
          Ao acessar o Pegasus, você verá a página inicial com o formulário de login. 
          Insira suas credenciais fornecidas pelo administrador para acessar o sistema.
        </p>
        <ManualImage 
          src={IMAGES.login} 
          alt="Tela de login do Pegasus" 
          caption="Tela de Login — Siga os passos numerados para acessar o sistema"
        />
        <div className="space-y-3 bg-muted/30 p-4 rounded-lg">
          <Step number={1} title="Digite seu e-mail" description="Informe o e-mail cadastrado pelo administrador no campo 'E-mail'." />
          <Step number={2} title="Digite sua senha" description="Informe a senha fornecida no campo 'Senha'." />
          <Step number={3} title="Clique em Entrar" description="Clique no botão 'Entrar' para acessar o painel do sistema." />
        </div>
        <Card className="bg-amber-50 dark:bg-amber-500/10 border-amber-200">
          <CardContent className="p-3 flex items-start gap-2">
            <HelpCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-800 dark:text-amber-300">
              <strong>Dica:</strong> Após o login, o menu lateral (sidebar) mostrará apenas as funcionalidades 
              que você tem permissão para acessar, conforme configurado pelo administrador.
            </p>
          </CardContent>
        </Card>
      </Section>

      {/* Seção 2: Cadastrar Clientes */}
      <Section number={2} title="Passo 1 — Cadastrar Clientes (Empresas)">
        <p className="text-sm text-muted-foreground">
          O primeiro passo é cadastrar as empresas (clientes) da sua contabilidade. 
          Cada empresa precisa ter CNPJ, razão social e dados de localização.
        </p>
        <ManualImage 
          src={IMAGES.clientes} 
          alt="Tela de cadastro de clientes" 
          caption="Tela de Clientes — Clique em 'Novo Cliente', preencha os dados e salve"
        />
        <div className="space-y-3 bg-muted/30 p-4 rounded-lg">
          <Step number={1} title="Clique em '+ Novo Cliente'" description="O botão fica no canto superior direito da tela de Meus Clientes." />
          <Step number={2} title="Preencha os dados da empresa" description="Informe: Razão Social, CNPJ (formato XX.XXX.XXX/XXXX-XX), Cidade, UF e Inscrição Municipal (opcional)." />
          <Step number={3} title="Clique em 'Salvar Cliente'" description="O cliente será adicionado à lista e estará pronto para receber um certificado digital." />
        </div>
        <Card className="bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-800">
          <CardContent className="p-3 flex items-start gap-2">
            <HelpCircle className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
            <p className="text-xs text-blue-800 dark:text-blue-300">
              <strong>Importante:</strong> O CNPJ deve ser o mesmo do certificado digital. 
              Você pode editar ou excluir clientes a qualquer momento usando os ícones na coluna "Ações".
            </p>
          </CardContent>
        </Card>
      </Section>

      {/* Seção 3: Upload de Certificados */}
      <Section number={3} title="Passo 2 — Upload de Certificados Digitais (.pfx)">
        <p className="text-sm text-muted-foreground">
          Após cadastrar os clientes, faça o upload dos certificados digitais A1 (arquivo .pfx) de cada empresa. 
          O certificado é necessário para autenticar na API Nacional da NFSe e baixar as notas.
        </p>
        <ManualImage 
          src={IMAGES.certificados} 
          alt="Tela de upload de certificados" 
          caption="Tela de Certificados — Selecione o cliente, faça upload do .pfx e informe a senha"
        />
        <div className="space-y-3 bg-muted/30 p-4 rounded-lg">
          <Step number={1} title="Clique em '+ Novo Certificado'" description="O botão fica no canto superior direito da tela de Certificados." />
          <Step number={2} title="Selecione o cliente" description="No dropdown, escolha a empresa que receberá o certificado." />
          <Step number={3} title="Faça upload do arquivo .pfx" description="Arraste o arquivo .pfx para a área de upload ou clique para selecionar do computador." />
          <Step number={4} title="Informe a senha do certificado" description="Digite a senha do certificado digital no campo 'Senha do Certificado'." />
        </div>
        <Card className="bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-800">
          <CardContent className="p-3 flex items-start gap-2">
            <HelpCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
            <p className="text-xs text-red-800 dark:text-red-300">
              <strong>Atenção:</strong> Certificados vencidos são automaticamente ignorados durante os downloads. 
              Monitore a validade na tela "Validade Certificados" e renove antes do vencimento.
            </p>
          </CardContent>
        </Card>

        {/* Sub-seção: Validade */}
        <div className="mt-4">
          <h4 className="font-semibold text-sm mb-2">Monitorar Validade dos Certificados</h4>
          <p className="text-sm text-muted-foreground mb-3">
            A tela "Validade Certificados" mostra um painel visual com todos os certificados organizados por status:
          </p>
          <ManualImage 
            src={IMAGES.validade} 
            alt="Tela de validade de certificados" 
            caption="Painel de Validade — Monitore certificados válidos, próximos do vencimento e vencidos"
          />
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="p-2 bg-green-50 dark:bg-green-500/10 rounded border border-green-200 dark:border-green-800">
              <span className="font-bold text-green-700 dark:text-green-300">✅ Válidos</span>
              <p className="text-muted-foreground">Prontos para uso</p>
            </div>
            <div className="p-2 bg-yellow-50 dark:bg-yellow-500/10 rounded border border-yellow-200">
              <span className="font-bold text-yellow-700 dark:text-yellow-400">⚠️ Vencendo</span>
              <p className="text-muted-foreground">Renove em breve</p>
            </div>
            <div className="p-2 bg-red-50 dark:bg-red-500/10 rounded border border-red-200 dark:border-red-800">
              <span className="font-bold text-red-700 dark:text-red-400">❌ Vencidos</span>
              <p className="text-muted-foreground">Não funcionam</p>
            </div>
          </div>
        </div>
      </Section>

      {/* Seção 4: Downloads */}
      <Section number={4} title="Passo 3 — Baixar Notas Fiscais (XMLs e PDFs)">
        <p className="text-sm text-muted-foreground">
          Com clientes e certificados cadastrados, acesse a tela de <strong>Downloads</strong> para buscar e baixar 
          as notas fiscais de serviço (XMLs e DANFSe/PDFs) diretamente da API Nacional da NFSe.
        </p>
        <ManualImage 
          src={IMAGES.downloads} 
          alt="Tela de downloads" 
          caption="Tela de Downloads — Configure o tipo, período, selecione empresas e execute o download"
        />
        <div className="space-y-3 bg-muted/30 p-4 rounded-lg">
          <Step number={1} title="Escolha o tipo de busca" description="'Somente novas' busca apenas notas não baixadas (mais rápido). 'Por período' busca todas as notas em um intervalo de datas." />
          <Step number={2} title="Defina o período (se aplicável)" description="No modo 'Por período', selecione a Data Inicial e Data Final. Exemplo: 01/02/2026 a 10/02/2026." />
          <Step number={3} title="Selecione as empresas" description="Marque as checkboxes das empresas desejadas na tabela. Use 'Marcar Visíveis' ou 'Marcar Válidos' para seleção em lote." />
          <Step number={4} title="Ou baixe individualmente" description="Clique no botão 'Baixar' na linha de uma empresa específica para baixar apenas as notas dela." />
          <Step number={5} title="Execute o download" description="Clique em 'Baixar Todas', 'Baixar Selecionadas' ou 'ZIP Todas' conforme sua necessidade." />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
          <Card className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-500/10">
            <CardContent className="p-3 text-center">
              <p className="font-semibold text-sm text-blue-800 dark:text-blue-300">⬇ Baixar Todas</p>
              <p className="text-xs text-blue-600 dark:text-blue-400">Processa todas as empresas com certificado válido</p>
            </CardContent>
          </Card>
          <Card className="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-500/10">
            <CardContent className="p-3 text-center">
              <p className="font-semibold text-sm text-green-800 dark:text-green-300">⬇ Baixar Selecionadas</p>
              <p className="text-xs text-green-600 dark:text-green-400">Processa apenas as empresas marcadas</p>
            </CardContent>
          </Card>
          <Card className="border-purple-200 dark:border-purple-800 bg-purple-50">
            <CardContent className="p-3 text-center">
              <p className="font-semibold text-sm text-purple-800 dark:text-purple-400">📦 ZIP</p>
              <p className="text-xs text-purple-600">Gera arquivo compactado para download</p>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-800 mt-4">
          <CardContent className="p-3 flex items-start gap-2">
            <HelpCircle className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
            <p className="text-xs text-blue-800 dark:text-blue-300">
              <strong>Dica:</strong> Durante o download, acompanhe o progresso em tempo real na tela de 
              <strong> Histórico de Downloads</strong>. Se necessário, clique em "Parar" para interromper.
            </p>
          </CardContent>
        </Card>
      </Section>

      {/* Seção 5: Histórico */}
      <Section number={5} title="Passo 4 — Acompanhar Histórico de Downloads">
        <p className="text-sm text-muted-foreground">
          A tela de <strong>Histórico de Downloads</strong> exibe o registro completo de todos os downloads realizados, 
          com detalhes por empresa: quantidade de XMLs, PDFs baixados e erros.
        </p>
        <ManualImage 
          src={IMAGES.historico} 
          alt="Tela de histórico de downloads" 
          caption="Histórico de Downloads — Acompanhe XMLs, PDFs e erros por empresa. Exporte relatórios em PDF ou Excel."
        />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left py-2 px-3 font-semibold">Coluna</th>
                <th className="text-left py-2 px-3 font-semibold">O que mostra</th>
              </tr>
            </thead>
            <tbody className="text-muted-foreground">
              <tr className="border-b"><td className="py-2 px-3 font-medium">Data</td><td className="py-2 px-3">Data e hora do download</td></tr>
              <tr className="border-b"><td className="py-2 px-3 font-medium">Empresa</td><td className="py-2 px-3">Nome da empresa</td></tr>
              <tr className="border-b"><td className="py-2 px-3 font-medium">Total Notas</td><td className="py-2 px-3">Notas encontradas na API</td></tr>
              <tr className="border-b"><td className="py-2 px-3 font-medium">XMLs</td><td className="py-2 px-3">XMLs salvos com sucesso (ícone azul)</td></tr>
              <tr className="border-b"><td className="py-2 px-3 font-medium">PDFs</td><td className="py-2 px-3">DANFSe baixados com sucesso (ícone verde)</td></tr>
              <tr className="border-b"><td className="py-2 px-3 font-medium">Erros PDF</td><td className="py-2 px-3">PDFs que falharam após todas as tentativas (ícone vermelho)</td></tr>
              <tr className="border-b"><td className="py-2 px-3 font-medium">Progresso</td><td className="py-2 px-3">Barra de progresso com percentual</td></tr>
              <tr><td className="py-2 px-3 font-medium">Status</td><td className="py-2 px-3">Executando, Concluído, Erro ou Cancelado</td></tr>
            </tbody>
          </table>
        </div>
        <div className="flex gap-3 mt-3">
          <Card className="flex-1 border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-500/10">
            <CardContent className="p-3 text-center">
              <p className="font-semibold text-sm text-red-800 dark:text-red-300">📄 Relatório PDF</p>
              <p className="text-xs text-red-600">Exporta o histórico em formato PDF</p>
            </CardContent>
          </Card>
          <Card className="flex-1 border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-500/10">
            <CardContent className="p-3 text-center">
              <p className="font-semibold text-sm text-green-800 dark:text-green-300">📊 Relatório Excel</p>
              <p className="text-xs text-green-600 dark:text-green-400">Exporta o histórico em planilha Excel</p>
            </CardContent>
          </Card>
        </div>
      </Section>

      {/* Seção 6: ZIP */}
      <Section number={6} title="Passo 5 — Baixar no Formato ZIP">
        <p className="text-sm text-muted-foreground">
          O sistema permite gerar arquivos ZIP com todos os XMLs e PDFs organizados por empresa em pastas separadas. 
          Você pode gerar ZIP de uma empresa específica ou de todas as empresas de uma vez.
        </p>
        <ManualImage 
          src={IMAGES.zip} 
          alt="Opções de download ZIP" 
          caption="Opções de ZIP — Por empresa (individual) ou todas as empresas (em pastas separadas)"
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
          <Card className="border-blue-200 dark:border-blue-800">
            <CardContent className="p-4">
              <h4 className="font-semibold text-sm text-blue-800 dark:text-blue-300 mb-2">📦 ZIP por Empresa</h4>
              <p className="text-xs text-muted-foreground mb-2">
                Gera um arquivo ZIP contendo apenas os XMLs e PDFs de uma empresa específica.
              </p>
              <p className="text-xs text-muted-foreground">
                <strong>Como fazer:</strong> Na tela de Downloads, clique no botão "ZIP" na linha da empresa desejada.
              </p>
            </CardContent>
          </Card>
          <Card className="border-green-200 dark:border-green-800">
            <CardContent className="p-4">
              <h4 className="font-semibold text-sm text-green-800 dark:text-green-300 mb-2">📦 ZIP Todas as Empresas</h4>
              <p className="text-xs text-muted-foreground mb-2">
                Gera um arquivo ZIP com todas as empresas, cada uma em sua própria pasta.
              </p>
              <p className="text-xs text-muted-foreground">
                <strong>Como fazer:</strong> Na tela de Downloads, clique no botão "ZIP Todas" ou "ZIP Selecionadas".
              </p>
            </CardContent>
          </Card>
        </div>
        <Card className="bg-muted/30 mt-4">
          <CardContent className="p-4">
            <h4 className="font-semibold text-sm mb-2">Estrutura do arquivo ZIP:</h4>
            <div className="font-mono text-xs space-y-1 text-muted-foreground bg-background p-3 rounded border">
              <p className="font-bold text-foreground">📁 notas_fiscais_02-2026.zip</p>
              <p className="ml-4">📁 Empresa_ABC_Ltda/</p>
              <p className="ml-8">📄 nota_001.xml</p>
              <p className="ml-8">📄 nota_001_danfse.pdf</p>
              <p className="ml-4">📁 Comercio_XYZ_SA/</p>
              <p className="ml-8">📄 nota_002.xml</p>
              <p className="ml-8">📄 nota_002_danfse.pdf</p>
            </div>
          </CardContent>
        </Card>
      </Section>

      {/* Seção 7: Notas Fiscais */}
      <Section number={7} title="Consultar Notas Fiscais Baixadas">
        <p className="text-sm text-muted-foreground">
          A tela de <strong>Notas Fiscais</strong> permite visualizar todas as notas já baixadas, 
          com filtros por cliente, período e tipo. Você pode baixar o XML ou PDF individual de cada nota.
        </p>
        <ManualImage 
          src={IMAGES.notas} 
          alt="Tela de notas fiscais" 
          caption="Notas Fiscais — Filtre por cliente ou período e baixe XML ou PDF individual"
        />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left py-2 px-3 font-semibold">Coluna</th>
                <th className="text-left py-2 px-3 font-semibold">Descrição</th>
              </tr>
            </thead>
            <tbody className="text-muted-foreground">
              <tr className="border-b"><td className="py-2 px-3 font-medium">Chave de Acesso</td><td className="py-2 px-3">Identificador único da nota fiscal</td></tr>
              <tr className="border-b"><td className="py-2 px-3 font-medium">Prestador</td><td className="py-2 px-3">Quem emitiu a nota (nome/CNPJ)</td></tr>
              <tr className="border-b"><td className="py-2 px-3 font-medium">Tomador</td><td className="py-2 px-3">Quem recebeu o serviço</td></tr>
              <tr className="border-b"><td className="py-2 px-3 font-medium">Valor</td><td className="py-2 px-3">Valor total da nota fiscal</td></tr>
              <tr className="border-b"><td className="py-2 px-3 font-medium">Emissão</td><td className="py-2 px-3">Data de emissão da nota</td></tr>
              <tr><td className="py-2 px-3 font-medium">Ações</td><td className="py-2 px-3">Baixar XML, baixar PDF (DANFSe), visualizar detalhes</td></tr>
            </tbody>
          </table>
        </div>
      </Section>

      {/* Seção 8: Agendamentos */}
      <Section number={8} title="Agendamentos Automáticos">
        <p className="text-sm text-muted-foreground">
          Configure downloads automáticos para que o sistema busque novas notas periodicamente, 
          sem necessidade de intervenção manual.
        </p>
        <div className="space-y-3 bg-muted/30 p-4 rounded-lg">
          <Step number={1} title="Criar Agendamento" description="Clique em 'Novo Agendamento' e defina: nome, frequência (diário, semanal, mensal), horário de execução e quais empresas incluir." />
          <Step number={2} title="Ativar/Desativar" description="Use o botão de toggle para ativar ou desativar um agendamento sem excluí-lo." />
          <Step number={3} title="Acompanhar Execuções" description="Cada execução automática é registrada no Histórico de Downloads com o tipo 'Agendado'." />
        </div>
      </Section>

      {/* Seção 9: Relatórios */}
      <Section number={9} title="Relatórios">
        <p className="text-sm text-muted-foreground">
          A tela de Relatórios oferece visualizações analíticas sobre as notas fiscais: 
          relatório por empresa, por período, com gráficos e opção de exportação em PDF ou Excel.
        </p>
      </Section>

      {/* Seção 10: Visualizar XML */}
      <Section number={10} title="Visualizar XML">
        <p className="text-sm text-muted-foreground">
          Visualize o conteúdo de arquivos XML de nota fiscal de forma amigável e organizada. 
          Faça upload de um XML ou selecione uma nota já baixada para ver todos os campos em formato legível, 
          sem precisar abrir o arquivo em um editor de texto.
        </p>
      </Section>

      {/* Seção 11: Configurações */}
      <Section number={11} title="Configurações">
        <p className="text-sm text-muted-foreground mb-3">
          A tela de Configurações permite ajustar parâmetros operacionais do sistema:
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left py-2 px-3 font-semibold">Aba</th>
                <th className="text-left py-2 px-3 font-semibold">Descrição</th>
              </tr>
            </thead>
            <tbody className="text-muted-foreground">
              <tr className="border-b"><td className="py-2 px-3 font-medium">Geral</td><td className="py-2 px-3">Tentativas de download de PDF, timeout por nota, opções operacionais</td></tr>
              <tr className="border-b"><td className="py-2 px-3 font-medium">Usuários</td><td className="py-2 px-3">Criar, editar, ativar/desativar contas e definir permissões granulares</td></tr>
              <tr><td className="py-2 px-3 font-medium">Auditoria</td><td className="py-2 px-3">Registro de todas as ações realizadas no sistema</td></tr>
            </tbody>
          </table>
        </div>
      </Section>

      {/* Seção 12: Temas */}
      <Section number={12} title="Temas e Personalização">
        <p className="text-sm text-muted-foreground mb-3">
          O sistema oferece 4 temas visuais que podem ser alterados a qualquer momento pela barra lateral (sidebar):
        </p>
        <div className="grid grid-cols-4 gap-3">
          <div className="p-3 rounded-lg border text-center">
            <div className="h-8 w-8 rounded-full bg-white dark:bg-white/5 border-2 border-gray-300 dark:border-gray-600 mx-auto mb-2" />
            <p className="text-xs font-semibold">Branco</p>
            <p className="text-[10px] text-muted-foreground">Limpo e claro</p>
          </div>
          <div className="p-3 rounded-lg border text-center">
            <div className="h-8 w-8 rounded-full bg-blue-700 border-2 border-blue-500 mx-auto mb-2" />
            <p className="text-xs font-semibold">Azul</p>
            <p className="text-[10px] text-muted-foreground">Profissional</p>
          </div>
          <div className="p-3 rounded-lg border text-center">
            <div className="h-8 w-8 rounded-full bg-green-700 border-2 border-green-500 mx-auto mb-2" />
            <p className="text-xs font-semibold">Verde</p>
            <p className="text-[10px] text-muted-foreground">Moderno</p>
          </div>
          <div className="p-3 rounded-lg border text-center">
            <div className="h-8 w-8 rounded-full bg-gray-900 border-2 border-gray-700 mx-auto mb-2" />
            <p className="text-xs font-semibold">Preto</p>
            <p className="text-[10px] text-muted-foreground">Elegante</p>
          </div>
        </div>
      </Section>

      {/* Dicas Gerais */}
      <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200 dark:border-green-800">
        <CardContent className="p-5">
          <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
            Dicas e Boas Práticas
          </h3>
          <div className="space-y-3">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
              <p className="text-sm text-muted-foreground">Mantenha os certificados digitais sempre atualizados. O sistema alerta sobre certificados próximos do vencimento.</p>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
              <p className="text-sm text-muted-foreground">Use o modo <strong>"Somente novas"</strong> para downloads diários — é mais rápido e eficiente.</p>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
              <p className="text-sm text-muted-foreground">Configure <strong>agendamentos automáticos</strong> para não esquecer de baixar as notas periodicamente.</p>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
              <p className="text-sm text-muted-foreground">Gere <strong>ZIPs periódicos</strong> para manter backup das notas em seu computador local.</p>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
              <p className="text-sm text-muted-foreground">Verifique o <strong>Histórico de Downloads</strong> regularmente para identificar erros de PDF.</p>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
              <p className="text-sm text-muted-foreground">Use <strong>permissões granulares</strong> para controlar o acesso de cada usuário às funcionalidades.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// =============================================
// HTML PARA PDF - MANUAL DO USUÁRIO
// =============================================
function getUsuarioHtml(): string {
  return `
<h1>Manual do Usuário — Pegasus</h1>
<p class="subtitle">Sistema de Gestão de NFSe para Contabilidades</p>
<p class="version">Versão 1.0 — Fevereiro 2026 | Lan7 Tecnologia</p>

<div class="flow-box">
  <h3 style="text-align:center; margin-bottom:10px;">Fluxo de Utilização</h3>
  <div class="flow-steps">
    <div class="flow-step"><span class="flow-num" style="background:#3b82f6;">1</span><strong>Cadastrar Clientes</strong><br><small>Empresas com CNPJ</small></div>
    <div class="flow-arrow">→</div>
    <div class="flow-step"><span class="flow-num" style="background:#22c55e;">2</span><strong>Upload Certificados</strong><br><small>Arquivos .pfx</small></div>
    <div class="flow-arrow">→</div>
    <div class="flow-step"><span class="flow-num" style="background:#f97316;">3</span><strong>Baixar Notas</strong><br><small>XMLs e PDFs</small></div>
    <div class="flow-arrow">→</div>
    <div class="flow-step"><span class="flow-num" style="background:#8b5cf6;">4</span><strong>Acompanhar</strong><br><small>Histórico e ZIP</small></div>
  </div>
</div>

<img src="${IMAGES.fluxoGeral}" alt="Fluxo geral" style="width:100%; border:1px solid #e5e7eb; border-radius:8px; margin:16px 0;" />

<h2><span class="section-num">1</span>Login — Acessar o Sistema</h2>
<p>Ao acessar o Pegasus, insira seu <strong>e-mail</strong> e <strong>senha</strong> fornecidos pelo administrador e clique em <strong>"Entrar"</strong>.</p>
<img src="${IMAGES.login}" alt="Tela de login" style="width:100%; border:1px solid #e5e7eb; border-radius:8px; margin:12px 0;" />
<div class="steps">
  <div class="step-item"><span class="step-num">1</span> <strong>Digite seu e-mail</strong> — Informe o e-mail cadastrado pelo administrador.</div>
  <div class="step-item"><span class="step-num">2</span> <strong>Digite sua senha</strong> — Informe a senha fornecida.</div>
  <div class="step-item"><span class="step-num">3</span> <strong>Clique em Entrar</strong> — Acesse o painel do sistema.</div>
</div>

<h2><span class="section-num">2</span>Passo 1 — Cadastrar Clientes</h2>
<p>O primeiro passo é cadastrar as empresas (clientes) da sua contabilidade com CNPJ, razão social e dados de localização.</p>
<img src="${IMAGES.clientes}" alt="Cadastro de clientes" style="width:100%; border:1px solid #e5e7eb; border-radius:8px; margin:12px 0;" />
<div class="steps">
  <div class="step-item"><span class="step-num">1</span> <strong>Clique em '+ Novo Cliente'</strong> — Botão no canto superior direito.</div>
  <div class="step-item"><span class="step-num">2</span> <strong>Preencha os dados</strong> — Razão Social, CNPJ, Cidade, UF e Inscrição Municipal.</div>
  <div class="step-item"><span class="step-num">3</span> <strong>Clique em 'Salvar Cliente'</strong> — O cliente será adicionado à lista.</div>
</div>

<h2><span class="section-num">3</span>Passo 2 — Upload de Certificados (.pfx)</h2>
<p>Faça o upload dos certificados digitais A1 (arquivo .pfx) de cada empresa para autenticar na API Nacional da NFSe.</p>
<img src="${IMAGES.certificados}" alt="Upload de certificados" style="width:100%; border:1px solid #e5e7eb; border-radius:8px; margin:12px 0;" />
<div class="steps">
  <div class="step-item"><span class="step-num">1</span> <strong>Clique em '+ Novo Certificado'</strong></div>
  <div class="step-item"><span class="step-num">2</span> <strong>Selecione o cliente</strong> no dropdown</div>
  <div class="step-item"><span class="step-num">3</span> <strong>Faça upload do .pfx</strong> — Arraste ou clique para selecionar</div>
  <div class="step-item"><span class="step-num">4</span> <strong>Informe a senha</strong> do certificado digital</div>
</div>
<div class="warning"><strong>Atenção:</strong> Certificados vencidos são ignorados durante downloads. Monitore a validade!</div>

<img src="${IMAGES.validade}" alt="Validade de certificados" style="width:100%; border:1px solid #e5e7eb; border-radius:8px; margin:12px 0;" />
<p style="text-align:center; font-size:11px; color:#6b7280;">Painel de Validade — Monitore certificados válidos, próximos do vencimento e vencidos</p>

<h2><span class="section-num">4</span>Passo 3 — Baixar Notas Fiscais</h2>
<p>Com clientes e certificados cadastrados, acesse <strong>Downloads</strong> para buscar e baixar XMLs e PDFs.</p>
<img src="${IMAGES.downloads}" alt="Tela de downloads" style="width:100%; border:1px solid #e5e7eb; border-radius:8px; margin:12px 0;" />
<div class="steps">
  <div class="step-item"><span class="step-num">1</span> <strong>Escolha o tipo</strong> — 'Somente novas' ou 'Por período'</div>
  <div class="step-item"><span class="step-num">2</span> <strong>Defina o período</strong> — Data Inicial e Data Final (ex: 01/02/2026 a 10/02/2026)</div>
  <div class="step-item"><span class="step-num">3</span> <strong>Selecione empresas</strong> — Marque as checkboxes desejadas</div>
  <div class="step-item"><span class="step-num">4</span> <strong>Ou baixe individual</strong> — Botão 'Baixar' na linha da empresa</div>
  <div class="step-item"><span class="step-num">5</span> <strong>Execute</strong> — 'Baixar Todas', 'Baixar Selecionadas' ou 'ZIP Todas'</div>
</div>
<table>
  <tr><th>Ação</th><th>Descrição</th></tr>
  <tr><td>Baixar Todas</td><td>Processa todas as empresas com certificado válido</td></tr>
  <tr><td>Baixar Selecionadas</td><td>Processa apenas as empresas marcadas</td></tr>
  <tr><td>ZIP por Empresa</td><td>Gera ZIP com XMLs e PDFs de uma empresa</td></tr>
  <tr><td>ZIP Todas</td><td>Gera ZIP com todas as empresas em pastas separadas</td></tr>
  <tr><td>Parar</td><td>Interrompe o download em andamento</td></tr>
</table>

<h2><span class="section-num">5</span>Passo 4 — Acompanhar Histórico</h2>
<p>A tela de <strong>Histórico de Downloads</strong> exibe o registro de todos os downloads com detalhes por empresa.</p>
<img src="${IMAGES.historico}" alt="Histórico de downloads" style="width:100%; border:1px solid #e5e7eb; border-radius:8px; margin:12px 0;" />
<table>
  <tr><th>Coluna</th><th>O que mostra</th></tr>
  <tr><td>Data</td><td>Data e hora do download</td></tr>
  <tr><td>Empresa</td><td>Nome da empresa</td></tr>
  <tr><td>Total Notas</td><td>Notas encontradas na API</td></tr>
  <tr><td>XMLs</td><td>XMLs salvos com sucesso</td></tr>
  <tr><td>PDFs</td><td>DANFSe baixados com sucesso</td></tr>
  <tr><td>Erros PDF</td><td>PDFs que falharam</td></tr>
  <tr><td>Status</td><td>Executando, Concluído, Erro ou Cancelado</td></tr>
</table>
<p>Use os botões <strong>"Relatório PDF"</strong> e <strong>"Relatório Excel"</strong> para exportar o histórico.</p>

<h2><span class="section-num">6</span>Passo 5 — Baixar no Formato ZIP</h2>
<p>Gere arquivos ZIP com XMLs e PDFs organizados por empresa em pastas separadas.</p>
<img src="${IMAGES.zip}" alt="Opções de ZIP" style="width:100%; border:1px solid #e5e7eb; border-radius:8px; margin:12px 0;" />
<table>
  <tr><th>Opção</th><th>Descrição</th></tr>
  <tr><td>ZIP por Empresa</td><td>Gera ZIP com XMLs e PDFs de uma empresa específica</td></tr>
  <tr><td>ZIP Todas</td><td>Gera ZIP com todas as empresas em pastas separadas</td></tr>
</table>
<div class="tip"><strong>Estrutura do ZIP:</strong> Cada empresa fica em uma pasta separada com seus XMLs e PDFs.</div>

<h2><span class="section-num">7</span>Notas Fiscais</h2>
<p>Visualize todas as notas já baixadas com filtros por cliente e período.</p>
<img src="${IMAGES.notas}" alt="Notas fiscais" style="width:100%; border:1px solid #e5e7eb; border-radius:8px; margin:12px 0;" />

<h2><span class="section-num">8</span>Agendamentos Automáticos</h2>
<p>Configure downloads automáticos: nome, frequência (diário/semanal/mensal), horário e empresas.</p>

<h2><span class="section-num">9</span>Configurações</h2>
<table>
  <tr><th>Aba</th><th>Descrição</th></tr>
  <tr><td>Geral</td><td>Tentativas de PDF, timeout e opções operacionais</td></tr>
  <tr><td>Usuários</td><td>Criar, editar contas e definir permissões</td></tr>
  <tr><td>Auditoria</td><td>Registro de todas as ações realizadas</td></tr>
</table>

<h2><span class="section-num">10</span>Dicas e Boas Práticas</h2>
<ul>
  <li>Mantenha os certificados digitais sempre atualizados</li>
  <li>Use "Somente novas" para downloads diários — é mais rápido</li>
  <li>Configure agendamentos automáticos para não esquecer</li>
  <li>Gere ZIPs periódicos para backup local</li>
  <li>Verifique o Histórico regularmente para identificar erros</li>
  <li>Use permissões granulares para controlar acesso</li>
</ul>
`;
}

// =============================================
// PÁGINA PRINCIPAL DE AJUDA
// =============================================
export default function Ajuda() {
  const [generatingPdf, setGeneratingPdf] = useState<string | null>(null);

  const handleDownloadPdf = async () => {
    setGeneratingPdf("usuario");
    try {
      const content = getUsuarioHtml();
      
      const htmlContent = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Manual do Usuário — Pegasus</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1a1a1a; line-height: 1.6; padding: 40px; max-width: 800px; margin: 0 auto; }
    h1 { font-size: 28px; color: #1e3a5f; margin-bottom: 8px; text-align: center; }
    h2 { font-size: 20px; color: #1e3a5f; margin-top: 32px; margin-bottom: 12px; padding-bottom: 6px; border-bottom: 2px solid #e5e7eb; }
    h3 { font-size: 16px; color: #374151; margin-top: 20px; margin-bottom: 8px; }
    p { margin-bottom: 10px; font-size: 13px; }
    img { max-width: 100%; height: auto; }
    .subtitle { text-align: center; color: #6b7280; font-size: 16px; margin-bottom: 4px; }
    .version { text-align: center; color: #9ca3af; font-size: 12px; margin-bottom: 32px; }
    .flow-box { background: #eff6ff; border: 2px solid #bfdbfe; border-radius: 12px; padding: 20px; margin: 20px 0; }
    .flow-steps { display: flex; align-items: center; justify-content: center; gap: 8px; flex-wrap: wrap; }
    .flow-step { background: white; border-radius: 8px; padding: 10px 14px; text-align: center; font-size: 12px; min-width: 120px; border: 1px solid #e5e7eb; }
    .flow-num { display: inline-block; width: 24px; height: 24px; border-radius: 50%; color: white; text-align: center; line-height: 24px; font-size: 12px; font-weight: bold; margin-bottom: 4px; }
    .flow-arrow { font-size: 20px; color: #9ca3af; }
    .steps { background: #f8fafc; border-radius: 8px; padding: 16px; margin: 12px 0; }
    .step-item { padding: 6px 0; font-size: 13px; }
    .step-num { display: inline-block; background: #3b82f6; color: white; width: 22px; height: 22px; border-radius: 50%; text-align: center; line-height: 22px; font-size: 11px; font-weight: bold; margin-right: 8px; }
    .tip { background: #eff6ff; border: 1px solid #bfdbfe; padding: 10px 14px; border-radius: 6px; margin: 12px 0; font-size: 12px; }
    .warning { background: #fef2f2; border: 1px solid #fecaca; padding: 10px 14px; border-radius: 6px; margin: 12px 0; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 12px; }
    th { background: #f1f5f9; text-align: left; padding: 8px 12px; border: 1px solid #e2e8f0; font-weight: 600; }
    td { padding: 8px 12px; border: 1px solid #e2e8f0; }
    ul { margin: 8px 0 8px 20px; font-size: 13px; }
    li { margin-bottom: 4px; }
    .section-num { display: inline-block; background: #1e3a5f; color: white; width: 24px; height: 24px; border-radius: 50%; text-align: center; line-height: 24px; font-size: 12px; font-weight: bold; margin-right: 8px; }
    @media print { body { padding: 20px; } img { max-width: 100%; page-break-inside: avoid; } .flow-box { page-break-inside: avoid; } }
  </style>
</head>
<body>
${content}
</body>
</html>`;

      const blob = new Blob([htmlContent], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      
      // Abrir em nova janela para impressão como PDF
      const printWindow = window.open(url, "_blank");
      if (printWindow) {
        printWindow.onload = () => {
          setTimeout(() => {
            printWindow.print();
          }, 1000);
        };
      }
      
      // Também oferecer download do HTML
      const link = document.createElement("a");
      link.href = url;
      link.download = "Manual_Usuario_Pegasus.html";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Erro ao gerar PDF:", err);
    } finally {
      setGeneratingPdf(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <HelpCircle className="h-6 w-6 text-primary" />
              Ajuda — Manual do Usuário
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Guia ilustrado de utilização do sistema Pegasus com passo a passo de cada funcionalidade.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadPdf}
            disabled={generatingPdf !== null}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            {generatingPdf ? "Gerando..." : "Baixar Manual (PDF)"}
          </Button>
        </div>

        {/* Manual do Usuário */}
        <ManualUsuario />
      </div>
    </DashboardLayout>
  );
}
