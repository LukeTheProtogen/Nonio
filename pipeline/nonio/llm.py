"""Camada de LLM, com provedor trocável.

O padrão é Anthropic, porque é onde a citação com localização de página funciona
de forma nativa — e essa é a feature que sustenta a auditabilidade do produto.
Mas a geração de texto e a extração estruturada são fungíveis, e ficam atrás de
uma interface para que trocar de provedor não exija reescrever o pipeline.

Seleção por ambiente:

    LLM_PROVEDOR=anthropic          # padrão
    LLM_PROVEDOR=openai             # OpenAI, ou qualquer serviço compatível
    LLM_PROVEDOR=google             # Gemini
    LLM_MODELO=...                  # sobrescreve o padrão do provedor
    LLM_BASE_URL=...                # só para o compatível-OpenAI

Nada disso é instalado por padrão além do Anthropic. Os SDKs alternativos são
extras opcionais — ver pyproject.toml. O import é preguiçoso: pedir um provedor
sem o SDK dá mensagem dizendo qual comando resolve.
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import Any, Protocol, runtime_checkable


class ChaveAusente(RuntimeError):
    pass


class SdkAusente(RuntimeError):
    pass


class RecursoIndisponivel(NotImplementedError):
    """O provedor selecionado não oferece o recurso pedido."""


@dataclass(frozen=True)
class Capacidades:
    """O que este provedor sabe fazer.

    Declarado explicitamente porque **não é uniforme**. Fingir que é foi o que
    quebrou muita camada de abstração de LLM por aí: o código chama um recurso
    que só existe num provedor e falha em produção, no outro.
    """
    citacao_com_fonte: bool   # devolve o trecho e a localização no documento?
    lote_com_desconto: bool   # tem Batch API mais barata?
    saida_estruturada: bool   # aceita JSON Schema na resposta?
    contexto_tokens: int


@runtime_checkable
class Provedor(Protocol):
    nome: str
    modelo: str
    capacidades: Capacidades

    def disponivel(self) -> bool: ...
    def gerar(self, prompt: str, *, max_tokens: int = 4000,
              sistema: str | None = None) -> str: ...


# ─────────────────────────── Anthropic (padrão) ───────────────────────────
@dataclass
class ProvedorAnthropic:
    modelo: str = os.environ.get("LLM_MODELO") or "claude-opus-5"
    nome: str = "anthropic"
    capacidades: Capacidades = field(default_factory=lambda: Capacidades(
        citacao_com_fonte=True,   # citations nos blocos document, com page_location
        lote_com_desconto=True,   # Batch API, 50%
        saida_estruturada=True,   # output_config.format
        contexto_tokens=1_000_000,
    ))

    def disponivel(self) -> bool:
        return bool(os.environ.get("ANTHROPIC_API_KEY"))

    def _cliente(self):
        try:
            import anthropic
        except ImportError as e:
            raise SdkAusente("uv add anthropic") from e
        if not self.disponivel():
            raise ChaveAusente(
                "ANTHROPIC_API_KEY não definida. Preencha no .env ou aponte "
                "LLM_PROVEDOR para outro provedor."
            )
        return anthropic.Anthropic()

    def gerar(self, prompt: str, *, max_tokens: int = 4000,
              sistema: str | None = None) -> str:
        args: dict[str, Any] = {
            "model": self.modelo,
            "max_tokens": max_tokens,
            "thinking": {"type": "adaptive"},
            "messages": [{"role": "user", "content": prompt}],
        }
        if sistema:
            args["system"] = sistema
        r = self._cliente().messages.create(**args)
        return "".join(b.text for b in r.content if b.type == "text")


# ────────────── Compatível com OpenAI (cobre muitos serviços) ──────────────
@dataclass
class ProvedorOpenAICompat:
    """Um adaptador, vários serviços.

    Groq, Together, OpenRouter, DeepSeek, Fireworks, vLLM, Ollama e LM Studio
    expõem o mesmo formato de chat da OpenAI. Trocar de um para outro é mudar
    LLM_BASE_URL e LLM_MODELO — nenhuma linha de código.

    Exemplos de LLM_BASE_URL:
        OpenAI      (padrão, não precisa definir)
        Groq        https://api.groq.com/openai/v1
        OpenRouter  https://openrouter.ai/api/v1
        DeepSeek    https://api.deepseek.com/v1
        Ollama      http://localhost:11434/v1     (local, sem chave)
    """
    modelo: str = os.environ.get("LLM_MODELO") or "gpt-5"
    base_url: str | None = os.environ.get("LLM_BASE_URL")
    nome: str = "openai-compat"
    capacidades: Capacidades = field(default_factory=lambda: Capacidades(
        citacao_com_fonte=False,  # não há equivalente direto de page_location
        lote_com_desconto=True,
        saida_estruturada=True,
        contexto_tokens=0,        # varia demais por modelo para declarar aqui
    ))

    def disponivel(self) -> bool:
        # Serviço local (Ollama, vLLM) roda sem chave.
        return bool(os.environ.get("OPENAI_API_KEY") or self.base_url)

    def _cliente(self):
        try:
            from openai import OpenAI
        except ImportError as e:
            raise SdkAusente('uv add "nonio-pipeline[openai]"') from e
        if not self.disponivel():
            raise ChaveAusente("OPENAI_API_KEY não definida (ou defina LLM_BASE_URL "
                               "para um serviço local).")
        return OpenAI(api_key=os.environ.get("OPENAI_API_KEY", "sem-chave"),
                      base_url=self.base_url)

    def gerar(self, prompt: str, *, max_tokens: int = 4000,
              sistema: str | None = None) -> str:
        mensagens: list[dict[str, str]] = []
        if sistema:
            mensagens.append({"role": "system", "content": sistema})
        mensagens.append({"role": "user", "content": prompt})
        r = self._cliente().chat.completions.create(
            model=self.modelo, messages=mensagens, max_tokens=max_tokens,
        )
        return r.choices[0].message.content or ""


# ─────────────────────────────── Google ───────────────────────────────────
@dataclass
class ProvedorGoogle:
    modelo: str = os.environ.get("LLM_MODELO") or "gemini-2.5-pro"
    nome: str = "google"
    capacidades: Capacidades = field(default_factory=lambda: Capacidades(
        citacao_com_fonte=False,  # há grounding metadata, com outra forma
        lote_com_desconto=True,
        saida_estruturada=True,
        contexto_tokens=0,
    ))

    def disponivel(self) -> bool:
        return bool(os.environ.get("GOOGLE_API_KEY")
                    or os.environ.get("GEMINI_API_KEY"))

    def _cliente(self):
        try:
            from google import genai
        except ImportError as e:
            raise SdkAusente('uv add "nonio-pipeline[google]"') from e
        if not self.disponivel():
            raise ChaveAusente("GOOGLE_API_KEY (ou GEMINI_API_KEY) não definida.")
        return genai.Client()

    def gerar(self, prompt: str, *, max_tokens: int = 4000,
              sistema: str | None = None) -> str:
        conteudo = f"{sistema}\n\n{prompt}" if sistema else prompt
        r = self._cliente().models.generate_content(
            model=self.modelo, contents=conteudo,
        )
        return r.text or ""


REGISTRO: dict[str, type] = {
    "anthropic": ProvedorAnthropic,
    "openai": ProvedorOpenAICompat,
    "google": ProvedorGoogle,
}


def provedor(nome: str | None = None) -> Provedor:
    escolhido = (nome or os.environ.get("LLM_PROVEDOR") or "anthropic").lower()
    if escolhido not in REGISTRO:
        raise ValueError(
            f"LLM_PROVEDOR '{escolhido}' desconhecido. "
            f"Opções: {', '.join(sorted(REGISTRO))}"
        )
    return REGISTRO[escolhido]()


def exigir_citacao() -> Provedor:
    """Para o caminho auditável, que não é portátil.

    A citação com localização no documento é o que sustenta o diferencial do
    produto — cada afirmação apontando para a página da ata. Só o Anthropic
    entrega isso de forma nativa hoje. Em vez de degradar em silêncio e entregar
    narrativa sem fonte, este atalho falha alto.
    """
    p = provedor()
    if not p.capacidades.citacao_com_fonte:
        raise RecursoIndisponivel(
            f"O provedor '{p.nome}' não devolve citação com localização de fonte. "
            "O caminho auditável exige LLM_PROVEDOR=anthropic. Para narrativa "
            "sem citação, use provedor() normalmente."
        )
    return p


# Compatibilidade com o que já existia no repositório.
MODELO = ProvedorAnthropic.modelo


def narrar(prompt: str, max_tokens: int = 4000, sistema: str | None = None) -> str:
    return provedor().gerar(prompt, max_tokens=max_tokens, sistema=sistema)


def verificar() -> str:
    p = provedor()
    return f"{p.nome} / {p.modelo}: {p.gerar('Responda apenas: ok', max_tokens=64)}"


def diagnostico() -> str:
    linhas = ["provedor          chave?  citação  lote  estruturado"]
    for nome, cls in sorted(REGISTRO.items()):
        p = cls()
        c = p.capacidades
        linhas.append(
            f"{nome:<17} {'sim' if p.disponivel() else 'não':<7} "
            f"{'sim' if c.citacao_com_fonte else 'não':<8} "
            f"{'sim' if c.lote_com_desconto else 'não':<5} "
            f"{'sim' if c.saida_estruturada else 'não'}"
        )
    atual = provedor()
    linhas.append(f"\nselecionado: {atual.nome} / {atual.modelo}")
    return "\n".join(linhas)


# ── Armadilhas do dia 2, registradas agora ──────────────────────────────────
#
# 1. No Anthropic, `citations` e `output_config.format` são INCOMPATÍVEIS na
#    mesma requisição (400). Dois passes: extração estruturada primeiro,
#    narrativa com citação depois.
#
# 2. As 280 atas vão por Batch API (metade do preço) + Files API. Trabalho do
#    dia 2 — consulte a referência do SDK antes, que mudou na linha 1.x.

if __name__ == "__main__":
    print(diagnostico())
