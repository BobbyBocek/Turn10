from dotenv import load_dotenv
from pathlib import Path
import os

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI, APIRouter, Request, Response, HTTPException, Depends
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from collections import defaultdict
import uuid
import logging
import bcrypt
import jwt
import httpx

import elo

SEED_VERSION = "turn10-v5"

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALG = "HS256"
INVITE_CODE = os.environ.get("INVITE_CODE", "267710")
EMERGENT_SESSION_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"

app = FastAPI()
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# --- Helpers ---------------------------------------------------------------
def now_iso():
    return datetime.now(timezone.utc).isoformat()


def current_month():
    return datetime.now(timezone.utc).strftime("%Y-%m")


def month_of(iso: str) -> str:
    return (iso or "")[:7]


def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_access_token(user_id: str) -> str:
    payload = {"sub": user_id, "type": "access",
               "exp": datetime.now(timezone.utc) + timedelta(days=7)}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


def default_icon(name: str) -> dict:
    return {"bg": "#334155", "symbol": (name or "?")[0].upper()}


def public_user(u: dict) -> dict:
    name = u.get("name")
    nickname = u.get("nickname")
    return {
        "id": u["id"],
        "name": name,
        "nickname": nickname,
        "display_name": nickname or name,
        "email": u.get("email"),
        "picture": u.get("picture"),
        "icon": u.get("icon") or default_icon(name),
        "auth_provider": u.get("auth_provider", "password"),
        "rating": u.get("rating", elo.START_RATING),
        "matches_played": u.get("matches_played", 0),
        "wins": u.get("wins", 0),
        "losses": u.get("losses", 0),
        "last_places": u.get("last_places", 0),
        "win_streak": u.get("win_streak", 0),
        "loss_streak": u.get("loss_streak", 0),
        "max_win_streak": u.get("max_win_streak", 0),
        "created_at": u.get("created_at"),
    }


def set_auth_cookie(response: Response, key: str, value: str, max_age: int):
    response.set_cookie(key=key, value=value, httponly=True, secure=True,
                        samesite="none", max_age=max_age, path="/")


async def resolve_user(request: Request) -> dict:
    auth_header = request.headers.get("Authorization", "")
    bearer = auth_header[7:] if auth_header.startswith("Bearer ") else None
    for candidate in [request.cookies.get("access_token"), bearer]:
        if not candidate:
            continue
        try:
            payload = jwt.decode(candidate, JWT_SECRET, algorithms=[JWT_ALG])
            if payload.get("type") == "access":
                u = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
                if u:
                    return u
        except jwt.PyJWTError:
            pass
    session_token = request.cookies.get("session_token") or bearer
    if session_token:
        sess = await db.user_sessions.find_one({"session_token": session_token}, {"_id": 0})
        if sess:
            expires_at = sess["expires_at"]
            if isinstance(expires_at, str):
                expires_at = datetime.fromisoformat(expires_at)
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            if expires_at >= datetime.now(timezone.utc):
                u = await db.users.find_one({"id": sess["user_id"]}, {"_id": 0})
                if u:
                    return u
    raise HTTPException(status_code=401, detail="Ej inloggad")


async def get_current_user(request: Request) -> dict:
    return await resolve_user(request)


async def optional_user(request: Request):
    try:
        return await resolve_user(request)
    except HTTPException:
        return None


async def users_map():
    return {u["id"]: u for u in await db.users.find({}, {"_id": 0}).to_list(1000)}


# --- Models ----------------------------------------------------------------
class RegisterInput(BaseModel):
    name: str
    email: EmailStr
    password: str
    invite_code: str


class LoginInput(BaseModel):
    email: EmailStr
    password: str


class ProfileInput(BaseModel):
    nickname: Optional[str] = None
    icon: Optional[dict] = None


class RuleInput(BaseModel):
    name: str
    description: Optional[str] = ""
    icon: Optional[str] = "Dices"
    is_base: bool = False
    category: Optional[str] = "special"


class ParticipantInput(BaseModel):
    user_id: str
    placement: int
    table_position: Optional[str] = None
    exit_card_value: Optional[int] = None
    exit_card_suit: Optional[str] = None


