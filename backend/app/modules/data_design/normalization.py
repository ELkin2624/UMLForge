"""Teoría de normalización relacional (funciones puras, sin dependencias del dominio).

Trabaja con dependencias funcionales (DF) ``X -> Y`` sobre conjuntos de atributos
y devuelve, además de los resultados, los pasos de la demostración.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from itertools import combinations

FD = tuple[frozenset[str], frozenset[str]]

MAX_KEY_SEARCH_ATTRS = 16

NORMAL_FORM_ORDER = ["Sin 1FN", "1FN", "2FN", "3FN", "FNBC"]


def fmt(attrs: frozenset[str] | set[str] | list[str]) -> str:
    return "{" + ", ".join(sorted(attrs)) + "}"


def fmt_fd(fd: FD) -> str:
    return f"{', '.join(sorted(fd[0]))} → {', '.join(sorted(fd[1]))}"


def closure(attrs: frozenset[str] | set[str], fds: list[FD]) -> frozenset[str]:
    """Cierre de ``attrs`` bajo ``fds`` (X+)."""
    result = set(attrs)
    changed = True
    while changed:
        changed = False
        for lhs, rhs in fds:
            if lhs <= result and not rhs <= result:
                result |= rhs
                changed = True
    return frozenset(result)


def is_trivial(fd: FD) -> bool:
    return fd[1] <= fd[0]


def candidate_keys(
    attributes: frozenset[str], fds: list[FD]
) -> tuple[list[frozenset[str]], bool]:
    """Claves candidatas. Devuelve ``(claves, exacto)``; ``exacto`` es False si la
    búsqueda se truncó por exceso de atributos."""
    in_rhs = set().union(*(rhs - lhs for lhs, rhs in fds)) if fds else set()
    essential = frozenset(a for a in attributes if a not in in_rhs)
    if closure(essential, fds) >= attributes:
        return [essential], True

    optional = sorted(attributes - essential)
    if len(optional) > MAX_KEY_SEARCH_ATTRS:
        return [], False

    keys: list[frozenset[str]] = []
    for size in range(1, len(optional) + 1):
        for combo in combinations(optional, size):
            candidate = essential | frozenset(combo)
            if any(k <= candidate for k in keys):
                continue
            if closure(candidate, fds) >= attributes:
                keys.append(candidate)
    return keys, True


def prime_attributes(keys: list[frozenset[str]]) -> frozenset[str]:
    return frozenset().union(*keys) if keys else frozenset()


@dataclass
class Check:
    form: str
    ok: bool
    detail: str
    evidence: list[str] = field(default_factory=list)


def check_2nf(
    attributes: frozenset[str], fds: list[FD], keys: list[frozenset[str]]
) -> Check:
    prime = prime_attributes(keys)
    evidence: list[str] = []
    for key in keys:
        if len(key) < 2:
            continue
        for size in range(1, len(key)):
            for sub in combinations(sorted(key), size):
                sub_set = frozenset(sub)
                determined = (closure(sub_set, fds) - sub_set) - prime
                for attr in sorted(determined & attributes):
                    evidence.append(
                        f"{attr} depende solo de {fmt(sub_set)}, "
                        f"parte de la clave {fmt(key)} (dependencia parcial)"
                    )
    if evidence:
        return Check("2FN", False, "Hay dependencias parciales de la clave.", evidence)
    if all(len(k) == 1 for k in keys):
        return Check(
            "2FN", True,
            "Todas las claves candidatas tienen un solo atributo: no puede haber "
            "dependencias parciales.",
        )
    return Check("2FN", True, "Ningún atributo no primo depende de parte de una clave.")


def check_3nf(
    attributes: frozenset[str], fds: list[FD], keys: list[frozenset[str]]
) -> Check:
    prime = prime_attributes(keys)
    evidence: list[str] = []
    for lhs, rhs in fds:
        if is_trivial((lhs, rhs)):
            continue
        if closure(lhs, fds) >= attributes:
            continue  # X es superclave
        offenders = sorted((rhs - lhs) - prime)
        if offenders:
            evidence.append(
                f"{fmt_fd((lhs, rhs))}: {fmt(lhs)} no es superclave y "
                f"{', '.join(offenders)} no es primo (dependencia transitiva)"
            )
    if evidence:
        return Check("3FN", False, "Hay dependencias transitivas.", evidence)
    return Check(
        "3FN", True,
        "Para toda DF no trivial X → A: X es superclave o A es atributo primo.",
    )


def check_bcnf(attributes: frozenset[str], fds: list[FD]) -> Check:
    evidence: list[str] = []
    for lhs, rhs in fds:
        if is_trivial((lhs, rhs)):
            continue
        if closure(lhs, fds) >= attributes:
            continue
        evidence.append(f"{fmt_fd((lhs, rhs))}: {fmt(lhs)} no es superclave")
    if evidence:
        return Check("FNBC", False, "Hay determinantes que no son superclave.", evidence)
    return Check("FNBC", True, "Todo determinante de una DF no trivial es superclave.")


def normal_form(checks: list[Check]) -> str:
    """Forma normal más alta alcanzada (las formas son acumulativas)."""
    by_form = {c.form: c.ok for c in checks}
    if not by_form.get("1FN", True):
        return "Sin 1FN"
    if not by_form.get("2FN", True):
        return "1FN"
    if not by_form.get("3FN", True):
        return "2FN"
    if not by_form.get("FNBC", True):
        return "3FN"
    return "FNBC"


def minimal_cover(fds: list[FD]) -> tuple[list[FD], list[str]]:
    """Recubrimiento mínimo (canónico) y la bitácora de pasos."""
    steps: list[str] = []

    # 1. RHS de un solo atributo, sin triviales.
    work: list[FD] = []
    for lhs, rhs in fds:
        for attr in sorted(rhs - lhs):
            fd = (lhs, frozenset({attr}))
            if fd not in work:
                work.append(fd)
    steps.append(
        "Paso 1 · Separar lados derechos en un solo atributo: "
        + (", ".join(fmt_fd(f) for f in work) or "(sin dependencias no triviales)")
    )

    # 2. Quitar atributos extraños del lado izquierdo.
    reduced: list[FD] = []
    for index, (lhs, rhs) in enumerate(work):
        current = set(lhs)
        for attr in sorted(lhs):
            if len(current) == 1:
                break
            others = work[:index] + [(frozenset(current), rhs)] + work[index + 1:]
            if rhs <= closure(current - {attr}, others):
                current.discard(attr)
                steps.append(
                    f"Paso 2 · {attr} es extraño en {fmt_fd((lhs, rhs))}; "
                    f"queda {fmt_fd((frozenset(current), rhs))}"
                )
        reduced.append((frozenset(current), rhs))
        work[index] = (frozenset(current), rhs)
    work = list(dict.fromkeys(reduced))

    # 3. Quitar dependencias redundantes.
    result = list(work)
    for fd in list(result):
        rest = [f for f in result if f != fd]
        if fd[1] <= closure(fd[0], rest):
            result = rest
            steps.append(f"Paso 3 · {fmt_fd(fd)} es redundante; se elimina")
    steps.append(
        "Recubrimiento mínimo: " + (", ".join(fmt_fd(f) for f in result) or "(vacío)")
    )
    return result, steps


@dataclass
class Relation:
    name: str
    attributes: list[str]
    primary_key: list[str]
    fds: list[str]


@dataclass
class Decomposition:
    steps: list[str]
    relations: list[Relation]
    lossless: bool
    preserves_dependencies: bool
    explanation: str


def synthesize_3nf(
    table: str,
    attributes: frozenset[str],
    fds: list[FD],
    keys: list[frozenset[str]],
    original_pk: list[str],
) -> Decomposition:
    """Síntesis de Bernstein: descomposición en 3FN sin pérdida y con
    preservación de dependencias."""
    cover, steps = minimal_cover(fds)

    grouped: dict[frozenset[str], set[str]] = {}
    for lhs, rhs in cover:
        grouped.setdefault(lhs, set()).update(rhs)
    schemes: list[tuple[frozenset[str], frozenset[str]]] = [
        (frozenset(lhs | rhs), lhs) for lhs, rhs in grouped.items()
    ]
    steps.append(
        "Paso 4 · Agrupar por determinante (una relación por cada lado izquierdo): "
        + (", ".join(fmt(s[0]) for s in schemes) or "(ninguna)")
    )

    if not any(any(k <= attrs for k in keys) for attrs, _ in schemes):
        key = min(keys, key=lambda k: (len(k), sorted(k))) if keys else attributes
        schemes.append((frozenset(key), frozenset(key)))
        steps.append(
            f"Paso 5 · Ninguna relación contiene una clave candidata; se agrega "
            f"una con la clave {fmt(key)} (garantiza descomposición sin pérdida)"
        )
    else:
        steps.append(
            "Paso 5 · Alguna relación ya contiene una clave candidata; "
            "no hace falta agregar otra"
        )

    # Quitar relaciones repetidas o contenidas en otras.
    kept: list[tuple[frozenset[str], frozenset[str]]] = []
    for attrs, key in schemes:
        if any(attrs < other for other, _ in schemes):
            steps.append(f"Paso 6 · {fmt(attrs)} está contenida en otra relación; se elimina")
        elif any(attrs == other for other, _ in kept):
            continue
        else:
            kept.append((attrs, key))

    # Atributos sueltos que ninguna DF cubre (deben conservarse con la clave).
    covered = set().union(*(a for a, _ in kept)) if kept else set()
    missing = attributes - covered
    if missing and kept:
        key_rel = next(
            (i for i, (a, _) in enumerate(kept) if any(k <= a for k in keys)), 0
        )
        a, k = kept[key_rel]
        kept[key_rel] = (a | frozenset(missing), k)
        steps.append(f"Paso 6 · {fmt(missing)} no aparece en ninguna DF; se une a la relación de la clave")

    relations: list[Relation] = []
    used: set[str] = set()
    for attrs, key in kept:
        if set(original_pk) and set(original_pk) <= attrs and key == frozenset(original_pk):
            name = table
        else:
            base = "_".join(sorted(a.removesuffix("_id").removesuffix("Id") for a in key))
            name = base or f"{table}_aux"
        while name in used:
            name = f"{name}_{len(used)}"
        used.add(name)
        held = [fmt_fd(f) for f in cover if f[0] | f[1] <= attrs]
        relations.append(Relation(name, sorted(attrs), sorted(key), held))
    relations.sort(key=lambda r: (r.name != table, r.name))

    return Decomposition(
        steps=steps,
        relations=relations,
        lossless=True,
        preserves_dependencies=True,
        explanation=(
            "La síntesis de Bernstein garantiza una descomposición en 3FN sin "
            "pérdida de información (alguna relación contiene una clave "
            "candidata) y que preserva todas las dependencias funcionales "
            "(cada DF del recubrimiento mínimo vive en alguna relación)."
        ),
    )
