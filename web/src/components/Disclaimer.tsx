import {
  DISCLAIMER_CURTO,
  DISCLAIMER_LONGO,
  DISCLAIMER_MEDIO,
  FONTES_PUBLICAS,
} from "@/lib/conformidade";

/**
 * Enquadramento regulatório visível.
 *
 * `rodape` é o que vai em TODA tela — o plano é explícito quanto a isso.
 * `completo` é a página ou seção de enquadramento.
 *
 * Estilo deliberadamente neutro (cinzas do Tailwind, sem token de tema) para
 * não brigar com a paleta que está sendo definida no front. Passe `className`
 * para ajustar.
 */

export function DisclaimerRodape({ className = "" }: { className?: string }) {
  return (
    <footer
      className={`border-t border-neutral-200 dark:border-neutral-800 px-4 py-3 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400 ${className}`}
    >
      <p>
        {DISCLAIMER_CURTO}{" "}
        <span className="whitespace-nowrap">Resoluções CVM 19 e 20.</span>
      </p>
    </footer>
  );
}

export function DisclaimerLinha({ className = "" }: { className?: string }) {
  return (
    <p className={`text-xs leading-relaxed text-neutral-500 dark:text-neutral-400 ${className}`}>
      {DISCLAIMER_MEDIO}
    </p>
  );
}

export function DisclaimerCompleto({ className = "" }: { className?: string }) {
  return (
    <section className={`flex flex-col gap-4 text-sm leading-relaxed text-neutral-600 dark:text-neutral-300 ${className}`}>
      <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
        Enquadramento
      </h2>
      {DISCLAIMER_LONGO.map((p) => (
        <p key={p.slice(0, 32)}>{p}</p>
      ))}
      <div className="flex flex-col gap-1 pt-2 text-xs">
        <span className="font-medium text-neutral-700 dark:text-neutral-200">Fontes</span>
        {FONTES_PUBLICAS.map((f) => (
          <a
            key={f.url}
            href={f.url}
            className="underline underline-offset-2 hover:no-underline"
            target="_blank"
            rel="noreferrer"
          >
            {f.rotulo}
          </a>
        ))}
      </div>
    </section>
  );
}