class MatchInput(BaseModel):
    participants: List[ParticipantInput]
    rule_ids: List[str] = []
    date: Optional[str] = None


class CommentInput(BaseModel):
    text: Optional[str] = None
    emoji: Optional[str] = None


class PositionInput(BaseModel):
    name: str


class PatchNoteInput(BaseModel):
    title: str
    description: str


class VoteInput(BaseModel):
    voted_for: str


# --- Auth ------------------------------------------------------------------
@api.post("/auth/register")
async def register(data: RegisterInput, response: Response):
    if data.invite_code.strip() != INVITE_CODE:
        raise HTTPException(status_code=403, detail="Ogiltig inbjudningskod")
    email = data.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="E-postadressen är redan registrerad")
    name = data.name.strip()
    user = {
        "id": str(uuid.uuid4()), "name": name, "nickname": None, "email": email,
        "password_hash": hash_password(data.password), "auth_provider": "password",
        "picture": None, "icon": default_icon(name),
        "rating": elo.START_RATING, "matches_played": 0, "wins": 0, "losses": 0,
        "last_places": 0, "win_streak": 0, "loss_streak": 0, "max_win_streak": 0,
        "created_at": now_iso(),
    }
    await db.users.insert_one(user)
    set_auth_cookie(response, "access_token", create_access_token(user["id"]), 604800)
    return public_user(user)


@api.post("/auth/login")
async def login(data: LoginInput, response: Response):
    email = data.email.lower()
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user or not user.get("password_hash") or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Fel e-post eller lösenord")
    set_auth_cookie(response, "access_token", create_access_token(user["id"]), 604800)
    return public_user(user)


@api.post("/auth/google-session")
async def google_session(request: Request, response: Response):
    session_id = request.headers.get("X-Session-ID")
    if not session_id:
        raise HTTPException(status_code=400, detail="X-Session-ID saknas")
    async with httpx.AsyncClient() as http:
        r = await http.get(EMERGENT_SESSION_URL, headers={"X-Session-ID": session_id})
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Ogiltig session")
    data = r.json()
    email = data["email"].lower()
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user:
        name = data.get("name") or email.split("@")[0]
        user = {
            "id": str(uuid.uuid4()), "name": name, "nickname": None, "email": email,
            "password_hash": None, "auth_provider": "google", "picture": data.get("picture"),
            "icon": default_icon(name), "rating": elo.START_RATING, "matches_played": 0,
            "wins": 0, "losses": 0, "last_places": 0, "win_streak": 0, "loss_streak": 0,
            "max_win_streak": 0, "created_at": now_iso(),
        }
        await db.users.insert_one(user)
    session_token = data["session_token"]
    await db.user_sessions.insert_one({
        "user_id": user["id"], "session_token": session_token,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        "created_at": now_iso(),
    })
    set_auth_cookie(response, "session_token", session_token, 604800)
    return public_user(user)


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return public_user(user)


@api.post("/auth/logout")
async def logout(request: Request, response: Response):
    st = request.cookies.get("session_token")
    if st:
        await db.user_sessions.delete_many({"session_token": st})
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("session_token", path="/")
    return {"ok": True}


@api.put("/profile")
async def update_profile(data: ProfileInput, user: dict = Depends(get_current_user)):
    updates = {}
    if data.nickname is not None:
        updates["nickname"] = data.nickname.strip() or None
    if data.icon is not None:
        updates["icon"] = data.icon
    if updates:
        await db.users.update_one({"id": user["id"]}, {"$set": updates})
    u = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    return public_user(u)


# --- Users -----------------------------------------------------------------
@api.get("/users")
async def list_users(user=Depends(optional_user)):
    users = await db.users.find({}, {"_id": 0}).to_list(1000)
    return [public_user(u) for u in users]


# --- Positions -------------------------------------------------------------
@api.get("/positions")
async def list_positions(user: dict = Depends(get_current_user)):
    return await db.positions.find({}, {"_id": 0}).sort("order", 1).to_list(100)


