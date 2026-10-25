# 📣 Plano de Divulgação — Meu Lava Rápido

Plano completo para levar o app ao maior número possível de donos de lava-rápido,
lava-jato, estética/detalhamento automotivo e segmentos vizinhos.

- **Produto:** app de gestão (Android, Google Play) — lavagens, clientes, agenda, recibos, despesas, relatórios, tele-busca.
- **Modelo:** teste grátis de 14 dias → assinatura **R$ 49,90/mês** ou **R$ 499,90/ano**.
- **Mercado-alvo:** Brasil — dezenas de milhares de estabelecimentos de lavagem e estética automotiva, formais e informais.
- **Meta de referência (90 dias):** 3.000 instalações, 600 trials, 150 assinantes pagantes.

---

## PARTE 0 — O que precisa existir ANTES de gastar o primeiro real

Sem estes itens, o dinheiro de anúncio vira instalação sem retorno e você não
consegue saber o que funcionou.

| # | Item | Situação hoje | Por quê |
|---|---|---|---|
| 1 | App publicado em produção na Play Store (fora de teste fechado) | pendente | Sem link público não há campanha |
| 2 | **Mensuração de instalação / trial / assinatura** | ✅ implementada no app — falta configurar os painéis ([MENSURACAO.md](MENSURACAO.md)) | Sem isso o Meta não otimiza e você não sabe o CAC |
| 3 | Landing page própria (studiomythos.com.br/meulavarapido) | só páginas legais | Destino do anúncio, SEO, remarketing, prova social |
| 4 | WhatsApp Business com catálogo e respostas rápidas | a definir | Canal nº 1 de conversão deste público |
| 5 | Perfil do app no Instagram (conta comercial) + página no Facebook | a definir | Obrigatório para anunciar e dá credibilidade |
| 6 | Pixel / Conversions API no site + eventos no app | não existe | Públicos semelhantes e remarketing |
| 7 | 3 a 5 depoimentos reais em vídeo (clientes beta) | a produzir | Maior alavanca de conversão do nicho |
| 8 | Vídeo de 60–90s mostrando o app na mão | a produzir | Criativo principal de todas as campanhas |

### 0.1 Mensuração — situação

O funil **já está instrumentado no app** com Firebase Analytics
(`first_open`, `sign_up`, `trial_start`, `wash_created`, `activation`,
`paywall_view`, `begin_checkout`, `purchase`) e o RevenueCat já envia os
identificadores de atribuição para Meta e Google Ads.

O que falta é **configuração nos painéis** — vincular Firebase ↔ Google Ads,
marcar as conversões no GA4, criar o app no Meta e ligar a integração do
RevenueCat. Passo a passo completo em **[MENSURACAO.md](MENSURACAO.md)**.

> **Atalho válido para começar:** rodar os primeiros testes com campanha de
> **Tráfego / Mensagens para WhatsApp** (não exige SDK) e só migrar para
> *App Installs* quando a mensuração estiver pronta.

---

## PARTE 1 — Posicionamento e mensagem

### 1.1 Promessa central
> "Pare de anotar lavagem em caderno. Saiba quanto você lucra de verdade — do celular, em 2 minutos por dia."

### 1.2 Dores que vendem (usar nos criativos, nesta ordem de força)
1. **Perda de dinheiro** — serviço feito e não cobrado, cliente que ficou devendo.
2. **Não sabe o lucro real** — fatura bem e não sobra nada.
3. **Cliente sumido** — não tem como saber quem não volta há 40 dias.
4. **Desorganização da agenda** — cliente marcado e esquecido.
5. **Falta de profissionalismo** — recibo em papel, orçamento "de cabeça" no WhatsApp.
6. **Equipe sem controle** — quem fez qual serviço.

### 1.3 Ângulos de criativo (um por anúncio, nunca misturar)

