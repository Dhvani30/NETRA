import pymongo
from neo4j import GraphDatabase
import redis

print("🚀 Starting Database Initialization...")

# ==========================================
# 1. MongoDB Setup (Creating the Filing System)
# ==========================================
print("\n1. Setting up MongoDB...")
# Connect using the username/password we set in docker-compose.yml
mongo_client = pymongo.MongoClient("mongodb://admin:password123@localhost:27017/")
mongo_db = mongo_client["social_intel"]

# Create Indexes (Think of these like the index at the back of a textbook)
# If we don't do this, searching 10,000 tweets will be very slow.
mongo_db.raw_posts.create_index([("timestamp", pymongo.DESCENDING)]) # Sort by time quickly
mongo_db.raw_posts.create_index([("platform", pymongo.ASCENDING)])  # Filter by X/Telegram quickly
mongo_db.raw_posts.create_index([("text", pymongo.TEXT)])           # Allows fast text searching

print("✅ MongoDB collections and indexes created.")

# ==========================================
# 2. Neo4j Setup (Creating the Graph Rules)
# ==========================================
print("\n2. Setting up Neo4j...")
# Connect to the Bolt port (7687) we mapped in docker-compose
neo4j_driver = GraphDatabase.driver("bolt://localhost:7687", auth=("neo4j", "password123"))

with neo4j_driver.session() as session:
    # Constraints: These are strict rules to keep our graph clean.
    # "If a User node is created, its 'id' MUST be unique. Don't allow duplicates."
    session.run("CREATE CONSTRAINT user_id IF NOT EXISTS FOR (u:User) REQUIRE u.id IS UNIQUE")
    session.run("CREATE CONSTRAINT post_id IF NOT EXISTS FOR (p:Post) REQUIRE p.id IS UNIQUE")
    session.run("CREATE CONSTRAINT topic_name IF NOT EXISTS FOR (t:Topic) REQUIRE t.name IS UNIQUE")
    
print("✅ Neo4j constraints created.")
neo4j_driver.close()

# ==========================================
# 3. Redis Setup (The Health Check)
# ==========================================
print("\n3. Setting up Redis...")
redis_client = redis.Redis(host='localhost', port=6379, db=0)
try:
    # Redis is simple. We just 'ping' it to see if it's awake.
    redis_client.ping()
    redis_client.set("system:status", "online") # Set a test key
    print("✅ Redis connected and ready.")
except redis.ConnectionError:
    print(" Failed to connect to Redis. Check if the container is running!")

print("\n🎉 Phase 1 Complete! Your data foundation is ready.")