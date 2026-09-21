"""Central, återanvändbar Elo-motor för Turn10 – anpassad för en sluten grupp.

Alla justerbara konstanter ligger här på ett ställe.
"""
import math

# --- Justerbara konstanter -------------------------------------------------
START_RATING = 1000

K_NEW = 60
K_ESTABLISHED = 20
K_ELITE = 15

NEW_PLAYER_MATCHES = 20  # längre placeringsfas: de första 20 matcherna svänger mer
ELITE_THRESHOLD = 2000

# Vinststreak-bonus (förstärker): K_eff = K_bas * (1 + 0.15 * min(streak-1, 5))
WIN_STREAK_STEP = 0.15
WIN_STREAK_MAX_STEPS = 5

# Förluststreak-dämpning: K_eff = K_bas * max(1 - 0.10 * min(streak-1, 5), 0.5)
LOSS_STREAK_STEP = 0.10
LOSS_STREAK_MAX_STEPS = 5
LOSS_STREAK_FLOOR = 0.5

# Utgångsbonus (baserat på sista lagda kortet): round((15 - X) * 0.4), lägst 0
EXIT_BONUS_FACTOR = 0.4
EXIT_BONUS_BASE = 15
EXIT_BONUS_ZERO_CARDS = {2, 10}  # 2:a och 10:a ger alltid 0
# --------------------------------------------------------------------------


def base_k_factor(rating: float, matches_played: int) -> int:
    if matches_played < NEW_PLAYER_MATCHES:
        return K_NEW
    if rating >= ELITE_THRESHOLD:
        return K_ELITE
    return K_ESTABLISHED


def expected_score(rating_x: float, rating_y: float) -> float:
    return 1.0 / (1.0 + 10 ** ((rating_y - rating_x) / 400.0))


def exit_bonus(card_value) -> int:
    """Elo-bonus baserad på sista lagda kortets valör (2-14). 2:a & 10:a => 0."""
    if card_value is None:
        return 0
    try:
        v = int(card_value)
    except (TypeError, ValueError):
        return 0
    if v in EXIT_BONUS_ZERO_CARDS:
        return 0
    if v < 2 or v > 14:
        return 0
    return max(round((EXIT_BONUS_BASE - v) * EXIT_BONUS_FACTOR), 0)


def compute_match_elo(players):
    """Beräkna parvis Elo-förändring (utan utgångsbonus).

    players: dict med user_id, rating, matches_played, win_streak, loss_streak, placement
    Returnerar dict med user_id, elo_before, base_delta, new_win_streak, new_loss_streak
    """
    n = len(players)
    worst = max(p["placement"] for p in players)
    results = []

    for x in players:
        total = 0.0
        for y in players:
            if y["user_id"] == x["user_id"]:
                continue
            e_xy = expected_score(x["rating"], y["rating"])
            s_xy = 1.0 if x["placement"] < y["placement"] else 0.0
            total += (s_xy - e_xy)
        raw = total / (n - 1)

        k_base = base_k_factor(x["rating"], x["matches_played"])
        is_winner = x["placement"] == 1
        is_last = x["placement"] == worst

        new_win_streak = (x.get("win_streak", 0) + 1) if is_winner else 0
        new_loss_streak = (x.get("loss_streak", 0) + 1) if not is_winner else 0

        k_eff = float(k_base)
        if is_winner and new_win_streak >= 2:
            steps = min(new_win_streak - 1, WIN_STREAK_MAX_STEPS)
            k_eff = k_base * (1 + WIN_STREAK_STEP * steps)
        elif not is_winner and new_loss_streak >= 2:
            steps = min(new_loss_streak - 1, LOSS_STREAK_MAX_STEPS)
            k_eff = k_base * max(1 - LOSS_STREAK_STEP * steps, LOSS_STREAK_FLOOR)

        base_delta = round(k_eff * raw)

        # Golvregel: presterar du bättre än eller lika med halva fältet kan
        # själva parvisa uträkningen aldrig ge minus (utgångsbonus läggs till efteråt).
        upper_half = math.ceil(n / 2)
        if x["placement"] <= upper_half and base_delta < 0:
            base_delta = 0

        results.append({
            "user_id": x["user_id"],
            "elo_before": x["rating"],
            "base_delta": base_delta,
            "new_win_streak": new_win_streak,
            "new_loss_streak": new_loss_streak,
        })

    return results
