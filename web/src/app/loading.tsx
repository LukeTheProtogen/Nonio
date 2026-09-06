/**
 * Estado de carregamento.
 *
 * Sem esqueleto cinza imitando o conteúdo: esqueleto que não corresponde ao que
 * vai chegar faz a página piscar duas vezes e parecer mais lenta do que é. Um
 * traço que corre já diz "está vindo".
 */
export default function Carregando() {
  return (
    <div
      className="flex w-full flex-1 items-center justify-center px-8 py-24"
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col items-center gap-4">
        <span className="relative block h-px w-40 overflow-hidden bg-rule">
          <span className="traco-carregando absolute inset-y-0 left-0 w-1/3 bg-modelo" />
        </span>
        <span className="eyebrow">Carregando</span>
      </div>
    </div>
  );
}
