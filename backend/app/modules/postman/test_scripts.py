def generate_create_test_script(entity_var: str) -> list[str]:
    cap_entity = entity_var[0].upper() + entity_var[1:]
    return [
        'pm.test("Status code is 201", function () {',
        "    pm.response.to.have.status(201);",
        "});",
        "if (pm.response.code === 201) {",
        "    const json = pm.response.json();",
        f'    pm.collectionVariables.set("{entity_var}Id", json.id);',
        f'    const resolvedId = (json && (json.id !== undefined ? json.id : json.Id));',
        f'    if (resolvedId !== undefined) {{',
        f'        pm.collectionVariables.set("created{cap_entity}Id", resolvedId);',
        f'        try {{ pm.environment.set("created{cap_entity}Id", resolvedId); }} catch (e) {{}}',
        f'    }}',
        "}",
    ]


def generate_list_test_script() -> list[str]:
    return [
        'pm.test("Status code is 200", function () {',
        "    pm.response.to.have.status(200);",
        "});",
        'pm.test("Response is array", function () {',
        "    pm.expect(pm.response.json()).to.be.an('array');",
        "});",
    ]


def generate_get_by_id_test_script() -> list[str]:
    return [
        'pm.test("Status code is 200", function () {',
        "    pm.response.to.have.status(200);",
        "});",
        'pm.test("Response has id", function () {',
        "    const json = pm.response.json();",
        "    pm.expect(json.id !== undefined || json.Id !== undefined).to.be.true;",
        "});",
    ]



def generate_update_test_script() -> list[str]:
    return [
        'pm.test("Status code is 200", function () {',
        "    pm.response.to.have.status(200);",
        "});",
    ]


def generate_delete_test_script() -> list[str]:
    return [
        'pm.test("Status code is 204", function () {',
        "    pm.response.to.have.status(204);",
        "});",
    ]
