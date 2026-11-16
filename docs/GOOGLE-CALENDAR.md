# Google Calendar — integração preparada

## Estado da entrega

Em 16/11/2026, com autorização explícita, a migração exclusiva foi aplicada em transação
no projeto Creative House e a Edge Function google-calendar foi publicada (versão 2,
incluindo criação de compromissos por professores ativos).
Os sete secrets estão cadastrados. A integração está habilitada somente no .env.local;
a configuração padrão do frontend continua desativada.

Validação remota: RLS nas três tabelas, sem SELECT para anon/authenticated; função ativa;
CORS permite http://127.0.0.1:5173; chamadas sem credenciais retornam 401 (app) ou 403
(webhook/manutenção). A conexão OAuth de uma conta Google foi confirmada no servidor.

Na última verificação, ainda pendentes: seleção da agenda, configuração
do Vault/cron, testes reais de sincronização e ativação no site publicado.
Nenhum evento real foi criado nem registro escolar alterado nesta implantação.

Modelo adotado: agenda institucional compartilhada. Owner/admin conectam e gerenciam;
professores ativos visualizam e criam compromissos na mesma agenda. Edição, exclusão e
gerenciamento da conexão permanecem restritos a owner/admin. Não há bloqueio automático
de sobreposição de horários. A interface informa esse compartilhamento antes
da conexão. A escolha de agenda pessoal por usuário exigiria outro modelo de dados.

## Arquitetura

- A aba **Aulas** preserva a agenda anterior e os vínculos de frequência.
- **Compromissos Google** é carregada sob demanda e possui dia, semana, mês,
  cadastro/edição, dia inteiro, local, categoria por cor, recorrência simples e exclusão.
- `supabase/functions/google-calendar/index.ts` inicia o handler; `handler.ts` coordena
  autorização, OAuth, operações e sincronização. `google.ts`, `crypto.ts` e `domain.ts`
  contêm transporte, criptografia e validações, respectivamente.
- A migração `20261115220000_google_calendar.sql` cria tabelas independentes para a
  conexão, estados OAuth e espelho de eventos. **Não modifica tabelas escolares**.
- As tabelas e RPCs da integração são restritas a `service_role`. O navegador acessa
  somente a Edge Function, que valida JWT, perfil ativo e papel a cada operação.
- O refresh token usa AES-256-GCM com IV aleatório e contexto autenticado. O segredo
  OAuth e a chave de criptografia ficam somente nos secrets da Edge Function.
- OAuth usa `state` aleatório, expirável e consumido atomicamente, associado ao usuário,
  e PKCE S256. O callback revalida o papel de quem iniciou a conexão.

