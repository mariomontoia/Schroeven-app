# Notas do processo: reparação de hélices (Moordgat)

Notas para retomar o trabalho entre sessões.

## Objetivo
App web instalável (PWA) para a secção de hélices: ficha por hélice (entrada, fotos,
medição, cálculo do passo/spoed, reparação, relatório PDF por e-mail).

## Meetblad (folha de medição em papel)
Cabeçalho: Naam Schip, Datum, Schroef Nr, Diameter, Draairichting (ex.: R-4),
Model, Materiaal, Plaats, Spoed (nominal), Opmerkingen, Gemeten door, Meetstand.

Colunas (da direita para a esquerda): 98%, RAD1 (90%), RAD2 (70%), RAD3 (50%), RAD4 (30%).
Por baixo de cada RAD: raio em mm e dois ângulos (<1 e <2, em graus).
Linhas 1..N = pás; em cada pá, 3 leituras de altura por raio (2 nos raios 50% e 30%).

## Excel SCHROEFBLADEN.xlsx (folhas 2BLAD..7BLAD = nº de pás)
- G8 (letra vermelha): diâmetro em mm.
- Raio por circunferência: R = diâmetro × {98, 90, 70, 50, 30}% / 2.
- Por pá e raio: D = última leitura − primeira leitura.
- Gemid = média de D de todas as pás.
- Passo nesse raio = Gemid × 360 / (<1 + <2).
- Excel guarda S = passo × R; passo total (S9) = Σ(passo × R) / ΣR
  (média ponderada pelo raio).

## Verificação com uma folha real (diâmetro 850, spoed nominal 1006)
Pá 1, RAD1 (R 383): 370 − 247 = 123; ângulos 23 + 22 = 45 → 123 × 360 / 45 = 984.
Pá 1, RAD2 (R 298): 435 − 227 = 208; ângulos 38 + 38 = 76 → 985.

## Respostas do utilizador (2026-11-20)
- Medição: risca-se cada circunferência, o meio da linha é o ponto zero; a agulha sobe X graus
  (ângulo de cima) e desce X graus (ângulo de baixo); os números são alturas (cima / zero / baixo).
- 98% normalmente é sempre medido (nessa folha não foi preciso).
- O Excel SCHROEFBLADEN.xlsx já tem o cálculo do passo.
- Meetstand = posto de medição A, B ou C (cada um trabalha no seu; o utilizador usa o C).
- Interface só em neerlandês; relatório também em francês (clientes franceses).
- 3 pessoas usam.

## Protótipo v1 (2026-11-20)
PWA na raiz do repositório: Ontvangst → Meting (vóór/na) → Herstelling → Rapport (PDF NL/FR, partilhar/e-mail).

## Em aberto
- Segunda subcoluna em cada RAD: o protótipo assume "vóór / na herstelling" — confirmar.
- O que se escreve em Plaats e Model.
- Aparelhos (tablet/telemóvel/PC) e onde alojar a app (ex.: GitHub Pages) e guardar os dados.
- Desenho das pás para marcar zonas a cores (fase 2).
