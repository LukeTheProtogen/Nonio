/**
 * Identificação legal — PENDENTE. Ver `src/mock/README.md`.
 *
 * Termos e política de privacidade sem razão social, CNPJ e endereço não
 * identificam quem responde pelo serviço, e é justamente isso que o Marco Civil
 * (art. 7º) e a LGPD (art. 41) exigem que esteja visível.
 *
 * Os colchetes são propositais: aparecem na tela como colchetes, e ninguém
 * publica um documento assim por engano. Preencher antes de qualquer domínio
 * público.
 */
export const EMPRESA = {
  razaoSocial: "[RAZÃO SOCIAL]",
  cnpj: "[CNPJ]",
  endereco: "[ENDEREÇO COMPLETO]",
  cidade: "[CIDADE/UF]",
  email: "contato@nonio.com.br",
  emailPrivacidade: "privacidade@nonio.com.br",
  /** Encarregado de dados (DPO), art. 41 da LGPD. */
  encarregado: "[NOME DO ENCARREGADO]",
} as const;

/** Data de entrada em vigor dos documentos. Mudou o texto, muda a data. */
export const VIGENCIA = "5 de setembro de 2026";
