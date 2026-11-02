import pytest

from app.modules.diagram_store import (
    InMemoryDiagramRepository,
    VersionNotFound,
    ai_author,
    user_author,
)

ALICE = user_author(1, "Alice")


def _m(*names):
    return {"classes": [{"id": n, "name": n, "attributes": [], "operations": []} for n in names]}


@pytest.fixture
def repo():
    r = InMemoryDiagramRepository()
    r.create(1, _m(), ALICE)
    return r


def test_create_genera_version_1(repo):
    assert repo.current_version(1) == 1
    assert repo.get_version(1, 1)["source"] == "user"


def test_guardar_crea_version_con_autor(repo):
    v = repo.save(1, _m("A"), ALICE)
    assert v["version"] == 2 and v["author"]["name"] == "Alice"
    assert "data" not in v
    assert repo.get_data(1) == _m("A")


def test_guardar_igual_no_crea_version(repo):
    repo.save(1, _m("A"), ALICE)
    assert repo.save(1, _m("A"), ALICE) is None
    assert repo.current_version(1) == 2


def test_autor_ia(repo):
    v = repo.save(1, _m("A"), ai_author(1, "Alice"), source="ai")
    assert v["author"]["type"] == "ai"
    assert v["author"]["on_behalf_of"]["name"] == "Alice"


def test_restaurar_crea_version_nueva_y_conserva_historial(repo):
    repo.save(1, _m("A"), ALICE)
    repo.save(1, _m("A", "B"), ALICE)
    v = repo.restore(1, 2, user_author(2, "Bob"))
    assert v["version"] == 4 and v["source"] == "restore" and v["restored_from"] == 2
    assert repo.get_data(1) == _m("A")
    assert [x["version"] for x in repo.list_versions(1)] == [4, 3, 2, 1]


def test_restaurar_version_inexistente(repo):
    with pytest.raises(VersionNotFound):
        repo.restore(1, 99, ALICE)


def test_paginacion_y_borrado(repo):
    for i in range(5):
        repo.save(1, _m(*[f"C{j}" for j in range(i + 1)]), ALICE)
    assert [v["version"] for v in repo.list_versions(1, limit=2)] == [6, 5]
    assert [v["version"] for v in repo.list_versions(1, limit=2, before=5)] == [4, 3]
    repo.delete(1)
    assert not repo.has_document(1) and repo.list_versions(1) == []
