#!/usr/bin/env node
/**
 * Teste de fumaça das rotas.
 *
 * Percorre todas as páginas e rotas de API e diz o que responde. Não valida
 * conteúdo — valida que nada explode. É o primeiro filtro: se uma rota volta
 * 500, não adianta discutir layout.
 *
 * Redirecionar para /entrar NÃO é falha: as rotas do produto ficam atrás de
 * sessão de propósito. O script distingue as duas coisas.
 *
 *   npm run dev            # noutro terminal
 *   node scripts/rotas.mjs
 */
import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const BASE = process.env.BASE ?? "http://localhost:3000";

function rotas(dir, prefixo = "") {
  const saida = [];
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (!statSync(caminho).isDirectory()) continue;
    // (grupos) não entram na URL; [params] precisam de valor
    const seg = nome.startsWith("(") ? "" : nome;
    if (nome.startsWith("[")) continue;
    const filhos = readdirSync(caminho);
    const url = seg ? `${prefixo}/${seg}` : prefixo;
    if (filhos.includes("page.tsx")) saida.push({ tipo: "página", url: url || "/" });
    if (filhos.includes("route.ts")) saida.push({ tipo: "api", url: url || "/" });
    saida.push(...rotas(caminho, url));
  }
  return saida;
}

const lista = rotas(join(RAIZ, "src/app"));
// A raiz não é subdiretório: entra à mão.
lista.push({ tipo: "página", url: "/" });
const paginas = lista.filter((r) => r.tipo === "página").sort((a, b) => a.url.localeCompare(b.url));
const apis = lista.filter((r) => r.tipo === "api").sort((a, b) => a.url.localeCompare(b.url));

const rotulo = (s, loc) => {
  if (s >= 500) return "\x1b[31mERRO DE SERVIDOR\x1b[0m";
  if (s === 404) return "\x1b[31mNÃO ENCONTRADA\x1b[0m";
  if (s >= 300 && s < 400) return `\x1b[33m→ ${loc ?? "redireciona"}\x1b[0m`;
  if (s === 200) return "\x1b[32mok\x1b[0m";
  return `${s}`;
};

async function bater(url) {
  try {
    const r = await fetch(BASE + url, { redirect: "manual" });
    return { s: r.status, loc: r.headers.get("location") };
  } catch (e) {
    return { s: 0, loc: e.message.slice(0, 40) };
  }
}

console.log(`\nbase: ${BASE}\n`);
console.log("PÁGINAS");
for (const r of paginas) {
  const { s, loc } = await bater(r.url);
  console.log(`  ${r.url.padEnd(22)} ${rotulo(s, loc)}`);
}
console.log("\nROTAS DE API");
for (const r of apis) {
  for (const q of ["", "?demo=1"]) {
    const { s, loc } = await bater(r.url + q);
    console.log(`  ${(r.url + q).padEnd(30)} ${rotulo(s, loc)}`);
  }
}
console.log(
  "\nRedirecionar para /entrar é comportamento esperado: as rotas do produto\n" +
  "ficam atrás de sessão. Só 4xx inesperado e 5xx são falha.\n"
);
