# Revisão de engenharia — 15/11/2026

## Escopo e evidências

Auditoria local e melhorias incrementais no `Casa-Criariva-APP`. As alterações
anteriores (menu, chamados e remoção de módulos) já estavam no diretório de
trabalho e foram preservadas. Nenhum commit, push, deploy, exclusão de dados ou
comando contra produção foi executado. Não foram instaladas dependências.

Stack conferida em `package.json`: React 18, TypeScript 5.6 strict, Vite 6,
React Router 7, TanStack Query 5, Supabase JS 2, Zod 3, Tailwind 3, Vitest 3 e
Playwright 1.55. Código organizado por domínio em `features`, infraestrutura em
`app`/`lib` e componentes compartilhados em `shared`. Essa estrutura foi mantida;
não houve justificativa para introduzir microsserviços ou novas camadas.

O shell e as rotas usam permissões de owner/admin/teacher. APIs de domínio usam
REST/RPC do Supabase; hooks coordenam cache; formulários usam React Hook Form/Zod.
RPCs de matrícula, frequência e pagamentos concentram operações de negócio.
Valores financeiros e limites de capacidade devem continuar sendo decididos no
banco, não por contadores ou arredondamentos da interface.

## Base inicial

- TypeScript e ESLint aprovados.
- 91 testes unitários aprovados.
- Build aprovado; pacote inicial de 511,22 kB (154,12 kB gzip), com aviso de tamanho.
- Suíte E2E completa: 28 aprovados e sete falhas preexistentes. As falhas eram
  controles antigos de frequência/pagamento, links sem escopo, seletores de
  conteúdo oculto na versão responsiva e ações de aluno dentro de `details` fechado.
- Não foi identificado ambiente PostgreSQL/Supabase CLI/Docker disponível para
  executar migrações, testar RLS ou realizar transações reais.

## Correções implementadas

| Prioridade | Evidência e impacto | Correção e validação | Esforço / risco |
| --- | --- | --- | --- |
| P1 | `AuthProvider.tsx`: resultado tardio de `getSession` substituía SIGNED_OUT ou SIGNED_IN mais recente. Estado local podia voltar a autenticado após saída ou perder um login válido. Não demonstra bypass do backend. | Eventos recentes prevalecem sobre bootstrap atrasado; callback ignora desmontagem. Dois testes reproduziram o problema antes da correção. | Pequeno / médio, autenticação |
| P1 | `billingApi.ts/registerPayment`: resposta nula/vazia era convertida em pagamento fictício com `payment_id: ''`, acionando sucesso sem confirmação. | Exige identificador e mensalidade correspondente; informa incerteza e orienta conferir histórico. Sem retry de escrita. Três casos reproduziram falso sucesso; testes incluem resposta válida e permissão negada. | Pequeno / médio, confirmação financeira |
| P2 | `queryClient.ts`: somente objetos Response 4xx eram permanentes; AppError e erros PostgREST de permissão/validação eram repetidos. HTTP 429 não recebia retry. | Política compartilhada reconhece erros permanentes e abortos, limita falhas transitórias a duas repetições e mantém mutations sem retry. Testes de oito cenários; chamados sem tabela recebem erro de configuração. | Pequeno / baixo |
| P2 | `authDiagnostics.ts`: apesar do nome sanitize, copiava texto integral de erros para logs de desenvolvimento. Texto pode conter e-mail ou credenciais. | Omite mensagem bruta; mantém nome/código/status e indicador de mensagem. Dois testes com dados fictícios sensíveis. Não afirma sanitização universal de todos os logs. | Pequeno / baixo |
| P2 | Sete testes E2E desatualizados impediam verificar jornadas completas. | Seletores por região/visibilidade, rótulos atuais e helper para seção em select mobile ou botão desktop. Mantidas verificações de negócio, pagamentos, transferência, fotos e restauração. | Médio / baixo |
| P2 | Não havia `.github/workflows`; checks dependiam de execução manual. | Workflow sem deploy, com `contents: read`, lockfile, tipos, lint, unitários, build e E2E. Chave fictícia para fixtures. Preparado localmente, execução no GitHub ainda pendente. | Pequeno / baixo |
| P2 | `.gitignore` não cobria `.env` nem a pasta de dumps mencionada no runbook. | Ignora arquivos de ambiente e `backups/`, preservando `.env.example`. Não remove arquivos já rastreados. | Pequeno / baixo |
| P2 | DEVELOPMENT descrevia apenas fases iniciais; ARCHITECTURE/PERMISSIONS listavam módulos removidos; BACKUP negava uso de Storage. | Documentação reconciliada; registros históricos de segurança explicitamente separados de validação atual. | Pequeno / baixo |

## Backlog priorizado e condições de validação

### P1 — troca de papel administrativo não é atômica

