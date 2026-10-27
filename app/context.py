from contextvars import ContextVar


######################## FILE TO GET CURRENT TASK ###############################
# The task the worker is running right now, so every model call can be linked to it
current_task: ContextVar[int | None] = ContextVar("current_task", default=None)