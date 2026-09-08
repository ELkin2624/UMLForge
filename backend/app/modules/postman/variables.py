from .models import PostmanVariable


def generate_collection_variables(
    base_url: str, postman_defaults: dict[str, str] | None = None
) -> list[PostmanVariable]:
    vars_list = [PostmanVariable(key="baseUrl", value=base_url, type="string")]

    if postman_defaults:
        for key, val in postman_defaults.items():
            vars_list.append(PostmanVariable(key=key, value=str(val), type="string"))

    return vars_list


def generate_environment_values(
    base_url: str, postman_defaults: dict[str, str] | None = None
) -> list[PostmanVariable]:
    vars_list = [PostmanVariable(key="baseUrl", value=base_url, type="string")]

    if postman_defaults:
        for key, val in postman_defaults.items():
            vars_list.append(PostmanVariable(key=key, value=str(val), type="string"))

    return vars_list
