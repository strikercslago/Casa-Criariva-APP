# Revisão de alunos — 22/10/2026

## Correções locais

- Logo oficial fornecida pelo usuário; paleta azul, turquesa, amarelo e rosa.
- Ativar/desativar/restaurar aparecem diretamente na ficha. Arquivar permanece em Mais opções.
- Editar dados de um arquivado preserva o status e a data de arquivamento. Antes, o formulário enviava active com archived_at preenchido e violava students_archive_consistency.
- Atualização da consulta em segundo plano não deve apagar um nome durante a edição.
- Autocorreção desativada no nome. Não há filtro de letras no formulário, Zod ou constraint do banco. Y e acentos são aceitos nos testes.
- Aviso de nome já existente inclui arquivados; homônimos podem ser confirmados sem impor unicidade por nome.
- Bloqueio síncrono de submissões simultâneas; mesma chave de requisição nas tentativas do mesmo formulário.

## Banco: aplicação pendente

Aplicar `supabase/migrations/20261022170000_student_lifecycle_and_enrollment_retries.sql` em ambiente de homologação e depois no Supabase vinculado, com acesso administrativo autorizado. Não foi aplicada nesta sessão: não há CLI/conexão administrativa configurada, apenas URL e chave pública do frontend.

A migração permite a professores manter dados/status de alunos e fazer cadastro básico via RPC, sem conceder acesso financeiro ou a responsáveis. Preserva o fluxo completo de owner/admin. Uma tabela privada e um lock transacional deduplicam tentativas por usuário + request_id. A função anterior fica interna sem EXECUTE para authenticated/anon. Clientes antigos sem request_id continuam compatíveis, mas não recebem proteção contra repetição. Mudanças de status passam a ter auditoria.

Verificar no banco: teacher ativo pode criar cadastro básico, editar nome, ativar/desativar, arquivar/restaurar; teacher inativo e anon são rejeitados; teacher não pode enviar guardians/class/billing_plan; duas requisições concorrentes com a mesma chave retornam o mesmo ID; chaves de usuários diferentes não compartilham resultados; owner/admin continuam criando matrícula completa. Testes unitários não comprovam execução/RLS no banco remoto.

## Duplicidades observadas (consulta somente leitura)

Foram observadas três fichas com o mesmo nome: uma ativa e duas arquivadas. Duas compartilham a data de nascimento, mas têm datas de matrícula e vínculos diferentes. Isso é evidência de fichas distintas possivelmente da mesma pessoa, não de duplicação visual da listagem. Nomes e identificadores dos alunos foram omitidos deste relatório versionado.

Não há evidência suficiente para atribuir a origem exata a clique duplo, reenvio após timeout ou recadastro manual. O código antigo tinha uma vulnerabilidade real: withTimeout usa Promise.race e não cancela a transação remota; um novo envio à RPC criava outro aluno sem chave de idempotência. Não havia alerta de aluno já cadastrado. Os históricos exibidos não oferecem logs de requisição suficientes para demonstrar que isso gerou essas fichas específicas.

Não excluir nem mesclar automaticamente: fichas têm vínculos de responsáveis, frequência, turmas e possivelmente pagamentos. Revisar as relações antes de definir a ficha principal. Nenhum cadastro real foi alterado nesta investigação.

## Limites do status

Alterar o status do cadastro não encerra matrículas em turmas nem cancela mensalidades. Essas operações continuam em seus módulos próprios.