Evidência: `supabase/functions/admin-users/index.ts`, ações `invite` e `set-role`,
fazem DELETE e INSERT em `user_roles` separadamente; o erro do DELETE é ignorado.
Se DELETE falhar e INSERT funcionar, a resposta pode anunciar apenas o novo papel
embora o antigo permaneça. Se DELETE funcionar e INSERT falhar, o usuário pode
ficar sem papel. Inserção de auditoria também não tem o erro verificado.

Correção proposta: RPC transacional autenticada como owner ativo, validando alvo,
substituindo papéis e registrando auditoria na mesma transação. Preservar o último
owner ativo e validar concorrência também com desativação e alterações diretas.
Convites do Auth são uma operação externa: exigem estratégia explícita para
falha parcial, não promessa de transação única com envio de e-mail.

Esforço médio / risco alto. Antes de publicação: testes reais de rollback por
falha de INSERT/auditoria, manutenção do mesmo papel, promoção/rebaixamento,
owner inativo, admin/teacher/anon negados e remoção concorrente dos últimos owners.
Requer revisão humana de segurança e ambiente isolado. Código remoto não alterado.

### P1 — confirmar migrações e regras no ambiente real

Os arquivos `20261022170000_student_lifecycle_and_enrollment_retries.sql` e
`20261109180000_feedback_tickets.sql` existem localmente; aplicação remota continua
desconhecida. Sem o primeiro, professores e retries de matrícula podem divergir
da experiência esperada. Sem o segundo, chamados permanecem indisponíveis.

Esforço médio / risco alto. Comparar histórico remoto, testar matriz de acesso,
concorrência e rollback em homologação. Não criar unicidade por nome nem unir
cadastros. As duplicidades históricas não foram reconsultadas nesta auditoria;
causa exata não pode ser atribuída sem evidência de requisições/dados.

### P1 — idempotência financeira após resposta incerta

`registerPayment` envia amount/monthly_fee_id sem chave de requisição. Mutations
não repetem automaticamente, mas reenvio manual após timeout merece teste real.
O lock e a verificação de saldo documentados não equivalem à deduplicação: duas
parcelas iguais podem caber no saldo. Não foi observado pagamento duplicado real.

Esforço médio / risco alto. Projetar identificador persistente por intenção de
pagamento, registro transacional e tratamento de payload incompatível com chave
reutilizada; validar resposta perdida e chamadas concorrentes sem impedir dois
pagamentos legítimos iguais. A correção local de confirmação não resolve isso.

### P2 — observabilidade, recuperação e capacidade

- `reportError` não tem destino remoto em produção. Definir indicadores/alertas
  com responsável e ferramenta adequada antes de adicionar infraestrutura.
- Validar backup de schema, dados, Auth e objetos do bucket privado de fotos;
  ensaiar restauração isolada. Nenhum backup/restauro foi executado.
- O bundle continua acima de 500 kB e a logo oficial tem aproximadamente 908 kB.
  Não houve otimização de performance nesta etapa nem alteração da imagem aprovada.
  Medir carregamento em dispositivos reais antes de decidir particionamento ou
  compressão. Não há p95/p99, carga concorrente ou EXPLAIN do banco remoto.
- `admin-users` lista somente a primeira página de até 1000 usuários. Paginação
  passa a ser necessária se esse limite se aproximar; não há evidência disso hoje.

## Validação e limites

Resultado final: TypeScript e ESLint aprovados; 108 testes unitários em 47 arquivos
aprovados; build aprovado. Após a última correção de confirmação de pagamento,
o cenário E2E de mensalidades/pagamento parcial/reversão/Student 360 foi repetido
e aprovado. Bundle inicial final: 511,86 kB (154,41 kB gzip); o aviso de tamanho
permanece. `git diff --check` aprovado e exclusão de `.env`, `.env.production` e
`backups/rehearsal.sql` confirmada por `git check-ignore`.

Comandos locais: `node node_modules/typescript/bin/tsc -b`,
`node node_modules/eslint/bin/eslint.js .`, `node node_modules/vitest/vitest.mjs run`,
`node node_modules/vite/bin/vite.js build` e, com `PLAYWRIGHT_CHANNEL=chrome`,
`node node_modules/@playwright/test/cli.js test --workers=2`.

Os 35 cenários E2E passaram na suíte completa após a correção dos testes e da
autenticação/retries. Validam as cinco larguras do menu (360/390/430/768/1440),
permissões frontend, recarregamento, overflow, teclado, alterações não salvas,
matrícula, fotos, arquivamento/restauração, turmas, frequência, finanças e eventos.
Os testes usam Supabase simulado: não comprovam RLS, concorrência SQL, entregas de
e-mail, Storage remoto nem segurança de produção. A revisão foi feita pelo próprio
agente, sem revisor independente. Acessibilidade foi verificada nos aspectos
cobertos por testes; não foi realizada certificação WCAG ou auditoria completa
de leitor de tela/contraste.

O workflow será executado somente quando publicado pelo responsável. Não houve
implantação ou alteração de segredos. O próximo passo recomendado é validar os
três itens P1 de backend em ambiente isolado antes de promover mudanças remotas.
