from fastapi import FastAPI, APIRouter, HTTPException, Depends, Query, UploadFile, File
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta, date
from passlib.context import CryptContext
from jose import JWTError, jwt
import re
import base64
import aiofiles

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Security
SECRET_KEY = os.environ.get('SECRET_KEY', 'church-management-secret-key-2024')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

app = FastAPI(title="Church Management System API")
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ============== MODELS ==============

class UserCreate(BaseModel):
    username: str
    password: str
    full_name: str
    role: str = "user"  # admin, presbyter, deacon, user

class UserLogin(BaseModel):
    username: str
    password: str

class UserResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    username: str
    full_name: str
    role: str
    member_id: Optional[int] = None

class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

class MemberCreate(BaseModel):
    pib: str
    gender: str = "male"
    birth_date: Optional[str] = None
    phone_mobile: Optional[str] = None
    phone_home: Optional[str] = None
    email: Optional[str] = None
    repentance_date: Optional[str] = None
    baptism_date: Optional[str] = None
    join_date: Optional[str] = None
    marital_status_id: Optional[str] = None
    social_status_id: Optional[str] = None
    education_id: Optional[str] = None
    profession_id: Optional[str] = None
    notes: Optional[str] = None

class MemberUpdate(BaseModel):
    pib: Optional[str] = None
    gender: Optional[str] = None
    birth_date: Optional[str] = None
    phone_mobile: Optional[str] = None
    phone_home: Optional[str] = None
    email: Optional[str] = None
    repentance_date: Optional[str] = None
    baptism_date: Optional[str] = None
    join_date: Optional[str] = None
    marital_status_id: Optional[str] = None
    social_status_id: Optional[str] = None
    education_id: Optional[str] = None
    profession_id: Optional[str] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None

class MemberResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    original_id: int
    pib: str
    gender: str
    gender_ukr: str
    birth_date: Optional[str] = None
    phone_home: Optional[str] = None
    phone_mobile: Optional[str] = None
    email: Optional[str] = None
    repentance_date: Optional[str] = None
    baptism_date: Optional[str] = None
    join_date: Optional[str] = None
    marital_status: Optional[str] = None
    social_status: Optional[str] = None
    education: Optional[str] = None
    profession: Optional[str] = None
    is_active: bool = True
    notes: Optional[str] = None
    services: List[Dict] = []

class StatisticsResponse(BaseModel):
    total_members: int
    active_members: int
    inactive_members: int
    male_count: int
    female_count: int
    baptized_count: int
    with_holy_spirit: int
    age_groups: Dict[str, int]
    service_stats: List[Dict]
    marital_stats: Dict[str, int]
    social_stats: Dict[str, int]

# ============== AUTH HELPERS ==============

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    return user

