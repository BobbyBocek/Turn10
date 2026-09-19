from dotenv import load_dotenv
from pathlib import Path
import os

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI, APIRouter, Request, Response, HTTPException, Depends
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
from datetime import datetime, timezone, timedelta
import uuid
import logging
import bcrypt
import jwt
import httpx

import elo

# --- DB --------------------------------------------------------------------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALG = "HS256"
EMERGENT_SESSION_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"

app = FastAPI()
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# --- Helpers ---------------------------------------------------------------
def now_iso():
    return datetime.now(timezone.utc).isoformat()


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


def public_user(u: dict) -> dict:
    return {
        "id": u["id"],
        "name": u.get("name"),
        "email": u.get("email"),
        "picture": u.get("picture"),
        "auth_provider": u.get("auth_provider", "password"),
        "rating": u.get("rating", elo.START_RATING),
        "matches_played": u.get("matches_played", 0),
        "wins": u.get("wins", 0),
        "losses": u.get("losses", 0),
        "last_places": u.get("last_places", 0),
        "win_streak": u.get("win_streak", 0),
        "loss_streak": u.get("loss_streak", 0),
        "created_at": u.get("created_at"),
    }


def set_auth_cookie(response: Response, key: str, value: str, max_age: int):
    response.set_cookie(key=key, value=value, httponly=True, secure=True,
                        samesite="none", max_age=max_age, path="/")


async def resolve_user(request: Request) -> dict:
    auth_header = request.headers.get("Authorization", "")
    bearer = auth_header[7:] if auth_header.startswith("Bearer ") else None

    # 1) JWT access_token (cookie eller bearer)
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

    # 2) Emergent session_token (cookie eller bearer)
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


# --- Models ----------------------------------------------------------------
class RegisterInput(BaseModel):
    name: str
    email: EmailStr
    password: str


class LoginInput(BaseModel):
    email: EmailStr
    password: str


class RuleInput(BaseModel):
    name: str
    description: Optional[str] = ""
    icon: Optional[str] = "Dices"
    is_base: bool = False


class ParticipantInput(BaseModel):
    user_id: str
    placement: int
    table_position: Optional[str] = None
    last_card: Optional[str] = None


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


# --- Auth endpoints --------------------------------------------------------
@api.post("/auth/register")
async def register(data: RegisterInput, response: Response):
    email = data.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="E-postadressen är redan registrerad")
    user = {
        "id": str(uuid.uuid4()),
        "name": data.name.strip(),
        "email": email,
        "password_hash": hash_password(data.password),
        "auth_provider": "password",
        "picture": None,
        "rating": elo.START_RATING,
        "matches_played": 0, "wins": 0, "losses": 0, "last_places": 0,
        "win_streak": 0, "loss_streak": 0,
        "created_at": now_iso(),
    }
    await db.users.insert_one(user)
    token = create_access_token(user["id"])
    set_auth_cookie(response, "access_token", token, 604800)
    return public_user(user)


