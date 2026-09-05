#!/usr/bin/env node
/**
 * Verificador da fronteira linguística.
 *
 * O que separa o degrau 0 (ferramenta de pesquisa, sem registro) do degrau 2
 * (análise de valores mobiliários, Res. CVM 20) não é a tecnologia — é a
 * redação. E redação escapa: numa correria de UI copy no dia 3, "ordenado por
 * probabilidade" vira "melhores oportunidades" e o enquadramento cai junto.
 *
 * Este script varre o código e os dados publicados atrás do vocabulário que
 * cruza essa linha. Roda em CI, não depende de alguém lembrar.
 *
 * Escape consciente: escreva `conformidade-ok` na mesma linha.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const ALVOS = ["src"];
const EXTENSOES = [".ts", ".tsx", ".json", ".md"];
// Contém os termos como DADO, não como texto de interface.
const ISENTOS = ["src/lib/conformidade.ts"];

const { TERMOS_PROIBIDOS } = await import("../src/lib/conformidade.ts")
  .catch(async () => {
    // O Node não lê .ts direto; extrai a lista do arquivo por regex.
    const txt = readFileSync(join(RAIZ, "src/lib/conformidade.ts"), "utf8");
    const bloco = txt.match(/TERMOS_PROIBIDOS = \[([\s\S]*?)\] as const/);
    if (!bloco) throw new Error("não achei TERMOS_PROIBIDOS em conformidade.ts");
    return {
      TERMOS_PROIBIDOS: [...bloco[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]),
    };
  });

function arquivos(dir) {
  const saida = [];
  for (const nome of readdirSync(dir)) {
    if (nome === "node_modules" || nome.startsWith(".")) continue;
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) saida.push(...arquivos(caminho));
    else if (EXTENSOES.some((e) => nome.endsWith(e))) saida.push(caminho);
  }
  return saida;
}

function ehComentario(linha) {
  const t = linha.trim();
  return t.startsWith("//") || t.startsWith("*") || t.startsWith("/*");
}

const achados = [];
for (const alvo of ALVOS) {
  for (const caminho of arquivos(join(RAIZ, alvo))) {
    const rel = relative(RAIZ, caminho);
    if (ISENTOS.includes(rel)) continue;
    const linhas = readFileSync(caminho, "utf8").split("\n");
    linhas.forEach((linha, i) => {
      if (ehComentario(linha) || linha.includes("conformidade-ok")) return;
      const baixa = linha.toLowerCase();
      for (const termo of TERMOS_PROIBIDOS) {
        if (baixa.includes(termo.toLowerCase())) {
          achados.push({ arquivo: rel, linha: i + 1, termo, texto: linha.trim().slice(0, 100) });
        }
      }
    });
  }
}

if (achados.length === 0) {
  console.log(`✓ conformidade: nenhum termo do degrau 2 encontrado (${TERMOS_PROIBIDOS.length} termos verificados)`);
  process.exit(0);
}

console.error(`\n✗ conformidade: ${achados.length} ocorrência(s) que sobem o produto para o degrau 2 (Res. CVM 20)\n`);
for (const a of achados) {
  console.error(`  ${a.arquivo}:${a.linha}`);
  console.error(`    termo: "${a.termo}"`);
  console.error(`    ${a.texto}\n`);
}
console.error("Reescreva em linguagem de probabilidade, ou marque a linha com");
console.error("`conformidade-ok` se o uso for legítimo (ex.: citar o que NÃO se diz).\n");
process.exit(1);