@api.post("/positions")
async def add_position(data: PositionInput, user: dict = Depends(get_current_user)):
    count = await db.positions.count_documents({})
    doc = {"id": str(uuid.uuid4()), "name": data.name.strip(), "order": count}
    await db.positions.insert_one(doc)
    return {"id": doc["id"], "name": doc["name"], "order": doc["order"]}


# --- Rules -----------------------------------------------------------------
@api.get("/rules")
async def list_rules(user=Depends(optional_user)):
    docs = await db.rules.find({}, {"_id": 0}).to_list(1000)
    umap = await users_map()
    usage = defaultdict(int)
    for m in await db.matches.find({}, {"_id": 0, "rule_ids": 1}).to_list(2000):
        for rid in m.get("rule_ids", []):
            usage[rid] += 1
    for d in docs:
        creator = umap.get(d.get("created_by"))
        d["creator_name"] = (creator.get("nickname") or creator.get("name")) if creator else None
        d["creator_icon"] = (creator.get("icon") or default_icon(creator.get("name"))) if creator else None
        d["usage_count"] = usage.get(d["id"], 0)
        d.setdefault("category", "special")
    return docs


@api.post("/rules")
async def create_rule(data: RuleInput, user: dict = Depends(get_current_user)):
    doc = {
        "id": str(uuid.uuid4()), "name": data.name.strip(), "description": data.description or "",
        "icon": data.icon or "Dices", "is_base": data.is_base, "category": data.category or "special",
        "created_by": user["id"], "created_at": now_iso(),
    }
    await db.rules.insert_one(doc)
    doc.pop("_id", None)
    return {**doc, "creator_name": user.get("nickname") or user["name"],
            "creator_icon": user.get("icon") or default_icon(user["name"]), "usage_count": 0}


@api.put("/rules/{rule_id}")
async def update_rule(rule_id: str, data: RuleInput, user: dict = Depends(get_current_user)):
    rule = await db.rules.find_one({"id": rule_id}, {"_id": 0})
    if not rule:
        raise HTTPException(status_code=404, detail="Regeln hittades inte")
    if rule.get("created_by") != user["id"]:
        raise HTTPException(status_code=403, detail="Du kan bara redigera regler du själv skapat")
    await db.rules.update_one({"id": rule_id}, {"$set": {
        "name": data.name.strip(), "description": data.description or "",
        "icon": data.icon or "Dices", "is_base": data.is_base, "category": data.category or "special"}})
    return await db.rules.find_one({"id": rule_id}, {"_id": 0})


@api.delete("/rules/{rule_id}")
async def delete_rule(rule_id: str, user: dict = Depends(get_current_user)):
    rule = await db.rules.find_one({"id": rule_id}, {"_id": 0})
    if not rule:
        raise HTTPException(status_code=404, detail="Regeln hittades inte")
    if rule.get("created_by") != user["id"]:
        raise HTTPException(status_code=403, detail="Du kan bara ta bort regler du själv skapat")
    await db.rules.delete_one({"id": rule_id})
    return {"ok": True}


# --- Matches ---------------------------------------------------------------
async def build_match_summary(m: dict, umap=None) -> dict:
    umap = umap or await users_map()
    parts = sorted(m["participants"], key=lambda p: p["placement"])
    for p in parts:
        u = umap.get(p["user_id"])
        p["name"] = (u.get("nickname") or u.get("name")) if u else "Okänd"
        p["icon"] = (u.get("icon") or default_icon(u.get("name"))) if u else default_icon("?")
    winner = next((p for p in parts if p["placement"] == 1), None)
    comment_count = await db.comments.count_documents({"match_id": m["id"]})
    return {
        "id": m["id"], "date": m["date"], "created_by": m.get("created_by"),
        "participants": parts, "rule_ids": m.get("rule_ids", []),
        "winner_name": winner["name"] if winner else None,
        "player_count": len(parts), "comment_count": comment_count,
    }


