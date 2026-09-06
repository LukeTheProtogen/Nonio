"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { ehDemo } from "@/lib/demo";

/**
 * Modo demonstração ligado pela interface.
 *
 * `lib/demo.ts` já resolve o modo por ambiente (NONIO_DEMO=1) e por query
 * (`?demo=1`). Nenhum dos dois serve para uma chave na barra lateral: variável
 * de ambiente exige reiniciar o servidor, e query string se perde na primeira
 * navegação.
 *
 * O cookie resolve isso e some sozinho ao fechar o navegador, que é o
 * comportamento certo para um modo de apresentação: ninguém quer descobrir
 * semanas depois que ficou vendo dado congelado sem saber.
 *
 * A precedência importa: NONIO_DEMO=1 no ambiente VENCE o cookie e não pode ser
 * desligado pela tela. É assim que a instância do ensaio fica travada, sem risco
 * de alguém desligar sem querer no meio da apresentação.
 */
const COOKIE = "nonio_demo";

/** Travado pelo ambiente? Então a chave da tela não deve nem aparecer ativa. */
export async function demoTravadoPeloAmbiente(): Promise<boolean> {
  return ehDemo();
}

export async function emDemo(): Promise<boolean> {
  if (ehDemo()) return true;
  return (await cookies()).get(COOKIE)?.value === "1";
}

export async function alternarDemo(): Promise<void> {
  // Travado pelo ambiente: a chave não desliga nada, e fingir que desligou
  // seria pior que não ter chave.
  if (ehDemo()) return;

  const jar = await cookies();
  const ligado = jar.get(COOKIE)?.value === "1";

  if (ligado) {
    jar.delete(COOKIE);
  } else {
    jar.set(COOKIE, "1", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      // Sem `maxAge`: cookie de sessão, morre ao fechar o navegador.
    });
  }

  // Todas as telas do produto leem o modo. Sem isto, a chave viraria só um
  // botão bonito com a tabela continuando a mostrar o dado anterior.
  revalidatePath("/", "layout");
}