| Ângulo | Gancho (primeiras palavras do vídeo) |
|---|---|
| Caderno x app | "Joga esse caderno fora." |
| Lucro escondido | "Fatura 20 mil e não sobra nada?" |
| Cliente sumido | "Você tem 37 clientes sumidos agora." |
| Recibo profissional | "Seu cliente pediu um comprovante. E agora?" |
| Antes/depois do dono | "Era caos. Hoje é isso." (print do dashboard) |
| Demonstração seca | Tela gravada registrando uma lavagem em 15s |
| Prova social | Depoimento de dono real falando números |
| Objeção de preço | "R$ 1,66 por dia. Uma lavagem paga o mês." |

### 1.4 Prova de valor do preço (usar sempre)
R$ 49,90/mês = **menos de uma lavagem completa por mês**. Se o app recuperar
**1 cliente sumido** ou evitar **1 serviço não cobrado**, já se pagou.

---

## PARTE 2 — Segmentos-alvo (filtros de público)

### 2.1 Público primário
- Lava-rápido / lava-jato (bairro, posto de combustível, condomínio)
- Estética automotiva / detalhamento / polimento / vitrificação
- Higienização de estofados e bancos
- Lavagem ecológica / a seco
- Lava-rápido móvel (atende em domicílio)
- Insulfilm / película / PPF (quase sempre vendem lavagem junto)

### 2.2 Público secundário (o app serve igual, com outro nome de serviço)
- Oficinas mecânicas pequenas e centros automotivos (controle de OS e recibo)
- Troca de óleo e auto center
- Funilaria e pintura
- Borracharias e centros de pneus
- Lavagem de motos
- Lavagem de caminhões, frotas e máquinas agrícolas
- Martelinho de ouro
- Guincho / leva-e-traz (usa o módulo de tele-busca)

### 2.3 Público terciário (expansão futura, mesma mecânica)
Pet shop com banho e tosa, lavanderias, limpeza residencial, jardinagem,
dedetização — todo prestador de serviço recorrente que precisa de cliente +
agenda + recibo + caixa. **Não anuncie para eles agora:** diluir a mensagem
derruba a conversão. Guarde para uma v2 do produto.

---

## PARTE 3 — Meta Ads (Facebook + Instagram) — canal principal

### 3.1 A realidade dos filtros
O Meta **não** tem um filtro "dono de lava-rápido". O que existe:

**Interesses e comportamentos utilizáveis** (buscar pelo nome no editor de público):
`Lavagem de carros` · `Lava-jato` · `Detalhamento automotivo` · `Cera automotiva` ·
`Polimento` · `Manutenção automotiva` · `Oficina mecânica` · `Peças automotivas` ·
`Empreendedorismo` · `Pequenas e médias empresas` · `Administração de empresas` ·
`SEBRAE` · `Gestão de negócios`

**Comportamentos:** `Administradores de páginas do Facebook` (pequenas empresas) ·
`Proprietários de pequenas empresas`

**Atenção:** nomes e disponibilidade de interesses mudam sem aviso, e público
muito estreito custa caro. A regra atual do Meta é: **o criativo filtra melhor
que a segmentação**. Um vídeo que começa com "Dono de lava-rápido:" entrega
sozinho ao público certo.

### 3.2 Estrutura de conta recomendada

```
CAMPANHA 1 — PROSPECÇÃO AMPLA (Advantage+ / público aberto)
  Objetivo: App Installs (ou Mensagens/WhatsApp até a mensuração existir)
  Público: Brasil, 25–55, sem interesses — só excluindo quem já instalou
  Criativos: 4 a 6 ângulos diferentes, 1 por conjunto de anúncios
  Orçamento: 60% da verba

CAMPANHA 2 — INTERESSE SEGMENTADO
  Conjunto A: interesses automotivos (lista 3.1)
  Conjunto B: donos de pequenos negócios + empreendedorismo
  Conjunto C: Público Semelhante 1% (base: instaladores / assinantes)
  Orçamento: 25% da verba

CAMPANHA 3 — REMARKETING
  Visitou a landing page (30 dias) · Viu 50% do vídeo · Engajou no Instagram ·
  Instalou e NÃO iniciou o trial · Trial expirado sem assinar
  Criativo: objeção de preço + depoimento + oferta por tempo limitado
  Orçamento: 15% da verba
```

### 3.3 Verba e expectativa

