# Alteração da capacidade de uma turma

## Diagnóstico local

`mapClassesError` traduzia todo erro PostgreSQL `23505` (unicidade) como matrícula
ativa duplicada. Essa mensagem não prova que existe aluno duplicado: a alteração
de turma chama `update_class_with_schedules` e não insere matrículas.

A definição versionada dessa RPC apaga e recria todos os horários mesmo ao mudar
somente capacidade. A FK de `class_sessions.schedule_id` usa `ON DELETE SET NULL`.
Assim, aulas recorrentes viram registros sem horário de origem. Se já houver uma
ocorrência sem origem na mesma turma/data/início/fim, o índice
`class_sessions_manual_occurrence_uidx` impede a exclusão e toda a transação falha.
Mesmo sem conflito imediato, recriar IDs permite gerar novamente a ocorrência
recorrente.

Em 15/11/2026, consultas somente de leitura no SQL Editor do Supabase confirmaram:
- A função em produção ainda apaga e recria incondicionalmente os horários.
- Os índices de unicidade recorrente e manual estão presentes no servidor.
- Existem 7 pares de ocorrências recorrente/manual na mesma turma, data, início e
  fim, distribuídos por 4 turmas. A consulta retornou apenas contagens, sem dados
  pessoais. Não houve exclusão, união nem alteração de registros.

Isso confirma a condição que causa o conflito no banco. O erro bruto da requisição
da captura de tela específica ainda não foi capturado.

## Correções

- Mensagens agora distinguem conflito de matrícula, de aula e conflito não identificado.
- A migração `20261115190000_preserve_unchanged_class_schedules.sql` compara horários
  normalizados (sem depender de ordem nem de segundos omitidos no formulário).
  Se iguais, atualiza os dados da turma sem apagar horários, aulas ou frequências.
- Preserva o acesso de owner/admin ativo, validações existentes e auditoria;
  registra `class.schedule_changed` somente quando os horários mudaram.
- Não remove duplicatas existentes e não altera regras de capacidade.
- Edições que realmente mudam horários conservam a lógica anterior; uma migração
  de horários com conflito histórico exige análise separada, sem apagar presenças.

## Aplicação e validação pendentes

Em 15/11/2026, após autorização, o usuário executou manualmente o script
`APLICAR-CORRECAO-CAPACIDADE.sql` e informou o resultado “Correção aplicada”.
Isso registra a aplicação reportada pelo usuário; a alteração efetiva de capacidade
na interface ainda não teve resultado confirmado nesta conversa.
A definição efetiva da RPC já foi revisada por consulta somente de leitura.
A autorização específica para essa correção foi concedida posteriormente pelo usuário. Ao validar a
requisição, capturar apenas código e nome da constraint, sem tokens ou dados pessoais.

Em homologação: criar turma com horário e aulas; incluir uma ocorrência histórica
sem schedule_id com mesma data/horário de uma recorrente para reproduzir o conflito.
Alterar somente capacidade para 12 e verificar que os IDs de horários, aulas e
presenças permanecem iguais. Repetir com horários em outra ordem e `09:00` versus
`09:00:00`; validar owner/admin permitidos e teacher/anon negados. Testar também
edição real de horário, erros de validação e rollback sem alteração parcial.

Para recuperação, guardar a definição efetiva anterior da RPC antes de aplicar.
Restaurar essa definição se necessário; a migração não modifica dados existentes.