@api.post("/auth/login")
async def login(data: LoginInput, response: Response):
    email = data.email.lower()
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user or not user.get("password_hash") or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Fel e-post eller lösenord")
    token = create_access_token(user["id"])
    set_auth_cookie(response, "access_token", token, 604800)
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
        user = {
            "id": str(uuid.uuid4()),
            "name": data.get("name") or email.split("@")[0],
            "email": email,
            "password_hash": None,
            "auth_provider": "google",
            "picture": data.get("picture"),
            "rating": elo.START_RATING,
            "matches_played": 0, "wins": 0, "losses": 0, "last_places": 0,
            "win_streak": 0, "loss_streak": 0,
            "created_at": now_iso(),
        }
        await db.users.insert_one(user)
    else:
        if data.get("picture") and not user.get("picture"):
            await db.users.update_one({"id": user["id"]}, {"$set": {"picture": data["picture"]}})
            user["picture"] = data["picture"]

    session_token = data["session_token"]
    await db.user_sessions.insert_one({
        "user_id": user["id"],
        "session_token": session_token,
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


# --- Users -----------------------------------------------------------------
@api.get("/users")
async def list_users(user: dict = Depends(get_current_user)):
    users = await db.users.find({}, {"_id": 0}).to_list(1000)
    return [public_user(u) for u in users]


# --- Positions -------------------------------------------------------------
@api.get("/positions")
async def list_positions(user: dict = Depends(get_current_user)):
    docs = await db.positions.find({}, {"_id": 0}).sort("order", 1).to_list(100)
    return docs


@api.post("/positions")
async def add_position(data: PositionInput, user: dict = Depends(get_current_user)):
    count = await db.positions.count_documents({})
    doc = {"id": str(uuid.uuid4()), "name": data.name.strip(), "order": count}
    await db.positions.insert_one(doc)
    return {"id": doc["id"], "name": doc["name"], "order": doc["order"]}


# --- Rules -----------------------------------------------------------------
@api.get("/rules")
async def list_rules(user: dict = Depends(get_current_user)):
    docs = await db.rules.find({}, {"_id": 0}).to_list(1000)
    return docs


@api.post("/rules")
async def create_rule(data: RuleInput, user: dict = Depends(get_current_user)):
    doc = {
        "id": str(uuid.uuid4()),
        "name": data.name.strip(),
        "description": data.description or "",
        "icon": data.icon or "Dices",
        "is_base": data.is_base,
        "created_by": user["id"],
        "created_at": now_iso(),
    }
    await db.rules.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.put("/rules/{rule_id}")
async def update_rule(rule_id: str, data: RuleInput, user: dict = Depends(get_current_user)):
    rule = await db.rules.find_one({"id": rule_id}, {"_id": 0})
    if not rule:
        raise HTTPException(status_code=404, detail="Regeln hittades inte")
    if rule.get("created_by") != user["id"]:
        raise HTTPException(status_code=403, detail="Du kan bara redigera regler du själv skapat")
    await db.rules.update_one({"id": rule_id}, {"$set": {
        "name": data.name.strip(), "description": data.description or "",
        "icon": data.icon or "Dices", "is_base": data.is_base}})
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
async def build_match_summary(m: dict) -> dict:
    users_map = {u["id"]: u for u in await db.users.find({}, {"_id": 0}).to_list(1000)}
    parts = sorted(m["participants"], key=lambda p: p["placement"])
    for p in parts:
        u = users_map.get(p["user_id"])
        p["name"] = u["name"] if u else "Okänd"
        p["picture"] = u.get("picture") if u else None
    winner = next((p for p in parts if p["placement"] == 1), None)
    comment_count = await db.comments.count_documents({"match_id": m["id"]})
    return {
        "id": m["id"], "date": m["date"], "created_by": m.get("created_by"),
        "participants": parts, "rule_ids": m.get("rule_ids", []),
        "winner_name": winner["name"] if winner else None,
        "player_count": len(parts), "comment_count": comment_count,
    }


@api.post("/matches")
async def create_match(data: MatchInput, user: dict = Depends(get_current_user)):
    parts = data.participants
    n = len(parts)
    if n < 3 or n > 6:
        raise HTTPException(status_code=400, detail="En match kräver 3–6 deltagare")
    placements = sorted(p.placement for p in parts)
    if placements != list(range(1, n + 1)):
        raise HTTPException(status_code=400, detail="Slutplaceringarna måste vara unika (1 till N)")
    ids = [p.user_id for p in parts]
    if len(set(ids)) != n:
        raise HTTPException(status_code=400, detail="En spelare kan bara delta en gång")

    users_map = {}
    for pid in ids:
        u = await db.users.find_one({"id": pid}, {"_id": 0})
        if not u:
            raise HTTPException(status_code=400, detail="En vald spelare finns inte")
        users_map[pid] = u

    elo_input = [{
        "user_id": p.user_id,
        "rating": users_map[p.user_id].get("rating", elo.START_RATING),
        "matches_played": users_map[p.user_id].get("matches_played", 0),
        "win_streak": users_map[p.user_id].get("win_streak", 0),
        "loss_streak": users_map[p.user_id].get("loss_streak", 0),
        "placement": p.placement,
    } for p in parts]

    changes = {c["user_id"]: c for c in elo.compute_match_elo(elo_input)}
    worst = n

    match_id = str(uuid.uuid4())
    stored_parts = []
    for p in parts:
        c = changes[p.user_id]
        stored_parts.append({
            "user_id": p.user_id, "placement": p.placement,
            "table_position": p.table_position, "last_card": p.last_card,
            "elo_before": c["elo_before"], "elo_after": c["elo_after"], "elo_delta": c["elo_delta"],
        })
        u = users_map[p.user_id]
        is_win = p.placement == 1
        is_last = p.placement == worst
        await db.users.update_one({"id": p.user_id}, {"$set": {
            "rating": c["elo_after"],
            "matches_played": u.get("matches_played", 0) + 1,
            "wins": u.get("wins", 0) + (1 if is_win else 0),
            "losses": u.get("losses", 0) + (0 if is_win else 1),
            "last_places": u.get("last_places", 0) + (1 if is_last else 0),
            "win_streak": c["new_win_streak"],
            "loss_streak": c["new_loss_streak"],
        }})

    match_doc = {
        "id": match_id,
        "date": data.date or now_iso(),
        "created_by": user["id"],
        "participants": stored_parts,
        "rule_ids": data.rule_ids,
        "created_at": now_iso(),
    }
    await db.matches.insert_one(match_doc)
    return await build_match_summary({**match_doc})


@api.get("/matches")
async def list_matches(user: dict = Depends(get_current_user)):
    docs = await db.matches.find({}, {"_id": 0}).sort("date", -1).to_list(1000)
    return [await build_match_summary(m) for m in docs]


@api.get("/matches/{match_id}")
async def get_match(match_id: str, user: dict = Depends(get_current_user)):
    m = await db.matches.find_one({"id": match_id}, {"_id": 0})
    if not m:
        raise HTTPException(status_code=404, detail="Matchen hittades inte")
    summary = await build_match_summary(m)
    rules = await db.rules.find({"id": {"$in": m.get("rule_ids", [])}}, {"_id": 0}).to_list(100)
    summary["rules"] = rules
    return summary


# --- Comments --------------------------------------------------------------
@api.get("/matches/{match_id}/comments")
async def list_comments(match_id: str, user: dict = Depends(get_current_user)):
    docs = await db.comments.find({"match_id": match_id}, {"_id": 0}).sort("created_at", 1).to_list(1000)
    users_map = {u["id"]: u for u in await db.users.find({}, {"_id": 0}).to_list(1000)}
    for c in docs:
        u = users_map.get(c["user_id"])
        c["name"] = u["name"] if u else "Okänd"
        c["picture"] = u.get("picture") if u else None
    return docs


@api.post("/matches/{match_id}/comments")
async def add_comment(match_id: str, data: CommentInput, user: dict = Depends(get_current_user)):
    if not (data.text and data.text.strip()) and not (data.emoji and data.emoji.strip()):
        raise HTTPException(status_code=400, detail="Kommentaren är tom")
    if not await db.matches.find_one({"id": match_id}, {"_id": 0}):
        raise HTTPException(status_code=404, detail="Matchen hittades inte")
    doc = {
        "id": str(uuid.uuid4()), "match_id": match_id, "user_id": user["id"],
        "text": (data.text or "").strip(), "emoji": (data.emoji or "").strip(),
        "created_at": now_iso(),
    }
    await db.comments.insert_one(doc)
    doc.pop("_id", None)
    return {**doc, "name": user["name"], "picture": user.get("picture")}


# --- Leaderboard -----------------------------------------------------------
@api.get("/leaderboard")
async def leaderboard(user: dict = Depends(get_current_user)):
    users = await db.users.find({"matches_played": {"$gte": 1}}, {"_id": 0}).to_list(1000)
    rows = []
    for u in users:
        mp = u.get("matches_played", 0)
        wins = u.get("wins", 0)
        rows.append({
            "id": u["id"], "name": u["name"], "picture": u.get("picture"),
            "rating": u.get("rating", elo.START_RATING),
            "wins": wins, "losses": u.get("losses", 0),
            "last_places": u.get("last_places", 0),
            "matches_played": mp,
            "win_pct": round(100 * wins / mp) if mp else 0,
            "win_streak": u.get("win_streak", 0),
        })
    rows.sort(key=lambda r: r["rating"], reverse=True)
    return rows


# --- Patch notes -----------------------------------------------------------
@api.get("/patch-notes")
async def list_patch_notes(user: dict = Depends(get_current_user)):
    docs = await db.patch_notes.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    users_map = {u["id"]: u for u in await db.users.find({}, {"_id": 0}).to_list(1000)}
    for d in docs:
        u = users_map.get(d.get("author_id"))
        d["author_name"] = u["name"] if u else "Okänd"
    return docs


@api.post("/patch-notes")
async def add_patch_note(data: PatchNoteInput, user: dict = Depends(get_current_user)):
    doc = {
        "id": str(uuid.uuid4()), "title": data.title.strip(),
        "description": data.description.strip(), "author_id": user["id"],
        "created_at": now_iso(),
    }
    await db.patch_notes.insert_one(doc)
    doc.pop("_id", None)
    return {**doc, "author_name": user["name"]}


@api.get("/")
async def root():
    return {"message": "Kortspel API"}


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Seeding ---------------------------------------------------------------
async def seed():
    await db.users.create_index("email", unique=True)
    await db.user_sessions.create_index("session_token")

    admin_email = os.environ["ADMIN_EMAIL"].lower()
    admin_pw = os.environ["ADMIN_PASSWORD"]
    if not await db.users.find_one({"email": admin_email}):
        await db.users.insert_one({
            "id": str(uuid.uuid4()), "name": "Tom", "email": admin_email,
            "password_hash": hash_password(admin_pw), "auth_provider": "password",
            "picture": None, "rating": elo.START_RATING, "matches_played": 0,
            "wins": 0, "losses": 0, "last_places": 0, "win_streak": 0, "loss_streak": 0,
            "created_at": now_iso(),
        })

    # Positioner
    if await db.positions.count_documents({}) == 0:
        for i, name in enumerate(["Dealer", "Under the gun", "Middle", "Cutoff", "Hijack", "Big blind"]):
            await db.positions.insert_one({"id": str(uuid.uuid4()), "name": name, "order": i})

    # Regler
    if await db.rules.count_documents({}) == 0:
        base = [
            ("Vändtvång", "Om du kan lägga ett kort måste du göra det.", "RefreshCw"),
            ("Dra tills du kan", "Dra kort från högen tills du kan spela.", "Layers"),
            ("Sista kortet-varning", "Säg till högt när du har ett kort kvar.", "Bell"),
        ]
        optional = [
            ("Plocka två", "Nästa spelare drar två kort och står över.", "Plus"),
            ("Byt hand", "Alla byter hand med spelaren till vänster.", "ArrowLeftRight"),
            ("Hoppa över", "Nästa spelare hoppas över.", "SkipForward"),
            ("Färgbyte", "Spelaren väljer ny färg fritt.", "Palette"),
            ("Dubbel giv", "Alla får dubbelt så många startkort.", "Copy"),
            ("Tyst runda", "Ingen får prata under rundan.", "VolumeX"),
            ("Snabbläggning", "Samma valör får läggas när som helst.", "Zap"),
        ]
        admin = await db.users.find_one({"email": admin_email}, {"_id": 0})
        for name, desc, icon in base:
            await db.rules.insert_one({"id": str(uuid.uuid4()), "name": name, "description": desc,
                                       "icon": icon, "is_base": True, "created_by": admin["id"], "created_at": now_iso()})
        for name, desc, icon in optional:
            await db.rules.insert_one({"id": str(uuid.uuid4()), "name": name, "description": desc,
                                       "icon": icon, "is_base": False, "created_by": admin["id"], "created_at": now_iso()})

    # Testspelare
    seed_pw = os.environ.get("SEED_USER_PASSWORD", "Spela123!")
    seed_players = [("Erik", "erik@test.se"), ("Johan", "johan@test.se"),
                    ("Anders", "anders@test.se"), ("Sara", "sara@test.se"), ("Lisa", "lisa@test.se")]
    for name, email in seed_players:
        if not await db.users.find_one({"email": email}):
            await db.users.insert_one({
                "id": str(uuid.uuid4()), "name": name, "email": email,
                "password_hash": hash_password(seed_pw), "auth_provider": "password",
                "picture": None, "rating": elo.START_RATING, "matches_played": 0,
                "wins": 0, "losses": 0, "last_places": 0, "win_streak": 0, "loss_streak": 0,
                "created_at": now_iso(),
            })

    # Exempelmatcher (endast om inga matcher finns)
    if await db.matches.count_documents({}) == 0:
        rules = await db.rules.find({}, {"_id": 0}).to_list(100)
        base_rule_ids = [r["id"] for r in rules if r["is_base"]]
        extra_rule = next((r["id"] for r in rules if not r["is_base"]), None)
        players = await db.users.find({"email": {"$in": [e for _, e in seed_players]}}, {"_id": 0}).to_list(100)
        pmap = {p["name"]: p["id"] for p in players}
        positions = ["Dealer", "Under the gun", "Middle", "Cutoff", "Hijack"]
        sample = [
            (["Erik", "Johan", "Anders", "Sara"], base_rule_ids),
            (["Sara", "Erik", "Lisa", "Johan", "Anders"], base_rule_ids + ([extra_rule] if extra_rule else [])),
            (["Erik", "Sara", "Johan"], base_rule_ids),
            (["Johan", "Erik", "Anders", "Lisa"], base_rule_ids),
        ]
        for order, rule_ids in sample:
            parts_in = []
            for idx, pname in enumerate(order):
                parts_in.append({"user_id": pmap[pname], "placement": idx + 1,
                                 "table_position": positions[idx], "last_card": None})
            await _seed_match(parts_in, rule_ids, list(pmap.values())[0])

    # Patch notes
    if await db.patch_notes.count_documents({}) == 0:
        admin = await db.users.find_one({"email": admin_email}, {"_id": 0})
        notes = [
            ("v1.0 – Lansering", "Första versionen! Konton, matchregistrering, Elo-rating, topplista, regelbibliotek och shittalk."),
            ("Elo för sluten grupp", "Elo justerad för vår grupp: högre K för nya spelare och vinststreak-bonus."),
        ]
        for title, desc in notes:
            await db.patch_notes.insert_one({"id": str(uuid.uuid4()), "title": title, "description": desc,
                                             "author_id": admin["id"], "created_at": now_iso()})


async def _seed_match(parts, rule_ids, creator_id):
    users_map = {}
    for p in parts:
        users_map[p["user_id"]] = await db.users.find_one({"id": p["user_id"]}, {"_id": 0})
    elo_input = [{
        "user_id": p["user_id"], "rating": users_map[p["user_id"]].get("rating", elo.START_RATING),
        "matches_played": users_map[p["user_id"]].get("matches_played", 0),
        "win_streak": users_map[p["user_id"]].get("win_streak", 0),
        "loss_streak": users_map[p["user_id"]].get("loss_streak", 0),
        "placement": p["placement"],
    } for p in parts]
    changes = {c["user_id"]: c for c in elo.compute_match_elo(elo_input)}
    worst = len(parts)
    stored = []
    for p in parts:
        c = changes[p["user_id"]]
        stored.append({**p, "elo_before": c["elo_before"], "elo_after": c["elo_after"], "elo_delta": c["elo_delta"]})
        u = users_map[p["user_id"]]
        is_win = p["placement"] == 1
        is_last = p["placement"] == worst
        await db.users.update_one({"id": p["user_id"]}, {"$set": {
            "rating": c["elo_after"], "matches_played": u.get("matches_played", 0) + 1,
            "wins": u.get("wins", 0) + (1 if is_win else 0),
            "losses": u.get("losses", 0) + (0 if is_win else 1),
            "last_places": u.get("last_places", 0) + (1 if is_last else 0),
            "win_streak": c["new_win_streak"], "loss_streak": c["new_loss_streak"]}})
    await db.matches.insert_one({"id": str(uuid.uuid4()), "date": now_iso(), "created_by": creator_id,
                                 "participants": stored, "rule_ids": rule_ids, "created_at": now_iso()})


@app.on_event("startup")
async def on_startup():
    try:
        await seed()
    except Exception as e:
        logger.error(f"Seed error: {e}")


@app.on_event("shutdown")
async def shutdown():
    client.close()
