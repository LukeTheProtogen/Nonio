/**
 * Regras de senha.
 *
 * Módulo neutro, sem "use client": as mesmas regras rodam no formulário, para
 * dar retorno enquanto a pessoa digita, e no servidor, na hora de validar.
 * Duplicar a lista nos dois lados é como elas passam a divergir.
 *
 * Nada de exigir maiúscula, símbolo e troca a cada 90 dias. Isso produz senha
 * pior, não melhor: as pessoas viram "Senha@2026" e anotam no papel. Tamanho é
 * o que importa, e o resto é teatro.
 */

/** As mais usadas do Brasil somadas às globais. Lista curta é suficiente. */
const COMUNS = new Set([
  "senha123456",
  "1234567890",
  "12345678901",
  "password123",
  "brasil2026",
  "qwertyuiop",
  "senhasenha",
  "abc123456789",
  "flamengo123",
  "corinthians1",
]);

export type Regra = {
  id: string;
  rotulo: string;
  cumpre: (senha: string) => boolean;
};

export const REGRAS: Regra[] = [
  {
    id: "tamanho",
    rotulo: "Pelo menos 10 caracteres",
    cumpre: (s) => s.length >= 10,
  },
  {
    id: "mistura",
    rotulo: "Uma letra e um número",
    cumpre: (s) => /\p{L}/u.test(s) && /\d/.test(s),
  },
  {
    id: "comum",
    rotulo: "Não pode ser uma senha comum",
    cumpre: (s) => s.length > 0 && !COMUNS.has(s.toLowerCase()),
  },
];

export function senhaValida(senha: string): boolean {
  return REGRAS.every((r) => r.cumpre(senha));
}

/** Quantas regras a senha cumpre. Alimenta a barra de força, de 0 a 3. */
export function forca(senha: string): number {
  return REGRAS.filter((r) => r.cumpre(senha)).length;
}

/** Validação frouxa de e-mail: só o suficiente para pegar erro de digitação. */
export function emailPlausivel(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}
