import logging
from app.config import BUDGETS
from app.db import month_cost


##### FILE FOR CHECKING THE TOKEN USAGE TOWARDS THE BUDGET #########################


log = logging.getLogger("Hephaestus.budget")

class BudgetExceeded(Exception):
    pass

def check_budget(agent: str) -> None:
    """Raise BudgetExceeded if the agent has used its monthly limit."""
    limit = BUDGETS.get(agent)
    if limit is None:
        return
    spent = month_cost(agent)
    if spent >= limit:
        message = f"{agent} has used ${spent:.4f} of ${limit:.4f} this month"
        log.warning("Budget stop: %s", message)
        raise BudgetExceeded(message)