async def apply_match(parts, rule_ids, creator_id, date=None):
    """Kärnlogik för att spara en match och uppdatera Elo + statistik."""
    n = len(parts)
    umap = {}
    for p in parts:
        u = await db.users.find_one({"id": p["user_id"]}, {"_id": 0})
        if not u:
            raise HTTPException(status_code=400, detail="En vald spelare finns inte")
        umap[p["user_id"]] = u

    elo_input = [{
        "user_id": p["user_id"], "rating": umap[p["user_id"]].get("rating", elo.START_RATING),
        "matches_played": umap[p["user_id"]].get("matches_played", 0),
        "win_streak": umap[p["user_id"]].get("win_streak", 0),
        "loss_streak": umap[p["user_id"]].get("loss_streak", 0),
        "placement": p["placement"],
    } for p in parts]
    changes = {c["user_id"]: c for c in elo.compute_match_elo(elo_input)}
    worst = n

    stored = []
    for p in parts:
        c = changes[p["user_id"]]
        bonus = elo.exit_bonus(p.get("exit_card_value"))
        total_delta = c["base_delta"] + bonus
        elo_after = c["elo_before"] + total_delta
        stored.append({
            "user_id": p["user_id"], "placement": p["placement"],
            "table_position": p.get("table_position"),
            "exit_card_value": p.get("exit_card_value"), "exit_card_suit": p.get("exit_card_suit"),
            "elo_before": c["elo_before"], "elo_base_delta": c["base_delta"],
            "utgangs_bonus": bonus, "elo_delta": total_delta, "elo_after": elo_after,
        })
        u = umap[p["user_id"]]
        is_win = p["placement"] == 1
        is_last = p["placement"] == worst
        await db.users.update_one({"id": p["user_id"]}, {"$set": {
            "rating": elo_after,
            "matches_played": u.get("matches_played", 0) + 1,
            "wins": u.get("wins", 0) + (1 if is_win else 0),
            "losses": u.get("losses", 0) + (0 if is_win else 1),
            "last_places": u.get("last_places", 0) + (1 if is_last else 0),
            "win_streak": c["new_win_streak"], "loss_streak": c["new_loss_streak"],
            "max_win_streak": max(u.get("max_win_streak", 0), c["new_win_streak"]),
        }})

    match_doc = {
        "id": str(uuid.uuid4()), "date": date or now_iso(), "created_by": creator_id,
        "participants": stored, "rule_ids": rule_ids, "created_at": now_iso(),
    }
    await db.matches.insert_one(match_doc)
    match_doc.pop("_id", None)
    return match_doc


@api.post("/matches")
async def create_match(data: MatchInput, user: dict = Depends(get_current_user)):
    parts = data.participants
    n = len(parts)
    if n < 3 or n > 6:
        raise HTTPException(status_code=400, detail="En match kräver 3–6 deltagare")
    if sorted(p.placement for p in parts) != list(range(1, n + 1)):
        raise HTTPException(status_code=400, detail="Slutplaceringarna måste vara unika (1 till N)")
    if len({p.user_id for p in parts}) != n:
        raise HTTPException(status_code=400, detail="En spelare kan bara delta en gång")
    match_doc = await apply_match([p.model_dump() for p in parts], data.rule_ids, user["id"], data.date)
    return await build_match_summary(match_doc)


@api.get("/matches")
async def list_matches(user=Depends(optional_user)):
    docs = await db.matches.find({}, {"_id": 0}).sort("date", -1).to_list(1000)
    umap = await users_map()
    return [await build_match_summary(m, umap) for m in docs]


@api.get("/matches/{match_id}")
async def get_match(match_id: str, user=Depends(optional_user)):
    m = await db.matches.find_one({"id": match_id}, {"_id": 0})
    if not m:
        raise HTTPException(status_code=404, detail="Matchen hittades inte")
    summary = await build_match_summary(m)
    summary["rules"] = await db.rules.find({"id": {"$in": m.get("rule_ids", [])}}, {"_id": 0}).to_list(100)
    return summary


# --- Comments --------------------------------------------------------------
@api.get("/matches/{match_id}/comments")
async def list_comments(match_id: str, user=Depends(optional_user)):
    docs = await db.comments.find({"match_id": match_id}, {"_id": 0}).sort("created_at", 1).to_list(1000)
    umap = await users_map()
    for c in docs:
        u = umap.get(c["user_id"])
        c["name"] = (u.get("nickname") or u.get("name")) if u else "Okänd"
        c["icon"] = (u.get("icon") or default_icon(u.get("name"))) if u else default_icon("?")
    return docs


