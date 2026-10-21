# Casa Criativa: experiência mobile

Pesquisa e implementação em 21 de outubro de 2026.

## Objetivo e escopo

Prioridade definida com o usuário: agenda, chamada e alunos. O celular passa a orientar a hierarquia e o tamanho dos controles; desktop mantém navegação lateral e tabelas. Este levantamento é um benchmark de diretrizes públicas e uma auditoria do código, não uma pesquisa quantitativa de participação de mercado nem um teste com usuários reais.

## Referências e decisões

| Referência | Orientação encontrada | Aplicação na Casa Criativa |
| --- | --- | --- |
| [Google / Android: layout e navegação](https://developer.android.com/design/ui/mobile/guides/layout-and-content/layout-and-nav-patterns) | Navegação principal com três a cinco destinos; adaptar o padrão à largura da janela. | Barra inferior com Início, Agenda, Alunos, Chamada e Mais. Permissões continuam filtrando os destinos. Desktop preserva a lateral. |
| [Apple: tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars) | Destinos reconhecíveis e navegação previsível. | Ícone acompanhado de texto, destino ativo destacado e acesso estável às tarefas frequentes. |
| [Google: alvos de toque](https://support.google.com/accessibility/android/answer/7101858?hl=en) | Referência nativa de 48 dp e separação entre alvos. | Adotamos 48 CSS px como regra de projeto para controles móveis compartilhados; unidades web e nativas não são equivalentes universais. |
| [Microsoft Fluent: layout](https://fluent2.microsoft.design/layout) | Espaçamento consistente, hierarquia visual e adaptação ao dispositivo. | Sistema comum de cantos, superfícies, títulos, controles e espaçamento; cartões compactos no celular. |
| [Nielsen Norman Group: progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/) | Mostrar primeiro o essencial e revelar opções secundárias sob demanda. | Observações da chamada e opções secundárias da ficha do aluno recolhidas, com identificação explícita. |

## Diagnóstico do código anterior

- O menu superior escondia os módulos mais usados e exigia um passo intermediário.
- O cabeçalho exibia textos de desenvolvimento e uma busca global sem funcionalidade.
- Resumos e controles ocupavam várias linhas antes do conteúdo principal.
- Na chamada, os estados eram empilhados no celular e as observações apareciam para todos os alunos.
- A lista mobile de alunos repetia datas e um botão separado em cada cartão.
- Os diálogos não gerenciavam foco, Escape e bloqueio de rolagem do fundo.

## Implementação

1. Navegação inferior persistente, com áreas seguras de tela e espaço reservado no conteúdo. Menu Mais utiliza o mesmo componente acessível de diálogo.
2. Agenda com faixa de sete dias, data livre, dia/semana e acesso direto à chamada da aula selecionada. O link leva o identificador e a data da aula. Detalhes e operações anteriores continuam disponíveis.
3. Chamada com seletor de turma no celular, estados lado a lado, observações sob demanda, contagem do rascunho e salvamento acima da navegação. Proteção de alterações não salvas preservada. Atualização manual solicita confirmação quando há edição pendente.
4. Alunos com busca destacada, filtros de status e cartões inteiros tocáveis. Nome completo pode quebrar linha. Datas continuam disponíveis na ficha e na tabela desktop.
5. Botões e campos compartilhados maiores no celular; inputs a 16 px; diálogos com foco contido, Escape, restauração do foco e rolagem própria. Avisos ficam acima da navegação.
6. Identidade verde preservada, cantos e tipografia harmonizados. HTML em português, favicon da marca e viewport com suporte a safe areas.

## Validação e limites

Testes de navegador usam respostas simuladas: não registram presenças, alunos ou cobranças no banco real. Cobrem agenda → chamada, salvamento com falta/presença, busca, navegação, erro/vazio, foco do menu e cancelamento da saída com alterações pendentes. Larguras: 320, 390, 430 e 1280 px. Incluem captura de imagens para revisão visual.

Comando: `node node_modules/@playwright/test/cli.js test --config playwright.mobile.config.ts`, com o servidor local na porta 5173 e Chrome instalado.

A suíte unitária utiliza um ambiente jsdom que preserva AbortController/AbortSignal nativos, para compatibilidade com Request do Node 24. Isso não altera o app em produção.

Ainda é necessário testar em aparelhos físicos, especialmente teclado virtual e Safari/iOS. Os módulos financeiros, relatórios e cadastros extensos recebem as melhorias compartilhadas, mas não passaram por redesenho individual nesta entrega. Nenhuma melhoria de produtividade foi medida com a equipe ainda.

## Como medir o resultado com a equipe

Executar as mesmas tarefas antes e depois: encontrar um aluno, abrir a aula de uma data e registrar uma turma com uma falta. Medir tempo, número de toques, erros e necessidade de ajuda. Usar os resultados para decidir o próximo fluxo a redesenhar. Priorizar depois matrícula, ficha do aluno e cobranças conforme frequência real de uso; instalação como PWA e trabalho offline exigem uma etapa funcional própria.

## Revisão de estrutura e tipografia

A revisão posterior ampliou o padrão visual aos demais módulos e corrigiu a quebra indevida de palavras e números. Títulos de página usam 22 px no celular; texto de conteúdo e ações, 14 px; campos, 16 px; rótulos auxiliares, 11–12 px; indicadores, 20–22 px. A informação principal não deve ser abreviada ou quebrada letra a letra para caber.

Cabeçalhos distribuem ações por espaço disponível. Resumos usam cartões com largura mínima adequada; valores dos registros financeiros são apresentados em linhas no celular. Listas financeiras e de eventos usam a largura real do contêiner para escolher entre cartões e tabela. As abas extensas viram um seletor no celular. A matrícula exibe etapa atual, progresso e ações no rodapé; a foto opcional ocupa menos espaço.

O início prioriza o dia e mantém o resumo mensal em seção expansível. Agenda e seleção de mês foram reorganizadas. Também foram revisados responsáveis, turmas, mensalidades, financeiro, eventos, materiais, relatórios e configurações. Ideias continua sendo um módulo ainda não implementado, agora com mensagem simples.

Validação ampliada: 81 testes unitários e 15 testes de navegador. Os fluxos principais cobrem 280, 305, 320, 390, 430 e 1280 px; a varredura de 16 rotas cobre 305, 390, 768 e 1280 px. Há verificações de rolagem horizontal, contadores e rótulos sem quebras indevidas, matrícula e troca de seção. As APIs permanecem simuladas nos testes. Isso não substitui avaliação com usuários ou aparelhos físicos.
