from motor.motor_asyncio import AsyncIOMotorClient
import os

_client = None
_db = None


async def connect_db():
    global _client, _db
    mongo_url = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
    db_name = os.getenv("DB_NAME", "video_reviewer")
    _client = AsyncIOMotorClient(mongo_url)
    _db = _client[db_name]

    # Create indexes for performance
    await _db.users.create_index("email", unique=True)
    await _db.users.create_index("username", unique=True)
    await _db.jobs.create_index("user_id")
    await _db.jobs.create_index([("created_at", -1)])
    print(f"✅ Connected to MongoDB: {db_name}")


async def disconnect_db():
    global _client
    if _client:
        _client.close()
        print("MongoDB connection closed")


def get_db():
    return _db