async def require_admin(user: dict = Depends(get_current_user)):
    if user.get("role") not in ["admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

async def require_editor(user: dict = Depends(get_current_user)):
    if user.get("role") not in ["admin", "presbyter", "deacon"]:
        raise HTTPException(status_code=403, detail="Editor access required")
    return user

# ============== AUTH ROUTES ==============

@api_router.post("/auth/register", response_model=Token)
async def register(user_data: UserCreate):
    # Check if user exists
    existing = await db.users.find_one({"username": user_data.username})
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    # Check if this is the first user (make admin)
    user_count = await db.users.count_documents({})
    role = "admin" if user_count == 0 else user_data.role
    
    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "username": user_data.username,
        "password_hash": get_password_hash(user_data.password),
        "full_name": user_data.full_name,
        "role": role,
        "member_id": None,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(user_doc)
    
    access_token = create_access_token(data={"sub": user_id})
    return Token(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse(
            id=user_id,
            username=user_data.username,
            full_name=user_data.full_name,
            role=role,
            member_id=None
        )
    )

@api_router.post("/auth/login", response_model=Token)
async def login(credentials: UserLogin):
    user = await db.users.find_one({"username": credentials.username})
    if not user or not verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    access_token = create_access_token(data={"sub": user["id"]})
    return Token(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse(
            id=user["id"],
            username=user["username"],
            full_name=user["full_name"],
            role=user["role"],
            member_id=user.get("member_id")
        )
    )

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(user: dict = Depends(get_current_user)):
    return UserResponse(
        id=user["id"],
        username=user["username"],
        full_name=user["full_name"],
        role=user["role"],
        member_id=user.get("member_id")
    )

# ============== CHURCH INFO ==============

@api_router.get("/church/info")
async def get_church_info():
    info = await db.church_info.find_one({}, {"_id": 0})
    return info or {"name": "УЦХВЄ", "city": "м. Івано-Франківськ"}

# ============== MEMBERS ROUTES ==============

@api_router.get("/members")
async def get_members(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    search: str = Query(None),
    active_only: bool = Query(True),
    gender: str = Query(None),
    service_type: int = Query(None),
    user: dict = Depends(get_current_user)
):
    query = {}
    
    if active_only:
        query["is_active"] = True
    
    if search:
        query["pib"] = {"$regex": search, "$options": "i"}
    
    if gender:
        query["gender"] = gender
    
    skip = (page - 1) * limit
    
    # Get members with services
    members = await db.members.find(query, {"_id": 0}).sort("pib", 1).skip(skip).limit(limit).to_list(limit)
    
    # Get services for each member
    for member in members:
        services = await db.services.find(
            {"member_original_id": member["original_id"]},
            {"_id": 0}
        ).to_list(100)
        
        service_names = []
        for s in services:
            st = await db.service_types.find_one({"original_id": s["service_type_id"]}, {"_id": 0})
            if st:
                service_names.append({
                    "name": st.get("name_ukr", ""),
                    "start_date": s.get("start_date"),
                    "end_date": s.get("end_date"),
                    "is_active": s.get("end_date") is None
                })
        member["services"] = service_names
    
    # Filter by service type if specified
    if service_type:
        st = await db.service_types.find_one({"original_id": service_type}, {"_id": 0})
        if st:
            member_ids = await db.services.distinct("member_original_id", {"service_type_id": service_type})
            members = [m for m in members if m["original_id"] in member_ids]
    
    total = await db.members.count_documents(query)
    
    return {
        "members": members,
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit
    }

@api_router.get("/members/{member_id}")
async def get_member(member_id: int, user: dict = Depends(get_current_user)):
    member = await db.members.find_one({"original_id": member_id}, {"_id": 0})
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    
    # Get services
    services = await db.services.find({"member_original_id": member_id}, {"_id": 0}).to_list(100)
    service_names = []
    for s in services:
        st = await db.service_types.find_one({"original_id": s["service_type_id"]}, {"_id": 0})
        if st:
            service_names.append({
                "name": st.get("name_ukr", ""),
                "start_date": s.get("start_date"),
                "end_date": s.get("end_date"),
                "is_active": s.get("end_date") is None
            })
    member["services"] = service_names
    
    # Get family info
    family = await db.families.find_one(
        {"$or": [{"husband_id": member_id}, {"wife_id": member_id}]},
        {"_id": 0}
    )
    if family:
        spouse_id = family.get("wife_id") if family.get("husband_id") == member_id else family.get("husband_id")
        if spouse_id:
            spouse = await db.members.find_one({"original_id": spouse_id}, {"_id": 0, "pib": 1, "original_id": 1})
            member["spouse"] = spouse
        
        # Get children
        children = await db.children.find({"family_id": family.get("original_id")}, {"_id": 0}).to_list(20)
        member["children"] = children
    
    return member

@api_router.post("/members")
async def create_member(member_data: MemberCreate, user: dict = Depends(require_editor)):
    # Get next ID
    last_member = await db.members.find_one(sort=[("original_id", -1)])
    next_id = (last_member.get("original_id", 0) if last_member else 0) + 1
    
    member = {
        "original_id": next_id,
        "pib": member_data.pib,
        "gender": member_data.gender,
        "gender_ukr": "брат" if member_data.gender == "male" else "сестра",
        "birth_date": member_data.birth_date,
        "phone_mobile": member_data.phone_mobile or "",
        "phone_home": member_data.phone_home or "",
        "email": member_data.email or "",
        "repentance_date": member_data.repentance_date,
        "baptism_date": member_data.baptism_date,
        "join_date": member_data.join_date,
        "marital_status_id": member_data.marital_status_id or "",
        "social_status_id": member_data.social_status_id or "",
        "education_id": member_data.education_id or "",
        "profession_id": member_data.profession_id or "",
        "notes": member_data.notes or "",
        "is_active": True,
        "holy_spirit": False,
        "has_car": False,
        "car_model": "",
        "skype": "",
        "education_place": ""
    }
    
    # Get reference names
    for ref_type, field in [
        ("marital_status", "marital_status_id"),
        ("social_status", "social_status_id"),
        ("education", "education_id"),
        ("profession", "profession_id")
    ]:
        ref = await db.reference_data.find_one({"type": ref_type})
        if ref:
            member[ref_type] = ref.get("data", {}).get(member[field], "")
    
    await db.members.insert_one(member)
    
    # Return without _id
    del member["_id"]
    return member

@api_router.put("/members/{member_id}")
async def update_member(member_id: int, member_data: MemberUpdate, user: dict = Depends(require_editor)):
    update_dict = {k: v for k, v in member_data.model_dump().items() if v is not None}
    
    if not update_dict:
        raise HTTPException(status_code=400, detail="No data to update")
    
    # Update gender_ukr if gender changed
    if "gender" in update_dict:
        update_dict["gender_ukr"] = "брат" if update_dict["gender"] == "male" else "сестра"
    
    result = await db.members.update_one(
        {"original_id": member_id},
        {"$set": update_dict}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Member not found")
    
    return {"message": "Member updated"}

@api_router.delete("/members/{member_id}")
async def delete_member(member_id: int, user: dict = Depends(require_admin)):
    result = await db.members.update_one(
        {"original_id": member_id},
        {"$set": {"is_active": False, "departure_date": datetime.now(timezone.utc).isoformat()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Member not found")
    return {"message": "Member deactivated"}

# ============== STATISTICS ==============

@api_router.get("/statistics", response_model=StatisticsResponse)
async def get_statistics(user: dict = Depends(get_current_user)):
    total = await db.members.count_documents({})
    active = await db.members.count_documents({"is_active": True})
    
    male_count = await db.members.count_documents({"is_active": True, "gender": "male"})
    female_count = await db.members.count_documents({"is_active": True, "gender": "female"})
    
    baptized = await db.members.count_documents({"is_active": True, "baptism_date": {"$ne": None}})
    holy_spirit = await db.members.count_documents({"is_active": True, "holy_spirit": True})
    
    # Age groups
    age_groups = {"0-18": 0, "19-30": 0, "31-45": 0, "46-60": 0, "60+": 0, "unknown": 0}
    current_year = datetime.now().year
    
    members = await db.members.find({"is_active": True}, {"birth_date": 1}).to_list(2000)
    for m in members:
        bd = m.get("birth_date")
        if bd:
            try:
                birth_year = int(bd[:4])
                age = current_year - birth_year
                if age < 19:
                    age_groups["0-18"] += 1
                elif age < 31:
                    age_groups["19-30"] += 1
                elif age < 46:
                    age_groups["31-45"] += 1
                elif age < 61:
                    age_groups["46-60"] += 1
                else:
                    age_groups["60+"] += 1
            except:
                age_groups["unknown"] += 1
        else:
            age_groups["unknown"] += 1
    
    # Service stats
    service_types = await db.service_types.find({}, {"_id": 0}).to_list(100)
    service_stats = []
    for st in service_types:
        count = await db.services.count_documents({
            "service_type_id": st["original_id"],
            "end_date": None
        })
        if count > 0:
            service_stats.append({
                "name": st.get("name_ukr", ""),
                "count": count
            })
    service_stats.sort(key=lambda x: x["count"], reverse=True)
    
    # Marital stats
    marital_ref = await db.reference_data.find_one({"type": "marital_status"})
    marital_stats = {}
    if marital_ref:
        for key, value in marital_ref.get("data", {}).items():
            count = await db.members.count_documents({"is_active": True, "marital_status_id": key})
            if count > 0:
                marital_stats[value] = count
    
    # Social stats
    social_ref = await db.reference_data.find_one({"type": "social_status"})
    social_stats = {}
    if social_ref:
        for key, value in social_ref.get("data", {}).items():
            count = await db.members.count_documents({"is_active": True, "social_status_id": key})
            if count > 0:
                social_stats[value] = count
    
    return StatisticsResponse(
        total_members=total,
        active_members=active,
        inactive_members=total - active,
        male_count=male_count,
        female_count=female_count,
        baptized_count=baptized,
        with_holy_spirit=holy_spirit,
        age_groups=age_groups,
        service_stats=service_stats[:15],
        marital_stats=marital_stats,
        social_stats=social_stats
    )

# ============== REFERENCE DATA ==============

@api_router.get("/reference/{ref_type}")
async def get_reference_data(ref_type: str, user: dict = Depends(get_current_user)):
    ref = await db.reference_data.find_one({"type": ref_type}, {"_id": 0})
    if not ref:
        raise HTTPException(status_code=404, detail="Reference type not found")
    return ref.get("data", {})

@api_router.get("/service-types")
async def get_service_types(user: dict = Depends(get_current_user)):
    types = await db.service_types.find({}, {"_id": 0}).to_list(100)
    return types

# ============== DISTRICTS ==============

@api_router.get("/districts")
async def get_districts(user: dict = Depends(get_current_user)):
    districts = await db.districts.find({}, {"_id": 0}).sort("number", 1).to_list(100)
    
    # Get leader names
    for d in districts:
        leader = await db.members.find_one({"original_id": d.get("leader_id")}, {"_id": 0, "pib": 1})
        d["leader_name"] = leader.get("pib", "") if leader else ""
    
    return districts

# ============== PRESBYTERS & DEACONS ==============

@api_router.get("/leadership")
async def get_leadership(user: dict = Depends(get_current_user)):
    # Get presbyters
    presbyters = await db.presbyters.find({}, {"_id": 0}).to_list(100)
    presbyter_list = []
    for p in presbyters:
        member = await db.members.find_one({"original_id": p.get("member_id")}, {"_id": 0})
        if member:
            presbyter_list.append({
                "id": p.get("original_id"),
                "member": member
            })
    
    # Get deacons
    deacons = await db.deacons.find({}, {"_id": 0}).to_list(100)
    deacon_list = []
    for d in deacons:
        member = await db.members.find_one({"original_id": d.get("member_id")}, {"_id": 0})
        if member:
            deacon_list.append({
                "id": d.get("original_id"),
                "member": member,
                "presbyter_id": d.get("presbyter_id")
            })
    
    return {
        "presbyters": presbyter_list,
        "deacons": deacon_list
    }

# ============== USERS MANAGEMENT ==============

@api_router.get("/users")
async def get_users(user: dict = Depends(require_admin)):
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(100)
    return users

@api_router.put("/users/{user_id}/role")
async def update_user_role(user_id: str, role: str, user: dict = Depends(require_admin)):
    if role not in ["admin", "presbyter", "deacon", "user"]:
        raise HTTPException(status_code=400, detail="Invalid role")
    
    result = await db.users.update_one({"id": user_id}, {"$set": {"role": role}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "Role updated"}

@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str, current_user: dict = Depends(require_admin)):
    if user_id == current_user["id"]:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    
    result = await db.users.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User deleted"}

# ============== PUBLIC ROUTES ==============

@api_router.get("/public/info")
async def get_public_church_info():
    info = await db.church_info.find_one({}, {"_id": 0})
    stats = {
        "active_members": await db.members.count_documents({"is_active": True}),
        "districts": await db.districts.count_documents({})
    }
    return {
        "info": info or {"name": "УЦХВЄ", "city": "м. Івано-Франківськ"},
        "stats": stats
    }

# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
