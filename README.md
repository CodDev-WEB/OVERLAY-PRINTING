# Overlay Printing

Aplicação web para preencher fichas pré-impressas com dados posicionados sobre um documento-base e gerar um PDF de saída.

## Stack
- React + TypeScript + Vite
- PDF.js para visualizar a primeira página de PDFs
- pdf-lib para gerar o PDF com os dados sobrepostos

## Desenvolvimento
```bash
npm install
npm run dev
```

## Build
```bash
npm run build
```

## MVP atual
- Carregar documento-base em PDF, PNG ou JPG.
- Visualizar a primeira página.
- Criar campos e posicioná-los clicando na ficha.
- Editar conteúdo, tamanho e largura dos campos.
- Gerar PDF com a ficha-base e os dados sobrepostos.

## Próximos incrementos
1. Arrastar campos para ajuste fino e oferecer nudges por teclado.
2. Modo de saída somente com a camada dos dados (transparente), para papel já pré-impresso.
3. Configuração do tamanho real da página, margens e orientação.
4. Salvar/carregar modelos e conjuntos de dados.
5. Impressão em lote e calibração por impressora.

> Importante: o MVP inicial gera uma prova com a ficha-base incluída. O modo de produção para papel pré-impresso deve gerar somente os dados, sem fundo, para evitar duplicar o formulário na impressão.
