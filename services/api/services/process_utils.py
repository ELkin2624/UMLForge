# Re-export desde packages.e2e_runner.executors.process para evitar duplicación
from e2e_runner.executors.process import _tail, run_command

__all__ = ["_tail", "run_command"]