| Fase | Período | Verba/dia | Objetivo |
|---|---|---|---|
| Teste de criativo | Semanas 1–2 | R$ 30–50 | Achar 2 criativos com CPC < R$ 1,20 |
| Escala inicial | Semanas 3–6 | R$ 80–150 | CPI < R$ 4 e custo por trial < R$ 35 |
| Escala | Semana 7+ | R$ 200+ | Custo por assinante < R$ 150 |

**Matemática do limite:** se o assinante médio fica 8 meses × R$ 49,90, o LTV é
~**R$ 400**. Pague no máximo **R$ 130–150 por assinante pagante** (payback em
3 meses). Acima disso, pause e troque o criativo.

### 3.4 Formatos
- **Reels / Stories 9:16, vídeo de 15–30s** — melhor custo hoje.
- Tela gravada do app no próprio celular, sem produção, performa melhor que arte bonita.
- Carrossel com os 6 screenshots já prontos em `play-store/assets/`.
- Anúncio de **Mensagens para WhatsApp** — este público prefere conversar antes de instalar.

### 3.5 Regras de operação
- No máximo 1 edição por dia no conjunto (edição reinicia a fase de aprendizagem).
- Deixe rodar 3 dias ou 1.000 impressões antes de julgar.
- Desligue criativo com frequência > 2,5 e CTR < 1%.
- Troque criativo a cada 2–3 semanas (a fadiga é rápida em nicho pequeno).
- Evite texto que prometa ganho financeiro garantido — reprovação por política.

---

## PARTE 4 — Orgânico: Instagram, Facebook e TikTok

### 4.1 Instagram
- **Bio:** "Gestão do seu lava-rápido no celular · 14 dias grátis" + link.
- **3 posts por semana + 2 stories por dia.**
- Pilares de conteúdo (vendem sem parecer anúncio):
  1. **Dica de gestão** ("como calcular o preço justo da sua lavagem") — conteúdo salvável.
  2. **Bastidor do app** (tela nova, pedido de usuário atendido).
  3. **Cliente real** (print de faturamento com autorização, depoimento).
  4. **Dor com humor** (o caderno molhado, o "pago depois").
  5. **Comparativo** (caderno x planilha x app).
- Reels é o único formato que escala alcance — 1 novo a cada 2 dias.
- Responda **todo** comentário e DM em menos de 1 hora.

### 4.2 Facebook — o canal mais subestimado para este nicho
É onde os donos de lava-rápido realmente estão. Ação de alto retorno e custo zero:
- Entrar em **20 a 40 grupos**: "Lava Rápido Brasil", "Estética Automotiva",
  "Detalhamento Automotivo", "Donos de Lava Jato", grupos regionais
  ("Lava rápido — [seu estado]"), grupos de empreendedorismo automotivo.
- **Não faça spam.** O padrão que funciona: participar uma semana respondendo
  dúvidas de gestão e depois publicar "fiz um app para resolver isso, quem
  quiser testar grátis comenta aqui".
- Peça autorização ao admin — muitos liberam post pago ou parceria.
- Criar **seu próprio grupo**: "Gestão de Lava Rápido — dicas e números".
  É ativo de longo prazo e vira lista de clientes.

### 4.3 TikTok / Kwai
O público de serviço automotivo é enorme no TikTok. Reposte os Reels sem marca
d'água. O TikTok Ads tem CPM mais baixo; vale testar com 20% da verba depois
que o criativo campeão estiver validado no Meta.

---

## PARTE 5 — Google: ASO + Google Ads

### 5.1 ASO (otimização na Play Store) — maior retorno de todos, custo zero
A ficha já está escrita em `TEXTOS_LOJA.md`. Ajustes a fazer:
- **Nome:** usar `Meu Lava Rápido: Gestão` — a palavra "Gestão" no título pesa no ranking.
- **Descrição curta:** incluir "lava jato" (grafia muito buscada).
- Repetir naturalmente 3–5 vezes na descrição completa: `lava rápido`, `lava jato`,
  `estética automotiva`, `ordem de serviço`, `controle financeiro`.