@api.post("/matches/{match_id}/comments")
async def add_comment(match_id: str, data: CommentInput, user: dict = Depends(get_current_user)):
    if not (data.text and data.text.strip()) and not (data.emoji and data.emoji.strip()):
        raise HTTPException(status_code=400, detail="Kommentaren är tom")
    if not await db.matches.find_one({"id": match_id}, {"_id": 0}):
        raise HTTPException(status_code=404, detail="Matchen hittades inte")
    doc = {
        "id": str(uuid.uuid4()), "match_id": match_id, "user_id": user["id"],
        "text": (data.text or "").strip(), "emoji": (data.emoji or "").strip(), "created_at": now_iso(),
    }
    await db.comments.insert_one(doc)
    doc.pop("_id", None)
    return {**doc, "name": user.get("nickname") or user["name"], "icon": user.get("icon") or default_icon(user["name"])}


# --- Awards / badges helpers -----------------------------------------------
async def monthly_elo_change(month: str):
    """Summan av Elo-delta per spelare för en given månad (YYYY-MM)."""
    totals = defaultdict(int)
    docs = await db.matches.find({}, {"_id": 0}).to_list(2000)
    for m in docs:
        if month_of(m.get("date", "")) != month:
            continue
        for p in m["participants"]:
            totals[p["user_id"]] += p.get("elo_delta", 0)
    return totals


async def best_player_of_month(month: str, umap):
    totals = await monthly_elo_change(month)
    best = None
    for uid, val in totals.items():
        if val > 0 and (best is None or val > best[1]):
            best = (uid, val)
    if not best:
        return None
    u = umap.get(best[0])
    return {"user_id": best[0], "name": (u.get("nickname") or u.get("name")) if u else "Okänd", "total": best[1]}


async def vote_winner_of_month(month: str, umap):
    votes = await db.monthly_votes.find({"month": month}, {"_id": 0}).to_list(2000)
    if not votes:
        return None
    tally = defaultdict(int)
    for v in votes:
        tally[v["voted_for"]] += 1
    uid = max(tally, key=tally.get)
    u = umap.get(uid)
    return {"user_id": uid, "name": (u.get("nickname") or u.get("name")) if u else "Okänd", "votes": tally[uid]}


def prev_month(month: str) -> str:
    y, m = int(month[:4]), int(month[5:7])
    m -= 1
    if m == 0:
        m = 12
        y -= 1
    return f"{y:04d}-{m:02d}"


# --- Leaderboard -----------------------------------------------------------
@api.get("/leaderboard")
async def leaderboard(user=Depends(optional_user)):
    umap = await users_map()
    played = [u for u in umap.values() if u.get("matches_played", 0) >= 1]

    comment_counts = defaultdict(int)
    for c in await db.comments.find({}, {"_id": 0, "user_id": 1}).to_list(5000):
        comment_counts[c["user_id"]] += 1

    rule_counts = defaultdict(int)
    for r in await db.rules.find({}, {"_id": 0, "created_by": 1}).to_list(5000):
        rule_counts[r.get("created_by")] += 1

    rows = []
    for u in played:
        mp = u.get("matches_played", 0)
        wins = u.get("wins", 0)
        rows.append({
            "id": u["id"], "name": u.get("nickname") or u.get("name"),
            "icon": u.get("icon") or default_icon(u.get("name")),
            "rating": u.get("rating", elo.START_RATING), "wins": wins, "losses": u.get("losses", 0),
            "last_places": u.get("last_places", 0), "matches_played": mp,
            "win_pct": round(100 * wins / mp) if mp else 0,
            "win_streak": u.get("win_streak", 0), "max_win_streak": u.get("max_win_streak", 0),
            "comments": comment_counts.get(u["id"], 0), "rules_created": rule_counts.get(u["id"], 0),
        })
    rows.sort(key=lambda r: r["rating"], reverse=True)

    def top(key):
        cand = [r for r in rows if r.get(key, 0) > 0]
        return max(cand, key=lambda r: r[key])["id"] if cand else None

    cm = current_month()
    monthly_best = await best_player_of_month(cm, umap)
    v_ringad = await vote_winner_of_month(prev_month(cm), umap)

    badges = {
        "win_streak": top("max_win_streak"),
        "most_comments": top("comments"),
        "most_losses": top("losses"),
        "most_rules": top("rules_created"),
        "monthly_best": monthly_best["user_id"] if monthly_best else None,
        "v_ringad": v_ringad["user_id"] if v_ringad else None,
    }
    return {"rows": rows, "badges": badges, "monthly_best": monthly_best, "v_ringad": v_ringad}


