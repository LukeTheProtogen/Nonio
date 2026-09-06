import { usandoBackend } from "@/lib/api/servico";

/**
 * Entrada por Google.
 *
 * O backend expõe `/auth/google/authorize`, que devolve a URL de autorização
 * pronta. O front só precisa mandar a pessoa para lá — nenhum segredo passa por
 * aqui, e é por isso que o fluxo é redirecionamento e não chamada de API.
 *
 * O PORQUÊ DA VERIFICAÇÃO
 *
 * O endpoint responde 200 mesmo sem credenciais: ele monta a URL com
 * `client_id=` vazio, e quem recusa é o Google, com uma tela de erro em inglês
 * falando de "invalid_client". Botão que leva a isso é pior que botão
 * desligado, porque a pessoa culpa a própria conta.
 *
 * A checagem lê o `client_id` da URL que o próprio servidor montou, em vez de
 * duplicar a configuração numa variável do front. Config duplicada diverge: o
 * dia em que alguém preencher a chave no backend, o botão liga sozinho, sem
 * ninguém lembrar de mexer aqui.
 */
const BASE = process.env.NONIO_API_URL?.replace(/\/$/, "") ?? "";

export type EstadoGoogle =
  | { disponivel: true; url: string }
  | { disponivel: false; motivo: "sem-backend" | "sem-credencial" | "fora-do-ar" };

export async function estadoGoogle(): Promise<EstadoGoogle> {
  if (!usandoBackend) return { disponivel: false, motivo: "sem-backend" };

  try {
    const r = await fetch(`${BASE}/auth/google/authorize`, {
      // A URL carrega um `state` com CSRF de uso único: cachear entregaria o
      // mesmo state para pessoas diferentes, que é o oposto da proteção.
      cache: "no-store",
    });
    if (!r.ok) return { disponivel: false, motivo: "fora-do-ar" };

    const { authorization_url } = (await r.json()) as { authorization_url?: string };
    if (!authorization_url) return { disponivel: false, motivo: "fora-do-ar" };

    const clientId = new URL(authorization_url).searchParams.get("client_id");
    if (!clientId) return { disponivel: false, motivo: "sem-credencial" };

    return { disponivel: true, url: authorization_url };
  } catch {
    return { disponivel: false, motivo: "fora-do-ar" };
  }
}

/** O que a tela diz quando o botão está desligado. Sempre o motivo real. */
export function recadoGoogle(motivo: Exclude<EstadoGoogle, { disponivel: true }>["motivo"]): string {
  return {
    "sem-backend": "Entrada por Google chega junto com o envio de e-mail.",
    "sem-credencial": "Entrada por Google ainda não foi configurada.",
    "fora-do-ar": "Entrada por Google indisponível agora. Use e-mail e senha.",
  }[motivo];
}
