import { existsSync } from "node:fs";
import path from "node:path";
import Image from "next/image";

/**
 * A arte do bloco de fecho.
 *
 * Componente de servidor, então ele CONSEGUE olhar o disco. É de propósito:
 * basta soltar o arquivo em `public/marketing/fecho.jpg` e ele aparece no
 * próximo build, sem ninguém precisar mexer em código.
 *
 * Enquanto o arquivo não existe, entra o desenho abaixo — que não é
 * espaço reservado nem caixa cinza escrita "imagem aqui". É a tese da página
 * em figura: cem projeções espalhadas, uma linha atravessando, e uma leitura
 * só marcada. Se a imagem nunca vier, a página continua inteira.
 *
 * O caminho é conferido em tempo de build. Trocar a imagem exige rebuild, o que
 * é aceitável num site que já é reconstruído a cada mudança de dado.
 */
const ARQUIVO = "/marketing/fecho.jpg";

export function ArteFecho() {
  const existe = existsSync(path.join(process.cwd(), "public", ARQUIVO));

  if (existe) {
    return (
      <Image
        src={ARQUIVO}
        alt="Paquímetro apoiado sobre papel, com a escala auxiliar em foco."
        width={1400}
        height={1050}
        className="aproxima block h-auto w-full rounded-xl"
        sizes="(min-width: 1024px) 40vw, 100vw"
      />
    );
  }

  return <Constelacao />;
}

/**
 * A discordância virando leitura, em figura.
 *
 * Pontos espalhados em torno de um centro, uma linha atravessando, e um único
 * traço marcando onde a leitura cai. É a página inteira num desenho, e resolve
 * o canto vazio sem foto de banco de imagem.
 *
 * Posições determinísticas: a mesma semente do resto do projeto, para o desenho
 * não mudar a cada render e o arquivo não sujar diffs.
 *
 * Os pontos são calculados FORA do componente, uma vez por processo.
 *
 * Não é otimização: o gerador guarda estado entre chamadas, e mutar estado
 * durante a renderização é justamente o que o React proíbe — com renderização
 * concorrente, o mesmo componente pode ser renderizado duas vezes e as duas
 * passadas sairiam com desenhos diferentes.
 */
const PONTOS = (() => {
  let semente = 20260906;
  const aleatorio = () => {
    semente = (semente * 1103515245 + 12345) % 2147483648;
    return semente / 2147483648;
  };

  return Array.from({ length: 96 }, () => {
    // Box-Muller: a nuvem tem a forma de uma distribuição, não de um borrão.
    const u1 = Math.max(aleatorio(), 1e-9);
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * aleatorio());
    const w =
      Math.sqrt(-2 * Math.log(Math.max(aleatorio(), 1e-9))) * Math.cos(2 * Math.PI * aleatorio());
    return { x: 210 + z * 62, y: 190 + w * 44, r: 2 + aleatorio() * 2.6 };
  });
})();

function Constelacao() {
  return (
    <svg
      viewBox="0 0 420 380"
      className="block h-auto w-full"
      role="img"
      aria-label="Desenho: dezenas de projeções espalhadas, com uma única leitura marcada no meio."
    >
      {PONTOS.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={p.r}
          fill="currentColor"
          fillOpacity={0.28}
          className="surge-rolagem"
          style={{ ["--inicio" as string]: `${6 + Math.min(i * 0.34, 30)}%` }}
        />
      ))}

      {/* A régua atravessando a nuvem: a escala que transforma nuvem em número. */}
      <line
        x1={34}
        y1={296}
        x2={386}
        y2={296}
        stroke="currentColor"
        strokeOpacity={0.5}
        strokeWidth={1.5}
        pathLength={1}
        className="desenha-rolagem"
      />
      {Array.from({ length: 25 }, (_, i) => {
        const x = 34 + i * 14.6;
        const alto = i % 5 === 0;
        return (
          <line
            key={i}
            x1={x}
            y1={296}
            x2={x}
            y2={296 + (alto ? 14 : 8)}
            stroke="currentColor"
            strokeOpacity={0.4}
            strokeWidth={1}
          />
        );
      })}

      {/* A leitura: o único traço cheio do desenho. */}
      <line x1={210} y1={120} x2={210} y2={314} stroke="currentColor" strokeWidth={2} />
      <circle cx={210} cy={190} r={7} fill="currentColor" />
    </svg>
  );
}