@api.get("/awards/history")
async def awards_history(user=Depends(optional_user)):
    umap = await users_map()
    months = set()
    for m in await db.matches.find({}, {"_id": 0, "date": 1}).to_list(2000):
        months.add(month_of(m.get("date", "")))
    for v in await db.monthly_votes.find({}, {"_id": 0, "month": 1}).to_list(2000):
        months.add(v["month"])
    cm = current_month()
    result = []
    for mth in sorted(months, reverse=True):
        if not mth or mth == cm:
            continue
        result.append({
            "month": mth,
            "best_player": await best_player_of_month(mth, umap),
            "v_ringad": await vote_winner_of_month(mth, umap),
        })
    return result


# --- Voting ----------------------------------------------------------------
@api.get("/vote/status")
async def vote_status(user=Depends(optional_user)):
    umap = await users_map()
    cm = current_month()
    votes = await db.monthly_votes.find({"month": cm}, {"_id": 0}).to_list(2000)
    tally = defaultdict(int)
    my_vote = None
    for v in votes:
        tally[v["voted_for"]] += 1
        if user and v["voter"] == user["id"]:
            my_vote = v["voted_for"]
    tallies = [{"user_id": uid, "name": (umap.get(uid, {}).get("nickname") or umap.get(uid, {}).get("name")), "count": c}
               for uid, c in sorted(tally.items(), key=lambda x: -x[1])]
    return {"month": cm, "my_vote": my_vote, "voted": my_vote is not None, "tallies": tallies}


@api.post("/vote")
async def cast_vote(data: VoteInput, user: dict = Depends(get_current_user)):
    cm = current_month()
    if not await db.users.find_one({"id": data.voted_for}, {"_id": 0}):
        raise HTTPException(status_code=400, detail="Spelaren finns inte")
    await db.monthly_votes.update_one(
        {"month": cm, "voter": user["id"]},
        {"$set": {"voted_for": data.voted_for, "created_at": now_iso()}},
        upsert=True,
    )
    return await vote_status(user)


# --- Patch notes -----------------------------------------------------------
@api.get("/patch-notes")
async def list_patch_notes(user=Depends(optional_user)):
    docs = await db.patch_notes.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    umap = await users_map()
    for d in docs:
        u = umap.get(d.get("author_id"))
        d["author_name"] = (u.get("nickname") or u.get("name")) if u else "Okänd"
    return docs


@api.post("/patch-notes")
async def add_patch_note(data: PatchNoteInput, user: dict = Depends(get_current_user)):
    doc = {"id": str(uuid.uuid4()), "title": data.title.strip(), "description": data.description.strip(),
           "author_id": user["id"], "created_at": now_iso()}
    await db.patch_notes.insert_one(doc)
    doc.pop("_id", None)
    return {**doc, "author_name": user.get("nickname") or user["name"]}


@api.get("/")
async def root():
    return {"message": "Turn10 API"}


