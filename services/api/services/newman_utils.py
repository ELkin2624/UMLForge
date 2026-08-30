# Re-export desde packages.e2e_runner.executors.newman para evitar duplicación
from e2e_runner.executors.newman import (
    check_newman_available,
    find_newman_command,
    run_newman,
)

__all__ = ["check_newman_available", "find_newman_command", "run_newman"]
