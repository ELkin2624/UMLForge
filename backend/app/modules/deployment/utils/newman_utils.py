# Re-export desde packages.app.modules.e2e.executors.newman para evitar duplicación
from app.modules.e2e.executors.newman import (
    check_newman_available,
    find_newman_command,
    run_newman,
)

__all__ = ["check_newman_available", "find_newman_command", "run_newman"]
