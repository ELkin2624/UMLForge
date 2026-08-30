from .models import PostmanVariable


def generate_collection_variables(base_url: str) -> list[PostmanVariable]:
    return [PostmanVariable(key="baseUrl", value=base_url, type="string")]


def generate_environment_values(base_url: str) -> list[PostmanVariable]:
    return [PostmanVariable(key="baseUrl", value=base_url, type="string")]
