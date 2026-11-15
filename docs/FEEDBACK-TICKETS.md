# Ideias e chamados

Rota: `/ideias`. Disponível para contas ativas de professor, admin e owner.

- Usuários registram sugestão, problema/erro ou melhoria com título e descrição.
- Professores consultam apenas seus chamados. Admin e owner consultam todos, respondem e alteram a situação.
- Situações: aberto, em análise, planejado, concluído e não previsto.
- Respostas são consultadas na ficha; não há envio de e-mail ou notificação externa.
- A listagem tem filtro de situação, filtro de autoria para gestores e paginação de 12 itens.
- O texto é renderizado como texto simples. Campos possuem limites no frontend e no banco.
- Um UUID por formulário evita duplicação ao repetir um envio após perda de resposta. O mesmo formulário reutiliza a chave. Recarregar/fechar a página inicia outro formulário.
- Não há exclusão de chamados nem edição do relato original. A resposta administrativa é o retorno atual, não uma conversa com múltiplas mensagens.

## Ativação pendente no Supabase

Aplicar `supabase/migrations/20261109180000_feedback_tickets.sql` com acesso administrativo ao projeto. Esta sessão não possui CLI ou conexão administrativa e não aplicou a migração. Sem ela, a tela informa que o espaço ainda não foi habilitado; nenhum sucesso é simulado ou salvo apenas no navegador.

As escritas usam RPCs com autorização no banco. A autoria vem da sessão autenticada e o nome do perfil. A tabela concede somente SELECT ao cliente; RLS limita a leitura ao autor ou gestão. Contas inativas e anônimas não acessam. Apenas owner/admin ativos podem responder. O usuário não escolhe autor, protocolo nem situação inicial.

Após aplicar, validar com contas de teste: criar e reabrir após recarregar; professor A não enxerga registro de B; A não consegue chamar a RPC de resposta; admin responde e A consulta a resposta; conta inativa/anônima não lê nem escreve; repetição concorrente do mesmo UUID retorna um só registro; tentativa de reutilizar UUID alheio falha. Os testes locais simulam a API e não comprovam as políticas no Supabase remoto.