- **Avaliações:** meta de 20 avaliações 5★ no primeiro mês. Pedir dentro do app
  após a 10ª lavagem registrada (`expo-store-review`), nunca antes.
- Responder 100% das avaliações (o Google considera no ranking).
- Publicar **vídeo promocional** (YouTube) na ficha — aumenta a conversão da página.
- Atualizar o app a cada 2–3 semanas: frequência de atualização é sinal de ranking.

### 5.2 Google Ads
- **App campaign (Instalações)** — exige Firebase/GA4 vinculado. Começar com
  R$ 30/dia, lance por CPI alvo, criativos: 5 textos + 4 imagens + 2 vídeos.
- **Rede de Pesquisa** (barato e muito qualificado): `sistema para lava rápido`,
  `app lava jato`, `programa lava rápido`, `controle de lavagens`,
  `ordem de serviço automotiva`, `sistema estética automotiva`, `app para oficina`.
  Negativar `grátis`, `crack`, `planilha excel`.
- **Perfil da Empresa no Google** (Studio Mythos) + página do produto para SEO.

### 5.3 SEO de conteúdo (médio prazo, tráfego perpétuo)
Blog em `studiomythos.com.br/meulavarapido/blog`, 1 artigo por semana:
- "Quanto cobrar por uma lavagem completa (tabela de preços)"
- "Planilha x aplicativo: como controlar o caixa do lava-rápido"
- "Como abrir um lava-rápido: custos, licenças e lucro"
- "Como recuperar clientes que pararam de lavar o carro com você"

Cada artigo fecha com CTA de teste grátis. É o canal que reduz o CAC a partir do 6º mês.

---

## PARTE 6 — Canais diretos e parcerias (o que mais converte neste nicho)

### 6.1 Prospecção ativa via Google Maps (altíssima conversão, custo zero)
1. Buscar "lava rápido" + cada cidade no Google Maps → anotar nome, telefone, Instagram.
2. Organizar em planilha por cidade, começando pela sua região.
3. Abordagem por **WhatsApp**, uma por uma, personalizada:
   > "Oi, [nome]! Vi o [nome do lava-rápido] aqui no Maps. Fiz um app de gestão
   > feito só para lava-rápido e estou liberando 14 dias grátis para donos da
   > região. Quer que eu te mande o link?"
4. Meta realista: 50 contatos/dia → ~10 respostas → ~3 instalações → ~1 assinante.
5. **LGPD:** telefone comercial público pode ser contatado, mas registre a base
   legal de interesse legítimo, não envie em massa automatizada e respeite o
   opt-out na primeira negativa. Nunca use disparador em massa — derruba o número.

### 6.2 Parcerias com distribuidores de produtos (o canal de maior escala)
Quem vende cera, shampoo, extratora e insumos **já tem a lista de praticamente
todos os lava-rápidos da região**. Proposta:
- Distribuidores regionais e lojas de produtos de estética automotiva.
- Oferta: comissão recorrente de **20–30%** da assinatura indicada, ou 3 meses
  grátis para o cliente dele (brinde que ele usa para vender mais).
- Material: 1 página em PDF + cupom com código por parceiro.
- 10 distribuidores ativos valem mais que R$ 10 mil em anúncio.

### 6.3 Influenciadores de detalhamento automotivo
- Perfis de 10k–100k no Instagram e YouTube que ensinam detalhamento e gestão.
- Formato: vídeo de 3–5 min mostrando o app no negócio dele + cupom.
- Pagamento: R$ 300–1.500 por publi, ou 100% afiliado por comissão.
- Micro-influenciador local converte melhor que nacional.

### 6.4 Programa de indicação dentro do app
"Indique um dono de lava-rápido: você ganha 1 mês, ele ganha 1 mês."
Implementar código de indicação + botão de compartilhar no WhatsApp.
Em app B2B de nicho, indicação costuma virar 20–30% das assinaturas.

### 6.5 Feiras e associações
- Feiras do setor de estética automotiva — estande pequeno ou só panfletagem
  com QR code já gera dezenas de instalações.
- Sindicatos e associações estaduais de lava-rápido; SEBRAE local (eventos de
  gestão para o micro-empresário automotivo).
