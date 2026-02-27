# 🚀 Guia de Deploy — Pegasus-Mayckon em VPS Ubuntu

Guia completo para colocar a aplicação em produção usando Docker.

---

## 📋 Requisitos

| Item | Mínimo |
|------|--------|
| **OS** | Ubuntu 22.04 ou 24.04 LTS |
| **RAM** | 2 GB (recomendado 4 GB) |
| **Disco** | 20 GB livres |
| **Acesso** | SSH com usuário `root` ou `sudo` |

---

## 1. Atualizar o sistema

```bash
sudo apt update && sudo apt upgrade -y
```

## 2. Instalar Docker e Docker Compose

```bash
# Instalar dependências
sudo apt install -y ca-certificates curl gnupg lsb-release

# Adicionar chave GPG oficial do Docker
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Adicionar repositório
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Instalar Docker Engine + Compose plugin
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Permitir uso sem sudo (opcional)
sudo usermod -aG docker $USER
newgrp docker

# Verificar instalação
docker --version
docker compose version
```

## 3. Configurar Firewall (UFW)

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

> [!WARNING]
> A porta `3306` do MySQL **não** é exposta externamente — o `docker-compose.yml` não publica essa porta. Se a VPS já tiver outro MySQL rodando, não haverá conflito. Se quiser acesso externo ao banco para administração, use um túnel SSH.

## 4. Clonar o repositório

```bash
cd /opt
sudo git clone https://github.com/SEU_USUARIO/Pegasus-Mayckon.git pegasus
cd pegasus
sudo chown -R $USER:$USER .
```

## 5. Configurar variáveis de ambiente

```bash
cp .env.example .env
nano .env
```

Preencha os valores obrigatórios:

```env
# Banco de dados
DATABASE_URL=mysql://pegasus:SuaSenhaForte123@db:3306/pegasus
MYSQL_ROOT_PASSWORD=SenhaRootForte456
MYSQL_DATABASE=pegasus
MYSQL_USER=pegasus
MYSQL_PASSWORD=SuaSenhaForte123

# Autenticação
JWT_SECRET=gere-uma-string-aleatoria-com-64-caracteres

# Aplicação
NODE_ENV=production
PORT=3000
```

> [!TIP]
> Gere um JWT_SECRET seguro com: `openssl rand -hex 32`

## 6. Build e inicialização

```bash
# Build da imagem (primeira vez pode demorar ~5 min)
docker compose build

# Iniciar os serviços em background
docker compose up -d

# Verificar se estão rodando
docker compose ps
```

Aguarde o MySQL ficar saudável (healthcheck). Acompanhe com:

```bash
docker compose logs -f
```

## 7. Executar migrations do banco de dados

```bash
# Gerar e aplicar as migrations do Drizzle (use pnpm db:push, não npx drizzle-kit migrate)
docker compose exec app pnpm db:push
```

A saída esperada ao final é:
```
[✓] migrations applied successfully!
```

> [!IMPORTANT]
> Use **`pnpm db:push`** e não `npx drizzle-kit migrate` diretamente. O comando `npx` pode rodar silenciosamente sem aplicar nada. Execute este comando sempre que houver novas migrations após atualização do código.

## 8. Reiniciar o app para criar o admin

O seed do admin roda automaticamente 2 segundos após o servidor iniciar. Como ele executa **antes** das migrations na primeira vez, é necessário reiniciar o container após aplicar as migrations:

```bash
docker compose restart app

# Verificar se o admin foi criado
docker compose logs app --tail 10
```

Procure pela mensagem: `[Seed] Admin criado: pegasus@lan7.com.br`

> [!NOTE]
> Credenciais do administrador padrão:
> - **E-mail:** `pegasus@lan7.com.br`
> - **Senha:** `g08120812`

## 9. Verificar funcionamento

```bash
# A aplicação deve responder na porta 3000
curl http://localhost:3000
```

Se tudo estiver correto, você verá o HTML da aplicação.

---

## 10. Configurar Nginx como Reverse Proxy

```bash
sudo apt install -y nginx
```

Crie o arquivo de configuração:

```bash
sudo nano /etc/nginx/sites-available/pegasus
```

Conteúdo:

```nginx
server {
    listen 80;
    server_name seu-dominio.com.br;

    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }
}
```

Ativar o site:

```bash
sudo ln -s /etc/nginx/sites-available/pegasus /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

## 11. Configurar HTTPS com Let's Encrypt

```bash
sudo apt install -y certbot python3-certbot-nginx

sudo certbot --nginx -d seu-dominio.com.br

# Renovação automática (já configurada pelo certbot)
sudo certbot renew --dry-run
```

---

## 🔧 Manutenção

### Ver logs da aplicação

```bash
docker compose logs -f app
```

### Reiniciar serviços

```bash
docker compose restart
```

### Atualizar a aplicação

```bash
cd /opt/pegasus
git pull origin main
docker compose build
docker compose up -d
docker compose exec app pnpm db:push
docker compose restart app
```

### Backup do banco de dados

```bash
# Criar backup
docker compose exec db mysqldump -u root -p${MYSQL_ROOT_PASSWORD} pegasus > backup_$(date +%Y%m%d_%H%M%S).sql

# Restaurar backup
cat backup_XXXXXXXX_XXXXXX.sql | docker compose exec -T db mysql -u root -p${MYSQL_ROOT_PASSWORD} pegasus
```

### Agendar backup automático (cron)

```bash
crontab -e
```

Adicione (backup diário às 3h da manhã):

```
0 3 * * * cd /opt/pegasus && docker compose exec -T db mysqldump -u root -p$(grep MYSQL_ROOT_PASSWORD .env | cut -d= -f2) pegasus > /opt/pegasus/backups/backup_$(date +\%Y\%m\%d).sql 2>/dev/null
```

```bash
mkdir -p /opt/pegasus/backups
```

### Limpar imagens Docker não utilizadas

```bash
docker system prune -af
```

---

## ❓ Resolução de Problemas

| Problema | Solução |
|----------|---------|
| `port is already allocated` na porta 3306 | O `docker-compose.yml` não deve expor a porta 3306. Confirme que não há `ports:` no serviço `db` |
| Container do app reiniciando em loop | Execute `docker compose logs app` — geralmente é `DATABASE_URL` incorreto ou migrations não aplicadas |
| `drizzle-kit migrate` não mostra output | Use `pnpm db:push` em vez de `npx drizzle-kit migrate` |
| Login com admin não funciona | Execute `docker compose restart app` após as migrations para o seed criar o usuário |
| `JWSSignatureVerificationFailed` nos logs | Normal ao trocar de JWT_SECRET — basta fazer logout/login no navegador |
| Build falha no `canvas` | Verifique se o Dockerfile tem `cairo-dev`, `pango-dev`, `jpeg-dev`, `giflib-dev`, `librsvg-dev` |
| Migrations falham | Verifique se o MySQL está healthy: `docker compose ps` |
| Erro de permissão na VPS | `sudo chown -R $USER:$USER /opt/pegasus` |
