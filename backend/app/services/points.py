import math

def calc_points_earned(amount: float) -> int:
    # Rule: $1 = 1 point
    # Use floor to avoid decimals: $10.99 -> 10 points
    return int(math.floor(float(amount)))