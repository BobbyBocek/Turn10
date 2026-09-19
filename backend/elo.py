"""Central, återanvändbar Elo-motor anpassad för en sluten, återkommande grupp.

Alla justerbara konstanter ligger här på ett ställe så att gruppen enkelt kan
tweaka K-värden och streak-bonus efter att systemet testats.
"""

# --- Justerbara konstanter -------------------------------------------------
START_RATING = 1000

# K-faktor (hur mycket som står på spel per match)
K_NEW = 60          # Nya spelare: färre än NEW_PLAYER_MATCHES spelade matcher
K_ESTABLISHED = 20  # Etablerade spelare
K_ELITE = 15        # Elitspelare (rating >= ELITE_THRESHOLD)

NEW_PLAYER_MATCHES = 10
ELITE_THRESHOLD = 2000

# Vinststreak-bonus: K_eff = K_bas * (1 + WIN_STREAK_STEP * min(streak-1, WIN_STREAK_MAX_STEPS))
WIN_STREAK_STEP = 0.15
WIN_STREAK_MAX_STEPS = 5

# Förluststreak-"mercy": man förlorar mindre och mindre för varje gång man kommer sist i rad.
# K_eff = K_bas * (1 - LOSS_STREAK_STEP * min(streak-1, LOSS_STREAK_MAX_STEPS))
LOSS_STREAK_STEP = 0.10
LOSS_STREAK_MAX_STEPS = 5
# --------------------------------------------------------------------------


def base_k_factor(rating: float, matches_played: int) -> int:
    """Välj bas-K utifrån antal spelade matcher och rating."""
    if matches_played < NEW_PLAYER_MATCHES:
        return K_NEW
    if rating >= ELITE_THRESHOLD:
        return K_ELITE
    return K_ESTABLISHED


def expected_score(rating_x: float, rating_y: float) -> float:
    return 1.0 / (1.0 + 10 ** ((rating_y - rating_x) / 400.0))


def compute_match_elo(players):
    """Beräkna Elo-förändring för alla deltagare i en match.

    players: lista av dict med nycklarna
        user_id, rating, matches_played, win_streak, loss_streak, placement
    (placement 1 = vinnare, N = sist)

    Returnerar lista av dict med
        user_id, elo_before, elo_after, elo_delta, new_win_streak, new_loss_streak
    """
    n = len(players)
    worst_placement = max(p["placement"] for p in players)
    results = []

    for x in players:
        # Parvis Elo mot alla motståndare
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
        is_last = x["placement"] == worst_placement

        # Uppdatera sviter utifrån den här matchens resultat
        new_win_streak = (x.get("win_streak", 0) + 1) if is_winner else 0
        new_loss_streak = (x.get("loss_streak", 0) + 1) if is_last else 0

        k_eff = float(k_base)
        if is_winner and new_win_streak >= 2:
            steps = min(new_win_streak - 1, WIN_STREAK_MAX_STEPS)
            k_eff = k_base * (1 + WIN_STREAK_STEP * steps)
        elif is_last and new_loss_streak >= 2:
            steps = min(new_loss_streak - 1, LOSS_STREAK_MAX_STEPS)
            k_eff = k_base * (1 - LOSS_STREAK_STEP * steps)

        delta = round(k_eff * raw)
        results.append({
            "user_id": x["user_id"],
            "elo_before": x["rating"],
            "elo_after": x["rating"] + delta,
            "elo_delta": delta,
            "new_win_streak": new_win_streak,
            "new_loss_streak": new_loss_streak,
        })

    return results
