#!/usr/bin/env node
/**
 * Congela as cotações atuais em src/data/demo.json.
 *
 * Rodar ANTES do ensaio, não durante. O arquivo é versionado de propósito:
 * a demo tem que rodar a partir do repositório, sem rede.
 *
 *   node scripts/snapshot.mjs
 */
import { writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const previsoes = JSON.parse(readFileSync(join(RAIZ, "src/data/previsoes.json"), "utf8"));
const tickers = previsoes.previsoes.map((p) => p.ticker);

const token = process.env.BRAPI_TOKEN;
const url = new URL(`https://brapi.dev/api/quote/${tickers.join(",")}`);
if (token) url.searchParams.set("token", token);

const r = await fetch(url);
if (!r.ok) {
  console.error(`brapi respondeu ${r.status} — snapshot NÃO foi atualizado`);
  process.exit(1);
}
const dados = await r.json();
if (dados.error) {
  console.error(`brapi: ${dados.message} — snapshot NÃO foi atualizado`);
  process.exit(1);
}

const saida = {
  capturadoEm: new Date().toISOString(),
  cotacoes: (dados.results ?? []).map((c) => ({
    ticker: c.symbol,
    nome: c.shortName ?? null,
    preco: c.regularMarketPrice ?? null,
    variacaoPct: c.regularMarketChangePercent ?? null,
    moeda: c.currency ?? null,
    atualizadoEm: c.regularMarketTime ?? null,
  })),
};

if (saida.cotacoes.length === 0) {
  console.error("nenhuma cotação retornada — snapshot NÃO foi atualizado");
  process.exit(1);
}

writeFileSync(join(RAIZ, "src/data/demo.json"), JSON.stringify(saida, null, 2) + "\n");
console.log(`✓ snapshot: ${saida.cotacoes.length} ativos congelados em ${saida.capturadoEm}`);
for (const c of saida.cotacoes) console.log(`    ${c.ticker.padEnd(7)} R$ ${c.preco}`);
