# Re-export desde packages.app.modules.e2e.executors.process para evitar duplicación
from app.modules.e2e.executors.process import _tail, run_command

__all__ = ["_tail", "run_command"]
