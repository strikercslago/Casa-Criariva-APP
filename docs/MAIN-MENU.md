# Menu principal — Casa Criativa

A página inicial (`/`) apresenta os módulos em cartões, com a logo oficial no cabeçalho. O painel operacional existente continua disponível em `/visao-geral`, pelo link Visão geral e pela sidebar desktop. Nenhum serviço, tabela, permissão ou regra de negócio foi alterado nesta atualização.

## Componentes e arquivos

- `src/features/dashboard/pages/MainMenuPage.tsx`: apresentação, grade filtrada por permissões e acesso ao painel operacional.
- `src/shared/components/navigation/MenuCard.tsx`: cartão inteiro clicável com ícone SVG, cor pastel e estados de interação.
- `src/shared/components/navigation/MobileBottomNavigation.tsx`: atalhos Painel e Agenda, estado ativo e área segura inferior.
- `src/shared/constants/navigation.ts`: fonte compartilhada de nomes, rotas, ícones, cores e módulos de permissão.
- `src/app/layouts/RootLayout.tsx`: logo, saída acessível no celular, sidebar desktop e remoção do drawer de navegação mobile.
- `src/app/router/router.tsx` e `routePreloaders.ts`: carregamento do menu e acesso ao painel operacional.
- `src/index.css`: grade 2/3/4 colunas, superfícies pastel, foco, toque, espaçamento e barra inferior.
- `playwright.config.ts`: permite usar um navegador instalado com `PLAYWRIGHT_CHANNEL=chrome`, mantendo o padrão anterior quando a variável não está definida.
- `tests/e2e/main-menu.spec.ts`: resoluções, navegação, recarregamento, permissões e capturas.
- Testes E2E existentes ajustados para o novo título inicial: agenda, attendance, billing, classes, daily-smoke, dashboard, events, finance, guardians, mobile-ux, roles e students.

## Rotas

Os dez cartões reutilizam `/agenda`, `/alunos`, `/responsaveis`, `/turmas`, `/frequencia`, `/mensalidades`, `/financeiro`, `/eventos`, `/ideias` e `/configuracoes`. Professor e administrador veem somente os módulos já autorizados. Avisos e Perfil foram omitidos porque não há páginas específicas implementadas para esses recursos.

## Validação

- TypeScript, ESLint e build de produção aprovados.
- 91 testes unitários aprovados.
- 26 cenários E2E aprovados em Chrome: sete do novo menu, 14 de experiência mobile, um de indicadores, três de papéis e um de navegação/logout.
- Grade validada em 360, 390, 430, 768 e 1440 px; todas as dez rotas abertas; recarregamento, ausência de overflow horizontal e espaço para alcançar o último conteúdo acima da barra inferior verificados.
- Capturas em `test-results/menu-360.png`, `menu-390.png`, `menu-430.png`, `menu-768.png` e `menu-1440.png`. Mobile e desktop revisados visualmente.
- Testes E2E usam respostas simuladas do Supabase, sem alterar dados reais.

O build ainda informa o aviso de tamanho do pacote principal (aproximadamente 511 kB). A ativação da tabela de chamados no Supabase continua sendo uma pendência anterior, documentada em `FEEDBACK-TICKETS.md`; não faz parte desta alteração visual.