async def recompute_all():
    """Nollställ och räkna om alla spelares statistik/Elo från kvarvarande matcher."""
    await db.users.update_many({}, {"$set": {
        "rating": elo.START_RATING, "matches_played": 0, "wins": 0, "losses": 0,
        "last_places": 0, "win_streak": 0, "loss_streak": 0, "max_win_streak": 0}})
    matches = await db.matches.find({}, {"_id": 0}).sort("date", 1).to_list(5000)
    for m in matches:
        parts = sorted(m["participants"], key=lambda p: p["placement"])
        cur = {}
        for p in parts:
            cur[p["user_id"]] = await db.users.find_one({"id": p["user_id"]}, {"_id": 0})
        elo_input = [{
            "user_id": p["user_id"], "rating": cur[p["user_id"]].get("rating", elo.START_RATING),
            "matches_played": cur[p["user_id"]].get("matches_played", 0),
            "win_streak": cur[p["user_id"]].get("win_streak", 0),
            "loss_streak": cur[p["user_id"]].get("loss_streak", 0),
            "placement": p["placement"],
        } for p in parts]
        changes = {c["user_id"]: c for c in elo.compute_match_elo(elo_input)}
        worst = len(parts)
        new_parts = []
        for p in parts:
            c = changes[p["user_id"]]
            bonus = elo.exit_bonus(p.get("exit_card_value"))
            total = c["base_delta"] + bonus
            after = c["elo_before"] + total
            new_parts.append({**p, "elo_before": c["elo_before"], "elo_base_delta": c["base_delta"],
                              "utgangs_bonus": bonus, "elo_delta": total, "elo_after": after})
            u = cur[p["user_id"]]
            is_win = p["placement"] == 1
            is_last = p["placement"] == worst
            await db.users.update_one({"id": p["user_id"]}, {"$set": {
                "rating": after, "matches_played": u.get("matches_played", 0) + 1,
                "wins": u.get("wins", 0) + (1 if is_win else 0),
                "losses": u.get("losses", 0) + (0 if is_win else 1),
                "last_places": u.get("last_places", 0) + (1 if is_last else 0),
                "win_streak": c["new_win_streak"], "loss_streak": c["new_loss_streak"],
                "max_win_streak": max(u.get("max_win_streak", 0), c["new_win_streak"])}})
        await db.matches.update_one({"id": m["id"]}, {"$set": {"participants": new_parts}})


@api.post("/admin/clear-testdata")
async def clear_testdata(user: dict = Depends(get_current_user)):
    """Radera testspelarna (erik/johan/anders/sara/lisa) + deras matcher/kommentarer och räkna om."""
    test_emails = ["erik@test.se", "johan@test.se", "anders@test.se", "sara@test.se", "lisa@test.se"]
    test_users = await db.users.find({"email": {"$in": test_emails}}, {"_id": 0}).to_list(100)
    ids = [u["id"] for u in test_users]
    if not ids:
        return {"removed_players": 0, "removed_matches": 0}
    matches = await db.matches.find({"participants.user_id": {"$in": ids}}, {"_id": 0, "id": 1}).to_list(5000)
    match_ids = [m["id"] for m in matches]
    await db.matches.delete_many({"id": {"$in": match_ids}})
    await db.comments.delete_many({"match_id": {"$in": match_ids}})
    await db.comments.delete_many({"user_id": {"$in": ids}})
    await db.monthly_votes.delete_many({"$or": [{"voter": {"$in": ids}}, {"voted_for": {"$in": ids}}]})
    await db.users.delete_many({"id": {"$in": ids}})
    await recompute_all()
    return {"removed_players": len(ids), "removed_matches": len(match_ids)}


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Seeding ---------------------------------------------------------------
async def ensure_user(name, email, pw, nickname=None, icon=None):
    existing = await db.users.find_one({"email": email})
    if existing:
        return existing["id"] if "id" in existing else existing
    uid = str(uuid.uuid4())
    await db.users.insert_one({
        "id": uid, "name": name, "nickname": nickname, "email": email,
        "password_hash": hash_password(pw), "auth_provider": "password", "picture": None,
        "icon": icon or default_icon(name), "rating": elo.START_RATING, "matches_played": 0,
        "wins": 0, "losses": 0, "last_places": 0, "win_streak": 0, "loss_streak": 0,
        "max_win_streak": 0, "created_at": now_iso(),
    })
    return uid


