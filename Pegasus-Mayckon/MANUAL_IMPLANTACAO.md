# Manual de Implantação - Pegasus (Gestão NFSe e CT-e)

## Requisitos da VPS

| Requisito | Versão Mínima |
|-----------|---------------|
| Ubuntu | 20.04+ |
| Node.js | 18+ (recomendado 22) |
| MySQL | 8.0+ |
| pnpm | 10+ |
| RAM | 2 GB mínimo |
| Disco | 10 GB mínimo |

---

## 1. Instalar Node.js e pnpm

```bash
# Instalar Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# Instalar pnpm
npm install -g pnpm
```

---

## 2. Instalar e Configurar MySQL

```bash
# Instalar MySQL
sudo apt-get install -y mysql-server

# Acessar MySQL como root
sudo mysql

# Dentro do MySQL, executar:
CREATE DATABASE pegasus CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'pegasus_user'@'localhost' IDENTIFIED BY 'SUA_SENHA_FORTE';
GRANT ALL PRIVILEGES ON pegasus.* TO 'pegasus_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

---

## 3. Enviar o Projeto para a VPS

```bash
# Na sua máquina local, enviar o ZIP para a VPS:
scp Pegasus-Final.zip root@SEU_IP:/root/

# Na VPS, extrair:
cd /root
unzip Pegasus-Final.zip
cd Pegasus-Mayckon
```

---

## 4. Configurar Variáveis de Ambiente

```bash
# Copiar o exemplo e editar:
cp .env.example .env
nano .env
```

**Preencher o `.env` com seus dados:**

```env
DATABASE_URL=mysql://pegasus_user:SUA_SENHA_FORTE@localhost:3306/pegasus
NODE_ENV=development
PORT=3000
JWT_SECRET=troque-por-uma-chave-secreta-forte-e-unica
```

> **IMPORTANTE:** Troque `SUA_SENHA_FORTE` pela senha que você definiu no MySQL e `JWT_SECRET` por uma string aleatória longa.

---

## 5. Instalar Dependências

```bash
pnpm install
```

---

## 6. Criar as Tabelas no Banco

```bash
pnpm db:push
```

> Esse comando gera e executa as migrações do Drizzle ORM, criando todas as tabelas automaticamente.

---

## 7. Iniciar o Sistema

**Modo desenvolvimento (recomendado para testes):**

```bash
PORT=3000 pnpm dev
```

**Modo produção:**

```bash
pnpm build
PORT=3000 pnpm start
```

---

## 8. Manter o Sistema Rodando (PM2)

```bash
# Instalar PM2
npm install -g pm2

# Iniciar com PM2 (modo desenvolvimento):
pm2 start "PORT=3000 pnpm dev" --name pegasus

# Ou modo produção (após pnpm build):
pm2 start "PORT=3000 pnpm start" --name pegasus

# Salvar para reiniciar automaticamente após reboot:
pm2 save
pm2 startup
```

---

## 9. Acessar o Sistema

Abra o navegador e acesse:

```
http://SEU_IP:3000
```

**Credenciais padrão do admin (criadas automaticamente):**

| Campo | Valor |
|-------|-------|
| Email | pegasus@lan7.com.br |
| Senha | g08120812 |

> O admin é criado automaticamente na primeira execução.

---

## 10. Configurar Nginx (Opcional - Domínio com HTTPS)

```bash
sudo apt-get install -y nginx certbot python3-certbot-nginx

# Criar configuração do Nginx:
sudo nano /etc/nginx/sites-available/pegasus
```

**Conteúdo do arquivo:**

```nginx
server {
    listen 80;
    server_name seudominio.com.br;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        client_max_body_size 50M;
    }
}
```

```bash
# Ativar o site:
sudo ln -s /etc/nginx/sites-available/pegasus /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# Gerar certificado SSL (HTTPS):
sudo certbot --nginx -d seudominio.com.br
```

---

## Estrutura de Armazenamento

Os arquivos (XMLs, PDFs, ZIPs) são salvos localmente na pasta `pegasus_storage/` dentro do diretório do projeto. Essa pasta é criada automaticamente na primeira execução.

```
Pegasus-Mayckon/
├── pegasus_storage/    ← Arquivos salvos aqui (XMLs, PDFs, ZIPs)
├── server/             ← Código do backend
├── client/             ← Código do frontend
├── drizzle/            ← Schema do banco de dados
├── .env                ← Configurações
└── package.json
```

---

## Comandos Úteis

| Comando | Descrição |
|---------|-----------|
| `pnpm dev` | Inicia em modo desenvolvimento |
| `pnpm build` | Compila para produção |
| `pnpm start` | Inicia em modo produção |
| `pnpm db:push` | Cria/atualiza tabelas no banco |
| `pm2 logs pegasus` | Ver logs do sistema |
| `pm2 restart pegasus` | Reiniciar o sistema |
| `pm2 stop pegasus` | Parar o sistema |

---

## Solução de Problemas

**Erro de conexão com o banco:**
- Verifique se o MySQL está rodando: `sudo systemctl status mysql`
- Verifique a `DATABASE_URL` no `.env`

**Porta já em uso:**
- Verifique: `netstat -tlnp | grep 3000`
- Mate o processo: `kill -9 PID`

**Erro de permissão:**
- Verifique permissões da pasta: `chmod -R 755 /root/Pegasus-Mayckon`

**Tabelas não existem:**
- Execute: `pnpm db:push`
