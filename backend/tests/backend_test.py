"""Backend regression tests for Kortkväll app."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://rating-cards-2.preview.emergentagent.com').rstrip('/')
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "tom.jenssen@live.se"
ADMIN_PASSWORD = "Kortspel2026!"
PLAYERS = ["erik@test.se", "johan@test.se", "anders@test.se", "sara@test.se", "lisa@test.se"]
PLAYER_PW = "Spela123!"


@pytest.fixture(scope="session")
def admin_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    return s


# --- Auth -----------------------------------------------------------------
class TestAuth:
    def test_login_success(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 200
        d = r.json()
        assert d["email"] == ADMIN_EMAIL
        assert "id" in d
        assert r.cookies.get("access_token")

    def test_login_wrong_password(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong"})
        assert r.status_code == 401
        assert "Fel" in r.json().get("detail", "")

    def test_me_requires_auth(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_me_with_cookie(self, admin_session):
        r = admin_session.get(f"{API}/auth/me")
        assert r.status_code == 200
        assert r.json()["email"] == ADMIN_EMAIL

    def test_register_duplicate(self):
        r = requests.post(f"{API}/auth/register", json={"name": "X", "email": ADMIN_EMAIL, "password": "x", "invite_code": "267710"})
        assert r.status_code == 400

    def test_register_wrong_invite_code(self):
        email = f"test_{uuid.uuid4().hex[:8]}@test.se"
        r = requests.post(f"{API}/auth/register", json={"name": "Ny", "email": email, "password": "Hemligt1!", "invite_code": "000000"})
        assert r.status_code == 403
        assert "Ogiltig" in r.json().get("detail", "")

    def test_register_missing_invite_code(self):
        email = f"test_{uuid.uuid4().hex[:8]}@test.se"
        r = requests.post(f"{API}/auth/register", json={"name": "Ny", "email": email, "password": "Hemligt1!"})
        assert r.status_code == 422

    def test_register_new_and_login(self):
        email = f"test_{uuid.uuid4().hex[:8]}@test.se"
        r = requests.post(f"{API}/auth/register", json={"name": "Ny", "email": email, "password": "Hemligt1!", "invite_code": "267710"})
        assert r.status_code == 200, r.text
        assert r.json()["email"] == email
        # login (no invite needed for login)
        r2 = requests.post(f"{API}/auth/login", json={"email": email, "password": "Hemligt1!"})
        assert r2.status_code == 200


# --- Users / positions / rules / leaderboard -------------------------------
class TestReads:
    def test_users_list(self, admin_session):
        r = admin_session.get(f"{API}/users")
        assert r.status_code == 200
        users = r.json()
        emails = [u["email"] for u in users]
        for p in PLAYERS:
            assert p in emails, f"Seeded player missing: {p}"
        assert ADMIN_EMAIL in emails

    def test_positions_seeded(self, admin_session):
        r = admin_session.get(f"{API}/positions")
        assert r.status_code == 200
        assert len(r.json()) >= 5

    def test_rules_endpoint(self, admin_session):
        r = admin_session.get(f"{API}/rules")
        assert r.status_code == 200
        assert isinstance(r.json(), list)  # iter3: seeded rule library intentionally empty

    def test_leaderboard(self, admin_session):
        r = admin_session.get(f"{API}/leaderboard")
        assert r.status_code == 200
        d = r.json()
        assert isinstance(d, dict) and "rows" in d and isinstance(d["rows"], list)

    def test_patch_notes(self, admin_session):
        r = admin_session.get(f"{API}/patch-notes")
        assert r.status_code == 200
        assert len(r.json()) >= 2


# --- Match creation validation --------------------------------------------
class TestMatches:
    def _pick_players(self, sess, n):
        users = sess.get(f"{API}/users").json()
        ids = [u["id"] for u in users if u["email"] in PLAYERS][:n]
        return ids

    def test_matches_list(self, admin_session):
        r = admin_session.get(f"{API}/matches")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_create_match_too_few(self, admin_session):
        ids = self._pick_players(admin_session, 2)
        parts = [{"user_id": ids[0], "placement": 1}, {"user_id": ids[1], "placement": 2}]
        r = admin_session.post(f"{API}/matches", json={"participants": parts, "rule_ids": []})
        assert r.status_code == 400
        assert "3" in r.json()["detail"]

    def test_create_match_duplicate_placement(self, admin_session):
        ids = self._pick_players(admin_session, 3)
        parts = [{"user_id": ids[0], "placement": 1},
                 {"user_id": ids[1], "placement": 1},
                 {"user_id": ids[2], "placement": 2}]
        r = admin_session.post(f"{API}/matches", json={"participants": parts, "rule_ids": []})
        assert r.status_code == 400
        assert "unika" in r.json()["detail"].lower()

    def test_create_match_and_comment(self, admin_session):
        ids = self._pick_players(admin_session, 3)
        parts = [{"user_id": ids[i], "placement": i + 1, "table_position": "Dealer"} for i in range(3)]
        r = admin_session.post(f"{API}/matches", json={"participants": parts, "rule_ids": []})
        assert r.status_code == 200, r.text
        m = r.json()
        assert m["player_count"] == 3
        assert m["winner_name"]
        # participant should have elo fields
        parts_out = m["participants"]
        assert all("elo_before" in p and "elo_after" in p and "elo_delta" in p for p in parts_out)
        # winner gets positive delta, last gets negative
        winner = next(p for p in parts_out if p["placement"] == 1)
        last = next(p for p in parts_out if p["placement"] == 3)
        assert winner["elo_delta"] > 0
        assert last["elo_delta"] < 0

        match_id = m["id"]
        # comment
        rc = admin_session.post(f"{API}/matches/{match_id}/comments", json={"text": "Bra match!"})
        assert rc.status_code == 200
        assert rc.json()["text"] == "Bra match!"
        # emoji comment
        re_ = admin_session.post(f"{API}/matches/{match_id}/comments", json={"emoji": "🔥"})
        assert re_.status_code == 200
        # list
        rl = admin_session.get(f"{API}/matches/{match_id}/comments")
        assert rl.status_code == 200
        assert len(rl.json()) >= 2
        # empty comment
        rr = admin_session.post(f"{API}/matches/{match_id}/comments", json={"text": "  "})
        assert rr.status_code == 400

    def test_match_detail_has_rules(self, admin_session):
        # iter3: no seeded rules; create one, then use it in a match
        cr = admin_session.post(f"{API}/rules", json={"name": f"TEST_{uuid.uuid4().hex[:6]}", "description": "t", "icon": "Dices", "category": "special"})
        assert cr.status_code == 200
        rule_id = cr.json()["id"]
        ids = self._pick_players(admin_session, 3)
        parts = [{"user_id": ids[i], "placement": i + 1} for i in range(3)]
        r = admin_session.post(f"{API}/matches", json={"participants": parts, "rule_ids": [rule_id]})
        assert r.status_code == 200
        mid = r.json()["id"]
        detail = admin_session.get(f"{API}/matches/{mid}")
        assert detail.status_code == 200
        assert any(x["id"] == rule_id for x in detail.json()["rules"])


# --- Rules CRUD -----------------------------------------------------------
class TestRulesCRUD:
    def test_create_and_delete_rule(self, admin_session):
        r = admin_session.post(f"{API}/rules", json={"name": f"TEST_{uuid.uuid4().hex[:6]}", "description": "t", "icon": "Dices"})
        assert r.status_code == 200
        rid = r.json()["id"]
        d = admin_session.delete(f"{API}/rules/{rid}")
        assert d.status_code == 200

    def test_cannot_delete_others_rule(self, admin_session):
        # Admin creates a rule; erik tries to delete it -> 403
        cr = admin_session.post(f"{API}/rules", json={"name": f"TEST_{uuid.uuid4().hex[:6]}", "description": "t", "icon": "Dices"})
        assert cr.status_code == 200
        rid = cr.json()["id"]
        s = requests.Session()
        s.post(f"{API}/auth/login", json={"email": "erik@test.se", "password": PLAYER_PW})
        r = s.delete(f"{API}/rules/{rid}")
        assert r.status_code == 403
        # cleanup by admin
        admin_session.delete(f"{API}/rules/{rid}")


# --- Patch notes ----------------------------------------------------------
class TestPatchNotes:
    def test_add_patch_note(self, admin_session):
        r = admin_session.post(f"{API}/patch-notes", json={"title": "TEST", "description": "d"})
        assert r.status_code == 200
        assert r.json()["author_name"]


# --- Turn10 new features --------------------------------------------------
class TestTurn10:
    def _pick(self, sess, n):
        users = sess.get(f"{API}/users").json()
        return [u["id"] for u in users if u["email"] in PLAYERS][:n]

    def test_leaderboard_shape(self, admin_session):
        r = admin_session.get(f"{API}/leaderboard")
        assert r.status_code == 200
        d = r.json()
        assert set(["rows", "badges", "monthly_best", "v_ringad"]).issubset(d.keys())
        assert set(["win_streak", "most_comments", "most_losses", "monthly_best", "v_ringad"]).issubset(d["badges"].keys())
        for row in d["rows"]:
            assert "icon" in row and "bg" in row["icon"] and "symbol" in row["icon"]
            assert "win_pct" in row

    def test_awards_history(self, admin_session):
        r = admin_session.get(f"{API}/awards/history")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_vote_status_and_cast(self, admin_session):
        r = admin_session.get(f"{API}/vote/status")
        assert r.status_code == 200
        d = r.json()
        assert "month" in d and "voted" in d
        # pick a target != admin
        users = admin_session.get(f"{API}/users").json()
        target = next(u["id"] for u in users if u["email"] == "erik@test.se")
        r2 = admin_session.post(f"{API}/vote", json={"voted_for": target})
        assert r2.status_code == 200
        d2 = r2.json()
        assert d2["voted"] is True and d2["my_vote"] == target
        # change vote
        target2 = next(u["id"] for u in users if u["email"] == "sara@test.se")
        r3 = admin_session.post(f"{API}/vote", json={"voted_for": target2})
        assert r3.status_code == 200
        assert r3.json()["my_vote"] == target2

    def test_profile_update_persist(self, admin_session):
        # save then reload me
        r = admin_session.put(f"{API}/profile", json={"nickname": "Tommy", "icon": {"bg": "#E11D48", "symbol": "♠"}})
        assert r.status_code == 200
        me = admin_session.get(f"{API}/auth/me").json()
        assert me["nickname"] == "Tommy"
        assert me["icon"]["symbol"] == "♠"

    def test_exit_bonus_math(self, admin_session):
        # Player exits on 3 (+5), other on 2 (+0), other on 10 (+0)
        ids = self._pick(admin_session, 3)
        parts = [
            {"user_id": ids[0], "placement": 1, "exit_card_value": 3, "exit_card_suit": "♠"},
            {"user_id": ids[1], "placement": 2, "exit_card_value": 2, "exit_card_suit": "♥"},
            {"user_id": ids[2], "placement": 3, "exit_card_value": 10, "exit_card_suit": "♦"},
        ]
        r = admin_session.post(f"{API}/matches", json={"participants": parts, "rule_ids": []})
        assert r.status_code == 200, r.text
        mid = r.json()["id"]
        detail = admin_session.get(f"{API}/matches/{mid}").json()
        pmap = {p["user_id"]: p for p in detail["participants"]}
        assert pmap[ids[0]]["utgangs_bonus"] == 5
        assert pmap[ids[1]]["utgangs_bonus"] == 0
        assert pmap[ids[2]]["utgangs_bonus"] == 0
        # total delta == base + bonus
        for p in detail["participants"]:
            assert p["elo_delta"] == p["elo_base_delta"] + p["utgangs_bonus"]
            assert p["elo_after"] == p["elo_before"] + p["elo_delta"]
        # exit card fields preserved
        assert pmap[ids[0]]["exit_card_value"] == 3
        assert pmap[ids[0]]["exit_card_suit"] == "♠"

    def test_exit_bonus_values(self, admin_session):
        # Direct sanity via a value 5 -> +4, value 14 -> 0 (max(round((15-14)*0.4),0)=0)
        ids = self._pick(admin_session, 3)
        parts = [
            {"user_id": ids[0], "placement": 1, "exit_card_value": 5, "exit_card_suit": "♣"},
            {"user_id": ids[1], "placement": 2, "exit_card_value": 14, "exit_card_suit": "♥"},
            {"user_id": ids[2], "placement": 3, "exit_card_value": 8, "exit_card_suit": "♦"},
        ]
        r = admin_session.post(f"{API}/matches", json={"participants": parts, "rule_ids": []})
        assert r.status_code == 200
        mid = r.json()["id"]
        detail = admin_session.get(f"{API}/matches/{mid}").json()
        pmap = {p["user_id"]: p for p in detail["participants"]}
        assert pmap[ids[0]]["utgangs_bonus"] == 4  # round((15-5)*0.4)=4
        assert pmap[ids[1]]["utgangs_bonus"] == 0
        assert pmap[ids[2]]["utgangs_bonus"] == 3  # round((15-8)*0.4)=round(2.8)=3


# --- Iteration 3: public read-only access + rule metadata -----------------
class TestPublicAccess:
    """GETs that should work WITHOUT auth (iteration 3)."""

    def test_public_leaderboard(self):
        r = requests.get(f"{API}/leaderboard")
        assert r.status_code == 200
        d = r.json()
        assert "rows" in d and "badges" in d
        # most_rules badge must exist
        assert "most_rules" in d["badges"]

    def test_public_rules(self):
        r = requests.get(f"{API}/rules")
        assert r.status_code == 200
        rules = r.json()
        assert isinstance(rules, list)
        # If any rule exists, verify iteration-3 fields present
        for x in rules:
            assert "category" in x
            assert "creator_name" in x  # may be None
            assert "usage_count" in x

    def test_public_matches(self):
        r = requests.get(f"{API}/matches")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_public_match_detail(self, admin_session):
        matches = admin_session.get(f"{API}/matches").json()
        if not matches:
            pytest.skip("no matches to fetch")
        mid = matches[0]["id"]
        r = requests.get(f"{API}/matches/{mid}")
        assert r.status_code == 200
        assert r.json()["id"] == mid

    def test_public_awards_history(self):
        r = requests.get(f"{API}/awards/history")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_public_vote_status(self):
        r = requests.get(f"{API}/vote/status")
        assert r.status_code == 200
        d = r.json()
        assert "voted" in d and "month" in d


class TestAuthRequired:
    """Writes that must still require auth."""

    def test_create_rule_requires_auth(self):
        r = requests.post(f"{API}/rules", json={"name": "TEST_x", "description": "d"})
        assert r.status_code == 401

    def test_create_match_requires_auth(self):
        r = requests.post(f"{API}/matches", json={"participants": [], "rule_ids": []})
        assert r.status_code == 401

    def test_comment_requires_auth(self, admin_session):
        matches = admin_session.get(f"{API}/matches").json()
        if not matches:
            pytest.skip("no matches")
        mid = matches[0]["id"]
        r = requests.post(f"{API}/matches/{mid}/comments", json={"text": "hi"})
        assert r.status_code == 401

    def test_vote_requires_auth(self):
        r = requests.post(f"{API}/vote", json={"voted_for": "abc"})
        assert r.status_code == 401

    def test_profile_requires_auth(self):
        r = requests.put(f"{API}/profile", json={"nickname": "x"})
        assert r.status_code == 401


class TestRuleMetadata:
    """Iteration 3: rules with category + creator + usage_count."""

    def test_create_rule_with_category(self, admin_session):
        name = f"TEST_{uuid.uuid4().hex[:6]}"
        r = admin_session.post(f"{API}/rules", json={
            "name": name, "description": "cat test", "icon": "Spade", "category": "begransning"
        })
        assert r.status_code == 200
        d = r.json()
        assert d["category"] == "begransning"
        assert d["creator_name"]  # Tommy / Tom
        assert d["usage_count"] == 0
        rid = d["id"]
        # Now list should show it
        listed = admin_session.get(f"{API}/rules").json()
        found = next(x for x in listed if x["id"] == rid)
        assert found["category"] == "begransning"
        assert "creator_name" in found and "usage_count" in found
        # Use it in a match -> usage_count should be >=1 after
        users = admin_session.get(f"{API}/users").json()
        ids = [u["id"] for u in users if u["email"] in PLAYERS][:3]
        parts = [{"user_id": ids[i], "placement": i + 1} for i in range(3)]
        m = admin_session.post(f"{API}/matches", json={"participants": parts, "rule_ids": [rid]})
        assert m.status_code == 200
        listed2 = admin_session.get(f"{API}/rules").json()
        found2 = next(x for x in listed2 if x["id"] == rid)
        assert found2["usage_count"] >= 1
        # cleanup
        admin_session.delete(f"{API}/rules/{rid}")


# --- Iteration 4: base rules with card icons + all_base_rules + patch note ---
class TestIter4:
    def test_base_rules_seeded_with_card_icons(self):
        r = requests.get(f"{API}/rules")
        assert r.status_code == 200
        rules = r.json()
        base = [x for x in rules if x.get("is_base")]
        assert len(base) >= 7, f"expected >=7 base rules, got {len(base)}"
        icons = [x["icon"] for x in base]
        assert "card:2" in icons and "card:10" in icons
        # non-base tillval bucket exists
        # is_base flag present on all
        for x in rules:
            assert "is_base" in x

    def test_match_detail_returns_all_base_rules(self, admin_session):
        matches = admin_session.get(f"{API}/matches").json()
        assert matches, "seed matches expected"
        mid = matches[0]["id"]
        d = requests.get(f"{API}/matches/{mid}").json()
        assert "all_base_rules" in d
        assert isinstance(d["all_base_rules"], list)
        assert len(d["all_base_rules"]) >= 7
        for r in d["all_base_rules"]:
            assert r.get("is_base") is True

    def test_seeded_match_last_player_no_exit_card(self, admin_session):
        matches = admin_session.get(f"{API}/matches").json()
        # find one match where last placement has null exit_card_value
        found_any = False
        for m in matches:
            d = admin_session.get(f"{API}/matches/{m['id']}").json()
            last = max(d["participants"], key=lambda p: p["placement"])
            if last["exit_card_value"] is None:
                found_any = True
                break
        assert found_any, "expected at least one seeded match where last player has no exit_card_value"

    def test_patch_note_beta_021_is_top(self):
        r = requests.get(f"{API}/patch-notes")
        assert r.status_code == 200
        notes = r.json()
        assert notes, "patch notes expected"
        titles = [n.get("title", "") for n in notes]
        # Beta 0.2.1 should exist (would be top if test_add_patch_note hadn't added a 'TEST' note in same run)
        assert any("0.2.1" in t for t in titles), f"Beta 0.2.1 not found in: {titles}"
        # And among seeded notes it's the newest (i.e., appears before Beta 0.2.0 in the list)
        seeded = [t for t in titles if t.startswith("Beta")]
        assert seeded and "0.2.1" in seeded[0], f"seeded ordering wrong: {seeded}"


# --- Iteration 5: Elo floor + NEW_PLAYER_MATCHES=20 -----------------------
class TestIter5Elo:
    def _pick(self, sess, n):
        users = sess.get(f"{API}/users").json()
        return [u for u in users if u["email"] in PLAYERS][:n]

    def test_new_player_matches_constant_is_20(self):
        """elo.py has NEW_PLAYER_MATCHES=20 (was 10 in prior iterations)."""
        import importlib.util, sys, os
        spec = importlib.util.spec_from_file_location("elo_mod", "/app/backend/elo.py")
        mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
        assert mod.NEW_PLAYER_MATCHES == 20

    def test_elo_floor_upper_half_never_negative(self, admin_session):
        """If a high-rated player finishes in the upper half behind a lower-rated
        winner, their base_delta must be floored to >= 0. The last-placed player
        (lower half) can still go negative."""
        # Find the two players with highest and lowest current rating among PLAYERS
        lb = admin_session.get(f"{API}/leaderboard").json()["rows"]
        # Filter test players from leaderboard (ratings may be equal at start)
        by_email = {r.get("email"): r for r in lb if r.get("email") in PLAYERS}
        # Fetch users so we know user ids even if not in leaderboard
        users = admin_session.get(f"{API}/users").json()
        test_users = [u for u in users if u["email"] in PLAYERS]
        # Sort by current rating desc
        test_users_sorted = sorted(test_users, key=lambda u: -u.get("rating", 1000))
        assert len(test_users_sorted) >= 4
        highest = test_users_sorted[0]
        lowest = test_users_sorted[-1]
        middle = test_users_sorted[1:3]

        # If ratings all equal, first play a match where 'highest' wins to boost them
        if highest.get("rating", 1000) <= lowest.get("rating", 1000):
            boost_parts = [
                {"user_id": highest["id"], "placement": 1},
                {"user_id": middle[0]["id"], "placement": 2},
                {"user_id": lowest["id"], "placement": 3},
            ]
            r = admin_session.post(f"{API}/matches", json={"participants": boost_parts, "rule_ids": []})
            assert r.status_code == 200, r.text
            # Refetch users
            users = admin_session.get(f"{API}/users").json()
            hi = next(u for u in users if u["id"] == highest["id"])
            lo = next(u for u in users if u["id"] == lowest["id"])
            assert hi["rating"] > lo["rating"], "boost match should raise highest rating above lowest"
            highest, lowest = hi, lo

        # Now craft a 4-player match: lowest wins (1st), highest finishes 2nd (upper half).
        parts = [
            {"user_id": lowest["id"], "placement": 1},
            {"user_id": highest["id"], "placement": 2},   # upper half (ceil(4/2)=2)
            {"user_id": middle[0]["id"], "placement": 3}, # lower half
            {"user_id": middle[1]["id"], "placement": 4}, # last (lower half)
        ]
        r = admin_session.post(f"{API}/matches", json={"participants": parts, "rule_ids": []})
        assert r.status_code == 200, r.text
        m = r.json()
        pmap = {p["user_id"]: p for p in m["participants"]}
        hi_p = pmap[highest["id"]]
        last_p = pmap[middle[1]["id"]]
        # Floor: elo_base_delta must be >= 0 for upper-half placement even if the
        # pairwise math would want it negative (higher-rated lost to lower).
        assert hi_p["elo_base_delta"] >= 0, f"upper-half base_delta must be >=0, got {hi_p['elo_base_delta']}"
        # Last-placed player (lower half) can still be negative
        assert last_p["elo_base_delta"] < 0, f"last place should still be negative, got {last_p['elo_base_delta']}"

    def test_new_player_has_larger_swing_than_established(self, admin_session):
        """A brand-new player (matches_played < 20) uses K_NEW=60 and gets a
        clearly larger delta magnitude than an established player in the same match."""
        # Register a brand new player
        email = f"test_newk_{uuid.uuid4().hex[:6]}@test.se"
        rr = requests.post(f"{API}/auth/register", json={"name": "NewbieK", "email": email, "password": "Hemligt1!", "invite_code": "267710"})
        assert rr.status_code == 200, rr.text
        new_user_id = rr.json()["id"]

        # Pick 2 established players (assume seeded PLAYERS have matches_played >=20)
        users = admin_session.get(f"{API}/users").json()
        est = [u for u in users if u["email"] in PLAYERS and u.get("matches_played", 0) >= 20][:2]
        if len(est) < 2:
            pytest.skip("need at least 2 established players (matches_played>=20) to compare K-factors")

        # New player wins, one established 2nd, one established 3rd (lower half only for est[1])
        parts = [
            {"user_id": new_user_id, "placement": 1},
            {"user_id": est[0]["id"], "placement": 2},
            {"user_id": est[1]["id"], "placement": 3},
        ]
        r = admin_session.post(f"{API}/matches", json={"participants": parts, "rule_ids": []})
        assert r.status_code == 200, r.text
        m = r.json()
        pmap = {p["user_id"]: p for p in m["participants"]}
        new_delta = abs(pmap[new_user_id]["elo_base_delta"])
        est_last_delta = abs(pmap[est[1]["id"]]["elo_base_delta"])
        # K_NEW=60 vs K_ESTABLISHED=20 -> new player's magnitude should be clearly larger
        assert new_delta > est_last_delta, f"new player delta ({new_delta}) should exceed established ({est_last_delta})"


class TestClearTestdata:
    """Endpoint exists and requires auth. DO NOT invoke it to actually clear data."""

    def test_clear_testdata_requires_auth(self):
        r = requests.post(f"{API}/admin/clear-testdata")
        # Either 401 (unauth) or 403 (non-admin). Must not be 200.
        assert r.status_code in (401, 403)
