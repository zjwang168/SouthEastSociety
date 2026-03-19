import math

def calc_points_earned(donation_amount: float) -> int:
    """
    Credits are calculated from the current order donation amount only.

    Tiers:
    - < 400      -> 2%
    - 400-1500   -> 2.5%
    - 1500-3000  -> 3%
    - 3000-5000  -> 4%
    - > 5000     -> manual

    1 credit = 1 dollar
    """
    if donation_amount is None or donation_amount <= 0:
        return 0

    if donation_amount < 400:
        rate = 0.02
    elif donation_amount <= 1500:
        rate = 0.025
    elif donation_amount <= 3000:
        rate = 0.03
    elif donation_amount <= 5000:
        rate = 0.04
    else:
        return 0  # manual

    credits = donation_amount * rate
    return int(math.floor(credits))