- Fornecedores de equipamento (lavadoras, elevadores) para co-marketing.

### 6.6 YouTube próprio
Canal com tutoriais curtos ("como emitir recibo no lava-rápido") — serve de
suporte, aparece na busca e alimenta a ficha da Play Store.

---

## PARTE 7 — Cronograma de 90 dias

### Mês 1 — Fundação

| Semana | Entregas |
|---|---|
| 1 | Analytics + RevenueCat integrados; landing page; Instagram e Facebook criados; WhatsApp Business |
| 2 | App em produção na Play; ASO revisado; 6 criativos gravados; 3 depoimentos |
| 3 | Pixel e eventos validados; entrar em 20 grupos do Facebook; iniciar lista do Google Maps |
| 4 | Campanha 1 do Meta no ar (R$ 30–50/dia); 50 abordagens no WhatsApp por dia |

### Mês 2 — Validação e primeiras parcerias
- Escalar o criativo campeão; subir a Campanha 2 (interesses + semelhantes).
- Google Ads Pesquisa no ar.
- Fechar 3 distribuidores parceiros e 2 influenciadores.
- Programa de indicação no app.
- Meta: 20 avaliações 5★ e os primeiros 30 assinantes.

### Mês 3 — Escala
- Verba do Meta para R$ 200+/dia com remarketing ativo.
- App campaign do Google Ads.
- Blog com 8 artigos publicados.
- Teste no TikTok Ads.
- Meta: 150 assinantes pagantes.

---

## PARTE 8 — Métricas a acompanhar (painel semanal)

| Métrica | Alvo |
|---|---|
| CPC | < R$ 1,20 |
| CTR | > 1,5% |
| CPI (custo por instalação) | < R$ 4,00 |
| Instalação → cadastro | > 50% |
| Cadastro → trial iniciado | > 70% |
| Trial → assinatura paga | > 20% |
| CAC por assinante | < R$ 150 |
| Churn mensal | < 8% |
| Avaliação na Play | ≥ 4,5★ |

Montar uma planilha única (ou um painel no Looker Studio) com canal, gasto,
instalações, trials, assinantes e CAC por semana. **O que não é medido não escala.**

---

## PARTE 9 — Riscos e cuidados

1. **Reprovação de anúncio no Meta** — evitar promessa de ganho financeiro,
   antes/depois de dinheiro e linguagem que presume a situação do usuário
   ("você está perdendo dinheiro" → "muitos donos perdem dinheiro").
2. **Disparo em massa no WhatsApp** — banimento do número e risco de LGPD.
   Só abordagem manual, personalizada e com opt-out respeitado.
3. **Trial sem cartão** gera muita instalação curiosa. Se o custo por assinante
   ficar alto, testar trial com cartão exigido (o RevenueCat permite as duas formas).
4. **Preço acima do nicho** — R$ 49,90 é alto para lava-rápido de bairro. Se a
   conversão de trial ficar abaixo de 10%, testar um plano básico de R$ 24,90
   (lavagens + clientes + recibo) mantendo o completo em R$ 49,90.
5. **Churn por não-uso** — se o dono não registra lavagem na primeira semana,
   cancela. Onboarding guiado + push nos dias 1, 3 e 7 do trial valem mais que
   um criativo novo.
6. **Concorrência** — já existem sistemas para lava-rápido (web, mais caros e
   mais complexos). Seu diferencial é **celular, simples e barato**: bata nisso
   em toda a comunicação.

---

## PARTE 10 — Se a verba for curta: a ordem exata do que fazer

Com R$ 0 e só o seu tempo, nesta ordem:
1. ASO bem feito na Play Store.
2. Prospecção manual no Google Maps por WhatsApp (50 por dia).
3. Grupos de Facebook do nicho.
4. Instagram com Reels de dica de gestão.
5. Três distribuidores parceiros com comissão.

Só depois que isso gerar os 20 primeiros assinantes (prova de que o produto
retém), coloque dinheiro em Meta Ads. Anúncio escala um funil que já funciona —
ele não cria um.
