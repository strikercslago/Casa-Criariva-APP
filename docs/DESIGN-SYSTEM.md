# Identidade visual compartilhada

O menu principal e o diretório de alunos são a referência visual: roxo nas ações,
superfícies claras em tons pastel, cantos arredondados e logo oficial da escola.
A aplicação usa a mesma linguagem no login, agenda, responsáveis, turmas, frequência,
mensalidades, financeiro, eventos, chamados, configurações e visão geral.

## Onde manter os estilos

- `src/index.css`: tokens semânticos de cor, acessibilidade e estrutura responsiva existente.
- `src/styles/design-system.css`: apresentação compartilhada, carregada depois da base.
- `PageHeader`: ícone opcional explícito, título, descrição e ações; não depende da rota.
- `Button`: ação principal com gradiente; variantes de perigo e secundárias preservadas.
- `ui-surface`: painéis, filtros, cartões e tabelas existentes, sem mudar sua estrutura.
- `record-card`: tons pastel para registros, sem atribuir significado de status à cor decorativa.
- `metric-tile`: indicadores com `data-tone` para preservar sucesso, alerta e erro.

Ao adicionar uma tela, reutilize esses componentes e classes. Evite gradientes ou cores
isolados para ações principais. Status sempre têm texto, além da cor; não dependa apenas
da posição ou da cor para comunicar informação. Mantenha labels, foco visível, áreas de
toque e redução de movimento. Não fixe alturas para textos ou dados variáveis.

## Verificação

`tests/e2e/design-system.spec.ts` percorre todos os módulos e as três áreas de configurações
em 390 e 1440 pixels e verifica cabeçalhos, ícones e ausência de overflow horizontal.
Capturas ficam em `test-results`, fora do versionamento. Os testes operacionais existentes
cobrem formulários, permissões, navegação e larguras adicionais de 280 a 1440 pixels.
Os testes usam dados simulados: não criam nem alteram registros de produção.

Esta padronização altera somente a apresentação. Não exige migração ou alteração de
permissões, serviços ou contratos de dados. Publicação do frontend é uma etapa separada.