async def seed():
    await db.users.create_index("email", unique=True)
    await db.user_sessions.create_index("session_token")
    await db.monthly_votes.create_index([("month", 1), ("voter", 1)], unique=True)

    admin_email = os.environ["ADMIN_EMAIL"].lower()
    await ensure_user("Tom", admin_email, os.environ["ADMIN_PASSWORD"],
                      nickname="Tommy", icon={"bg": "#E11D48", "symbol": "♠"})

    seed_pw = os.environ.get("SEED_USER_PASSWORD", "Spela123!")
    seed_players = [
        ("Erik", "erik@test.se", "Kungen", {"bg": "#F59E0B", "symbol": "♥"}),
        ("Johan", "johan@test.se", "Jocke", {"bg": "#10B981", "symbol": "♣"}),
        ("Anders", "anders@test.se", "Ankan", {"bg": "#38BDF8", "symbol": "♦"}),
        ("Sara", "sara@test.se", "SaSa", {"bg": "#A855F7", "symbol": "♠"}),
        ("Lisa", "lisa@test.se", "Lisen", {"bg": "#EC4899", "symbol": "♥"}),
    ]
    for name, email, nick, icon in seed_players:
        await ensure_user(name, email, seed_pw, nickname=nick, icon=icon)

    meta = await db.meta.find_one({"key": "seed_version"})
    if meta and meta.get("value") == SEED_VERSION:
        return

    # --- Full reseed av speldata (behåller konton) ---
    for coll in ["matches", "comments", "rules", "positions", "patch_notes", "monthly_votes"]:
        await db[coll].delete_many({})
    await db.users.update_many({}, {"$set": {
        "rating": elo.START_RATING, "matches_played": 0, "wins": 0, "losses": 0,
        "last_places": 0, "win_streak": 0, "loss_streak": 0, "max_win_streak": 0}})

    admin = await db.users.find_one({"email": admin_email}, {"_id": 0})

    # Sätt smeknamn/ikon för demospelare
    await db.users.update_one({"email": admin_email}, {"$set": {"nickname": "Tommy", "icon": {"bg": "#E11D48", "symbol": "♠"}}})
    for name, email, nick, icon in seed_players:
        await db.users.update_one({"email": email}, {"$set": {"nickname": nick, "icon": icon}})

    for i, name in enumerate(["Dealer", "Andra hand", "Mittemot", "Cutoff", "Hijack", "Sista hand"]):
        await db.positions.insert_one({"id": str(uuid.uuid4()), "name": name, "order": i})

    # Inga exempelregler seedas – riktiga regler läggs till manuellt i appen.

    players = await db.users.find({"email": {"$in": [e for _, e, _, _ in seed_players]}}, {"_id": 0}).to_list(100)
    pmap = {p["name"]: p["id"] for p in players}
    positions = ["Dealer", "Andra hand", "Mittemot", "Cutoff", "Hijack"]
    suits = ["♥", "♦", "♣", "♠"]
    sample = [
        (["Erik", "Johan", "Anders", "Sara"], [3, 7, 12, 5]),
        (["Sara", "Erik", "Lisa", "Johan", "Anders"], [4, 6, 9, 14, 3]),
        (["Erik", "Sara", "Johan"], [5, 10, 8]),
        (["Johan", "Erik", "Anders", "Lisa"], [3, 11, 2, 7]),
    ]
    for order, cards in sample:
        parts_in = []
        for idx, pname in enumerate(order):
            parts_in.append({"user_id": pmap[pname], "placement": idx + 1,
                             "table_position": positions[idx], "exit_card_value": cards[idx],
                             "exit_card_suit": suits[idx % 4]})
        await apply_match(parts_in, [], admin["id"])

    notes = [
        ("Turn10 v1.0 – Lansering 🎴", "Ny app för vår vändtian! Konton, matcher, Elo, topplista, regler och shittalk."),
        ("Utgångsbonus & månadspriser", "Elo får nu bonus efter vilket kort du går ut på. Lägre kort = mer poäng. Plus månadens spelare och V-ringad-omröstning!"),
    ]
    for title, desc in notes:
        await db.patch_notes.insert_one({"id": str(uuid.uuid4()), "title": title, "description": desc,
                                         "author_id": admin["id"], "created_at": now_iso()})

    await db.meta.update_one({"key": "seed_version"}, {"$set": {"value": SEED_VERSION}}, upsert=True)


@app.on_event("startup")
async def on_startup():
    try:
        await seed()
    except Exception as e:
        logger.error(f"Seed error: {e}")


@app.on_event("shutdown")
async def shutdown():
    client.close()
