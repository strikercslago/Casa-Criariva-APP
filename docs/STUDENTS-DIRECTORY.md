# Seção Alunos — atualização visual

Implementada em 15/11/2026, mantendo cabeçalho, navegação, autenticação e operações existentes.

## Interface e componentes

- `StudentsPage`: organiza resumo, busca, filtros, alternância e paginação.
- `StudentDirectory`: apresenta os mesmos resultados em cartões ou lista; reutiliza
  `StudentAvatar` (URL assinada, cache e fallback de iniciais) e `StudentStatusBadge`.
- `StudentIndicators`: contagens globais de ativos, inativos e arquivados por HEAD;
  total é a soma desses estados, respeitando a visibilidade determinada pelo servidor.
  Carregamento ou falha não são apresentados como zero.
- `StudentFilters`: pesquisa e painel recolhível de status.
- Os três pontos abrem a ficha existente com suas opções expandidas, preservando
  cadastro, edição, status, arquivamento, restauração e confirmação de arquivamento.
- Preferência cartões/lista em sessionStorage, com fallback se o armazenamento
  estiver indisponível. Alternar não muda a chave da consulta nem a paginação.

## Dados e consultas

A paginação continua no servidor (20 por página), com busca após 320 ms e cache de
90 segundos. Não há carregamento completo de cadastros nem consulta de turma por cartão.
As turmas vêm das matrículas ativas; quando há horários, o turno é derivado do início
(antes das 12h: manhã; antes das 18h: tarde; demais: noite). Sem horário não é exibido
turno; sem matrícula ativa é exibido “Sem turma vinculada”.

A busca combina nome, turma de matrícula ativa e responsável vinculado por aliases
de relacionamentos no PostgREST. Os filtros usados para buscar não restringem os
relacionamentos usados para exibir o cartão. Referência técnica:
[filtros OR em relacionamentos no PostgREST](https://docs.postgrest.org/en/latest/references/api/resource_embedding.html#null-filtering-on-embedded-resources).
O detector de nomes duplicados continua buscando somente pelo nome.

Contagens usam uma chave própria, fora do conjunto de listas de alunos, porque o
cache de fotografias atualiza as listas pelo formato StudentListResult. Criação,
conclusão de matrícula e mudanças de status invalidam também as contagens.

## Validação e limites

- TypeScript, ESLint e build executados com sucesso.
- Suíte unitária: 115 testes aprovados, incluindo quatro novos testes das consultas
  pelo cliente Supabase real com transporte HTTP simulado.
- E2E com Supabase simulado: cadastro, fotos, edição, arquivamento/restauração,
  cartões/lista, busca, indicadores, preferência da sessão e ausência de erros no console.
- Capturas e verificação de overflow em 360, 390, 430, 768 e 1440px nos dois modos;
  cobertura mobile adicional de 280 a 1280px e navegação por teclado.
- O build mantém o aviso preexistente de bundle principal acima de 500 kB.
- Não foi realizada validação autenticada da consulta ampliada no banco real.
  Mocks não comprovam permissões RLS ou execução dos joins em produção.
- Nenhuma migração, escrita em produção ou dependência nova faz parte desta entrega.