O fluxo segue a documentação de [OAuth para aplicações web](https://developers.google.com/identity/protocols/oauth2/web-server).
Escopos: `openid`, `email`, `calendar.calendarlist.readonly` e `calendar.events`.
Não solicita gerenciamento de usuários, ACLs, contatos ou calendários. A seleção de uma
agenda limita as operações do aplicativo, mas o consentimento `calendar.events` tem o
alcance definido pelo Google; use uma conta/agenda institucional dedicada.
Veja [escopos oficiais](https://developers.google.com/workspace/calendar/api/auth).

## Sincronização e consistência

1. O espelho armazena eventos e séries sem expandir recorrências (`singleEvents=false`),
   com paginação de 250 registros. Cada execução processa até três páginas.
2. Cada página e seu cursor são confirmados na mesma transação. Uma concessão temporária
   de exclusividade impede dois sincronizadores; a geração da conexão impede gravações
   atrasadas após troca de agenda ou reconexão.
3. `nextSyncToken` só avança ao concluir a última página. Resposta 410 reinicia o espelho
   sem apagar registros escolares. Eventos ausentes após uma sincronização completa
   são marcados cancelados no espelho.
4. A visualização por período consulta o Google com `singleEvents=true`, retornando
   ocorrências já expandidas pelo provedor e paginando 100 por vez. Isso preserva as
   regras complexas e exceções de séries preexistentes sem implementar um motor RRULE.
   O espelho persistido **não é um modo offline completo da interface**.
5. O cache da interface dura 60 segundos; somente a tela aberta consulta o status a
   cada minuto, sem polling global. Uma mudança da revisão invalida os eventos visíveis.
6. O webhook valida ID, segredo aleatório e recurso do canal, marca a conexão pendente
   e responde sem interpretar seu corpo como evento. O job de manutenção consulta as
   mudanças, renova canais e faz recuperação periódica, inclusive de notificações perdidas.
7. A manutenção deve executar a cada 5 minutos. Sem notificações, a recuperação consulta
   mudanças a cada 15 minutos. Essa solução tem consistência eventual; não promete tempo real.

Referências: [sincronização incremental](https://developers.google.com/workspace/calendar/api/guides/sync),
[notificações push](https://developers.google.com/workspace/calendar/api/guides/push) e
[consulta de eventos](https://developers.google.com/workspace/calendar/api/v3/reference/events/list).

Criações usam UUID convertido em ID aceito pelo Google e fingerprint do conteúdo;
repetir o mesmo envio não cria outro evento. Editar/excluir exige ETag (`If-Match`),
com erro explícito de conflito em 412. Trocas de agenda também invalidam formulários
antigos. Requisições temporariamente falhas têm até três tentativas com backoff e jitter.
Veja [modificações condicionais](https://developers.google.com/workspace/calendar/api/guides/version-resources).

O formulário preserva os dados após falha. Edições e exclusões de recorrência se aplicam
**somente à ocorrência selecionada**; alterações da série completa ou regras complexas
são feitas pelo link para o Google Calendar. Fim de dia inteiro é exclusivo na API.
Horários usam o fuso IANA da agenda, não o fuso do navegador. Horários inexistentes ou
ambíguos em mudanças de horário de verão são rejeitados com orientação ao usuário.

## Configuração externa necessária

### Google Cloud

1. Selecione um projeto no Google Cloud e habilite **Google Calendar API**.
2. Configure a tela de consentimento no Google Auth Platform: nome do aplicativo,
   contato de suporte, público interno/externo e usuários de teste quando aplicável.
3. Cadastre os quatro escopos usados. Complete a verificação exigida pelo Google antes
   de disponibilizar publicamente. Uma aplicação em teste pode ter restrições de tokens;
   não considere esse estado uma implantação de produção.
4. Crie um cliente OAuth do tipo **Aplicativo da Web**. Guarde Client ID e Client Secret
   nos secrets do backend, nunca no `.env` do Vite, repositório ou conversa.
5. Cadastre exatamente este URI de redirecionamento, caso a função seja publicada no
   projeto atual:

   `https://baugbpqdgslfogggaqen.supabase.co/functions/v1/google-calendar/callback`

   Em homologação, substitua somente a referência do projeto pelo projeto de homologação.
   Não use `/agenda` como callback OAuth: a troca do código acontece no backend.
   O fluxo não utiliza o SDK JavaScript de login do Google; origens JavaScript não são
   usadas para trocar códigos ou armazenar credenciais no navegador.

### Secrets da Edge Function

| Nome | Valor |
| --- | --- |
| `GOOGLE_CALENDAR_CLIENT_ID` | ID do cliente OAuth Web |
| `GOOGLE_CALENDAR_CLIENT_SECRET` | Segredo desse cliente |
| `GOOGLE_CALENDAR_ENCRYPTION_KEY` | 32 bytes aleatórios codificados em Base64 |
| `GOOGLE_CALENDAR_APP_ORIGIN` | Origem exata do app, sem barra final, por exemplo `http://127.0.0.1:5173` no ambiente de desenvolvimento |
| `GOOGLE_CALENDAR_REDIRECT_URI` | URI de callback idêntico ao cadastrado no Google |
| `GOOGLE_CALENDAR_WEBHOOK_URL` | `https://baugbpqdgslfogggaqen.supabase.co/functions/v1/google-calendar/webhook`, ajustado para o projeto escolhido |
| `GOOGLE_CALENDAR_CRON_SECRET` | Segredo aleatório independente para o job de manutenção |

`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` são fornecidos pelo ambiente da função.
Para gerar cada segredo aleatório, execute em um terminal privado:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

Use valores distintos para criptografia e cron. A chave de criptografia deve ser
preservada em gerenciador de segredos; trocá-la sem recriptografar os tokens requer
nova conexão OAuth. Não imprima segredos em logs da aplicação.

### Publicação — somente após autorização

1. Aplicar **somente a nova migração desta integração** em homologação. O repositório
   tem outras migrações pendentes: não executar `db push` indiscriminadamente.
2. Configurar secrets e publicar a função `google-calendar` com a configuração versionada
   em `supabase/config.toml`. `verify_jwt=false` permite callback e webhook; a validação
   própria do handler é obrigatória e não deve ser removida.
3. Verificar que callback e webhook HTTPS estão acessíveis e cadastrar/verificar o
   domínio conforme os requisitos do Google para notificações.
4. Criar o job de manutenção abaixo; verificar retorno HTTP e execução periódica.
5. Definir `VITE_GOOGLE_CALENDAR_ENABLED=true` no ambiente do frontend e gerar novo build.
6. Entrar como owner/admin, conectar a conta, escolher uma agenda institucional e clicar
   em **Atualizar compromissos** para a primeira sincronização.
7. Executar os testes reais de aceitação antes da publicação em produção.

### Job periódico com Supabase Cron e Vault

Ative `pg_cron`, `pg_net` e Vault no projeto de homologação. Pelo gerenciador de secrets
do Vault, cadastre `google_calendar_maintenance_url` (URL HTTPS da função terminada em
`/maintenance`) e `google_calendar_cron_secret` (mesmo segredo da Edge Function).
O SQL abaixo não contém credenciais literais:

```sql
select cron.schedule(
  'google-calendar-maintenance', '*/5 * * * *',
  $job$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'google_calendar_maintenance_url'),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-Calendar-Cron', (select decrypted_secret from vault.decrypted_secrets where name = 'google_calendar_cron_secret')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 120000
    );
  $job$
);
```

Baseado no [agendamento oficial de Edge Functions](https://supabase.com/docs/guides/functions/schedule-functions).
Monitorar respostas não 2xx, atraso de `last_synced_at`, canais expirados e conexões
marcadas `reconnect`. Não registrar cabeçalhos OAuth, códigos ou payloads completos.

## Testes reproduzíveis

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm exec --yes --package=deno@2.9.6 -- deno check supabase/functions/google-calendar/index.ts
npm exec --yes --package=deno@2.9.6 -- deno test --allow-env supabase/tests/google-calendar.test.ts
npm exec --yes --package=deno@2.9.6 -- deno run --node-modules-dir=none --allow-read --allow-env supabase/tests/google-calendar-sql.ts
```

Os testes Deno usam transporte Google/Supabase simulado. O teste SQL usa PGlite em
memória, com papéis de teste, sem conexão externa ao banco. Essas ferramentas não
foram adicionadas às dependências do aplicativo.

Para o E2E Google, faça build com `VITE_GOOGLE_CALENDAR_ENABLED=true` e rode Playwright
com `GOOGLE_CALENDAR_E2E=1` e `PLAYWRIGHT_CHANNEL=chrome`. O teste é explicitamente
ignorado quando essa configuração não foi selecionada. Depois, restaure a flag do
build para o valor adequado ao ambiente. Nenhuma conta Google real é usada nos E2E.

## Aceitação real ainda pendente

- Consentimento OAuth, identificação da conta, concessões parciais e reconexão.
- Criar no app e conferir no Google; alterar/excluir no Google e conferir no app.
- Agendas e eventos preexistentes, séries com exceções, dia inteiro e fuso horário.
- Recebimento e renovação de canais HTTPS, execução do cron e recuperação sem webhook.
- Revogação na conta Google, perda de rede e submissão repetida após resposta perdida.
- Verificação de RLS e permissões da função no Supabase publicado, com cada perfil.

Sem Client ID/Secret, ambiente publicado e consentimento humano, esses testes não
podem ser considerados realizados. Nenhum desses bloqueios foi contornado com credenciais inventadas.

## Recuperação

Desabilitar a flag frontend preserva a aba Aulas. Pausar o job pelo painel Cron interrompe
a manutenção. Desconectar pelo aplicativo revoga o grant e remove o token criptografado;
não exclui compromissos do Google nem registros escolares. O espelho permanece restrito
ao backend. Não apagar tabelas ou executar rollback destrutivo como parte da recuperação.

Validação local: Deno 2.9.6; 14 testes do backend aprovados; verificações SQL isoladas aprovadas; 119 testes unitários e 39 testes E2E aprovados. O workflow de qualidade inclui esses checks, sem etapa de publicação.
