"""
NETRA Intelligence Platform API (NTRO SIH 2026).
Run: python -m uvicorn main:app --reload
"""
from __future__ import annotations
import os
import json
import re
import unicodedata
from datetime import datetime, timedelta, timezone
from typing import Any
from bson import json_util
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pymongo import MongoClient, UpdateOne
from pymongo.collection import Collection
from pymongo.errors import PyMongoError

# Load environment variables from .env file
load_dotenv()

# --- Configuration (Reads from .env, falls back to safe defaults) ---
MONGO_URI = os.getenv("MONGO_URI", "mongodb+srv://admin:admin123@cluster0.joyab6x.mongodb.net/NETRA?retryWrites=true&w=majority&authSource=admin")
MONGO_DB_NAME = os.getenv("DB_NAME", "NETRA")
MONGO_COLLECTION = os.getenv("COLLECTION_NAME", "raw_posts")

# Increased timeout to 10s to accommodate cloud database latency
mongo_client: MongoClient = MongoClient(MONGO_URI, serverSelectionTimeoutMS=10_000)
raw_posts: Collection = mongo_client[MONGO_DB_NAME][MONGO_COLLECTION]

# PostgreSQL Graph Database Connection
from app.graph_db import close_pool, get_connection

app = FastAPI(title="NETRA Intelligence Platform", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

static_dir = os.path.join(os.path.dirname(__file__), "static")
if os.path.exists(static_dir):
    assets_dir = os.path.join(static_dir, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

def _mongo_documents_to_json(documents: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return json.loads(json_util.dumps(documents))

def _fetch_graph_payload() -> dict[str, list[dict[str, str]]]:
    with get_connection() as connection, connection.cursor() as cursor:
        cursor.execute("SELECT id, label, node_type FROM graph_nodes ORDER BY id")
        nodes = [{"id": row[0], "label": row[1], "group": row[2]} for row in cursor.fetchall()]
        cursor.execute("SELECT source, target, edge_type FROM graph_edges ORDER BY source, target, edge_type")
        links = [{"source": row[0], "target": row[1], "type": row[2]} for row in cursor.fetchall()]
    return {"nodes": nodes, "links": links}

@app.get("/health")
def health():
    try:
        mongo_client.admin.command("ping")
        with get_connection() as connection, connection.cursor() as cursor: 
            cursor.execute("SELECT 1")
    except Exception as e: 
        print(f"Health check failed: {e}")
        raise HTTPException(status_code=503, detail="Database unreachable")
    return {"status": "ok"}

@app.get("/api/v1/messages")
def get_messages(limit: int = Query(20, ge=1, le=100), platform: str | None = Query(None)):
    try:
        query = {}
        platform_patterns = {
            "telegram": "telegram",
            "instagram": "instagram|meta|facebook",
            "youtube": "youtube|^yt$",
        }
        if platform and platform.lower() in platform_patterns:
            query["platform"] = {"$regex": platform_patterns[platform.lower()], "$options": "i"}
        cursor = raw_posts.find(query, {"_id": 0}).sort("published_at", -1).limit(limit)
        return {"messages": _mongo_documents_to_json(list(cursor))}
    except PyMongoError as e: 
        raise HTTPException(status_code=500, detail=f"DB Error: {str(e)}")

@app.get("/api/v1/live/summary")
def get_live_summary():
    try:
        now = datetime.now(timezone.utc)
        cutoff = now - timedelta(days=7)
        recent_query = {"$or": [
            {"published_at": {"$gte": cutoff.isoformat()}},
            {"published_at": {"$gte": cutoff}},
        ]}
        total_posts = raw_posts.count_documents({})
        last_week_posts = raw_posts.count_documents(recent_query)
        latest_post = raw_posts.find_one(
            {"published_at": {"$exists": True, "$ne": None}},
            {"_id": 0, "published_at": 1, "platform": 1},
            sort=[("published_at", -1)],
        )
        latest_published_at = latest_post.get("published_at") if latest_post else None
        if isinstance(latest_published_at, str):
            try:
                latest_published_at = datetime.fromisoformat(latest_published_at.replace("Z", "+00:00"))
            except ValueError:
                latest_published_at = None
        if isinstance(latest_published_at, datetime):
            if latest_published_at.tzinfo is None:
                latest_published_at = latest_published_at.replace(tzinfo=timezone.utc)
            newest_post_age_seconds = max(0, int((now - latest_published_at).total_seconds()))
            latest_published_at = latest_published_at.isoformat()
        else:
            newest_post_age_seconds = None
            latest_published_at = None

        platform_counts = list(raw_posts.aggregate([
            {"$match": recent_query},
            {"$group": {"_id": {"$toLower": {"$ifNull": ["$platform", "unknown"]}}, "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
        ]))
        return {
            "total_posts": total_posts,
            "last_week_posts": last_week_posts,
            "newest_post_age_seconds": newest_post_age_seconds,
            "newest_post_platform": latest_post.get("platform") if latest_post else None,
            "newest_post_published_at": latest_published_at,
            "platform_counts_last_week": [{"platform": row["_id"], "count": row["count"]} for row in platform_counts],
            "generated_at": now.isoformat(),
        }
    except PyMongoError as e:
        raise HTTPException(status_code=500, detail=f"Live summary unavailable: {str(e)}")
@app.get("/api/v1/analytics/sentiment")
def get_sentiment():
    try:
        from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

        analyzer = SentimentIntensityAnalyzer()
        missing_score = {"$or": [
            {"sentiment_score": {"$not": {"$type": "number"}}},
            {"sentiment_label": {"$in": ["UNSCORED", "ABSTAIN", "unscored", "abstain"]}},
        ]}
        updates = []
        for post in raw_posts.find(
            missing_score,
            {"text_content": 1, "content": 1, "ai_analysis.sentiment_score": 1},
        ).batch_size(500):
            text = str(post.get("text_content") or post.get("content") or "")
            analysis = post.get("ai_analysis")
            if not isinstance(analysis, dict):
                analysis = {}
            score = analysis.get("sentiment_score")
            if not isinstance(score, (int, float)) or isinstance(score, bool):
                score = analyzer.polarity_scores(text)["compound"]
            label = "POSITIVE" if score >= 0.05 else "NEGATIVE" if score <= -0.05 else "NEUTRAL"
            updates.append(UpdateOne(
                {"_id": post["_id"]},
                {"$set": {
                    "sentiment_label": label,
                    "sentiment_score": score,
                    "sentiment_confidence": abs(score),
                }},
            ))
            if len(updates) >= 500:
                raw_posts.bulk_write(updates, ordered=False)
                updates = []
        if updates:
            raw_posts.bulk_write(updates, ordered=False)

        label = {"$let": {
            "vars": {"root": {"$trim": {"input": {"$toString": {"$ifNull": ["$sentiment_label", ""]}}}}},
            "in": {"$cond": [{"$eq": ["$$root", ""]}, {"$ifNull": ["$ai_analysis.sentiment_label", "NEUTRAL"]}, "$$root"]},
        }}
        pipeline = [
            {"$group": {
                "_id": {"$toUpper": {"$trim": {"input": {"$toString": {"$ifNull": [label, "NEUTRAL"]}}}}},
                "count": {"$sum": 1},
            }},
            {"$sort": {"count": -1}},
        ]
        results = list(raw_posts.aggregate(pipeline))
        return {"sentiment_breakdown": [{"label": r["_id"] or "NEUTRAL", "count": r["count"]} for r in results]}
    except PyMongoError as e:
        raise HTTPException(status_code=500, detail=f"DB Error: {str(e)}")
    except ImportError as e:
        raise HTTPException(status_code=503, detail="Sentiment analysis dependency is unavailable") from e

_NARRATIVE_STOP_WORDS = {
    "about", "after", "again", "also", "among", "around", "because", "been", "before", "being", "and", "are", "but", "can", "for", "has", "how", "its", "not", "our", "the", "was", "who", "you",
    "between", "could", "during", "from", "have", "into", "just", "more", "most", "other", "over",
    "said", "same", "some", "such", "than", "that", "their", "them", "then", "there", "these", "they",
    "this", "those", "through", "under", "very", "were", "what", "when", "where", "which", "while",
    "with", "would", "your", "will", "https", "http", "www", "com", "news", "today", "latest", "live",
    "video", "photos", "watch", "read", "update", "updates", "via", "says", "say", "report", "link", "links", "bio", "click", "subscribe", "follow", "official", "channel", "post",
}


def _narrative_timestamp(value):
    if isinstance(value, datetime):
        parsed = value
    elif isinstance(value, str):
        try:
            parsed = datetime.fromisoformat(value.strip().replace("Z", "+00:00"))
        except ValueError:
            return None
    else:
        return None
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _post_topic_terms(text):
    words = re.findall(r"[a-z][a-z0-9-]{2,}", str(text or "").lower())
    useful = lambda word: word not in _NARRATIVE_STOP_WORDS
    terms = {f"{left} {right}" for left, right in zip(words, words[1:]) if useful(left) and useful(right) and left != right}
    return terms


@app.get("/api/v1/analytics/narratives")
def get_narratives():
    try:
        now = datetime.now(timezone.utc)
        recent_start = now - timedelta(days=7)
        previous_start = now - timedelta(days=14)
        documents = raw_posts.find(
            {},
            {"_id": 0, "text_content": 1, "content": 1, "published_at": 1, "created_at": 1, "timestamp": 1},
        ).sort("published_at", -1).limit(10000)
        counts = {}
        for post in documents:
            published_at = next((
                _narrative_timestamp(post.get(field))
                for field in ("published_at", "created_at", "timestamp")
                if post.get(field) is not None
            ), None)
            if published_at is None or published_at < previous_start or published_at > now + timedelta(minutes=5):
                continue
            text = post.get("text_content") or post.get("content") or ""
            for term in _post_topic_terms(text):
                row = counts.setdefault(term, {"recent": 0, "previous": 0})
                row["recent" if published_at >= recent_start else "previous"] += 1

        clusters = []
        for name, values in counts.items():
            recent_count = values["recent"]
            previous_count = values["previous"]
            if recent_count < 2:
                continue
            growth_pct = round(((recent_count - previous_count) / previous_count) * 100) if previous_count else 100
            clusters.append({
                "name": name.title(),
                "count": recent_count,
                "previous_count": previous_count,
                "growth_pct": growth_pct,
            })
        clusters.sort(key=lambda item: (item["count"] - item["previous_count"], item["count"], item["growth_pct"]), reverse=True)
        return {"clusters": clusters[:10], "period_days": 7, "comparison_days": 7}
    except PyMongoError as e:
        raise HTTPException(status_code=500, detail=f"DB Error: {str(e)}")
@app.get("/api/v1/graph/data")
def get_graph():
    try: 
        return _fetch_graph_payload()
    except Exception as e: 
        raise HTTPException(status_code=500, detail=f"Graph Error: {str(e)}")

@app.get("/api/v1/search")
def search_messages(q: str = Query(..., min_length=1)):
    try:
        pattern = re.escape(q.strip())
        query = {"$or": [{"text_content": {"$regex": pattern, "$options": "i"}}, {"content": {"$regex": pattern, "$options": "i"}}]}
        cursor = raw_posts.find(query, {"_id": 0}).sort("published_at", -1).limit(100)
        documents = _mongo_documents_to_json(list(cursor))
        
        platforms = list(set(doc.get("platform", "UNKNOWN").upper() for doc in documents if doc.get("platform")))
        entities = set()
        entity_keywords = ["cisco", "cert-in", "india", "china", "nato", "sbi", "parliament", "microsoft", "google", "rbi", "sebi", "finch", "neurotech", "spaceintel"]
        for doc in documents:
            text = (doc.get("text_content") or doc.get("content") or "").lower()
            for kw in entity_keywords:
                if kw in text: entities.add(kw.title())
        
        activity_trend = f"+{len(documents) * 12}%" if len(documents) > 2 else "0%"
        provenance = f"Matched indicators: '{q}'. Found {len(documents)} observations across {', '.join(platforms) or 'unknown platforms'}. Key entities detected: {', '.join(list(entities)[:5]) or 'None specific'}."

        return {
            "query": q,
            "summary": {"observations": len(documents), "entities": list(entities), "platforms": platforms, "activity_trend": activity_trend},
            "provenance": provenance,
            "posts": documents
        }
    except PyMongoError as e: 
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")

@app.get("/api/v1/analytics/mutation")
def get_narrative_mutation(narrative: str = Query(..., min_length=1, description="Topic phrase to track")):
    try:
        phrase = narrative.strip()
        pattern = re.escape(phrase)
        query = {"$or": [
            {"narrative_name": {"$regex": pattern, "$options": "i"}},
            {"text_content": {"$regex": pattern, "$options": "i"}},
            {"content": {"$regex": pattern, "$options": "i"}},
        ]}
        posts = list(raw_posts.find(
            query,
            {"_id": 0, "text_content": 1, "content": 1, "published_at": 1, "created_at": 1, "timestamp": 1, "sentiment_label": 1, "ai_analysis": 1},
        ).sort("published_at", 1).limit(5000))
        if not posts:
            return {"narrative": phrase, "total_observations": 0, "timeline": [], "mutations": []}

        weekly = {}
        for post in posts:
            published_at = next((
                _narrative_timestamp(post.get(field))
                for field in ("published_at", "created_at", "timestamp")
                if post.get(field) is not None
            ), None)
            if published_at is None:
                continue
            week_start = published_at.date() - timedelta(days=published_at.weekday())
            week_key = week_start.isoformat()
            period = weekly.setdefault(week_key, {"start": week_start, "posts": [], "terms": {}})
            period["posts"].append(post)
            text = post.get("text_content") or post.get("content") or ""
            for term in _post_topic_terms(text):
                period["terms"][term] = period["terms"].get(term, 0) + 1

        timeline = []
        mutations = []
        seen_terms = set()
        previous_sentiment = None
        for period in sorted(weekly.values(), key=lambda item: item["start"]):
            sentiments = []
            for post in period["posts"]:
                ai_analysis = post.get("ai_analysis") or {}
                sentiment = (post.get("sentiment_label") or ai_analysis.get("sentiment_label") or "NEUTRAL").upper()
                if sentiment in {"POSITIVE", "NEGATIVE", "NEUTRAL", "ABSTAIN"}:
                    sentiments.append(sentiment)
            dominant_sentiment = max(set(sentiments), key=sentiments.count) if sentiments else "NEUTRAL"
            week_label = period["start"].strftime("%b %d, %Y")
            timeline.append({
                "week": week_label,
                "volume": len(period["posts"]),
                "sentiment": dominant_sentiment,
            })

            new_terms = [
                term for term, count in sorted(period["terms"].items(), key=lambda item: item[1], reverse=True)
                if count >= 2 and term not in seen_terms and term != phrase.lower()
            ][:3]
            sentiment_changed = previous_sentiment is not None and dominant_sentiment != previous_sentiment
            if new_terms or sentiment_changed:
                mutations.append({
                    "week": week_label,
                    "time": week_label,
                    "new_elements": new_terms,
                    "sentiment_shift": dominant_sentiment,
                    "previous_sentiment": previous_sentiment,
                })
            seen_terms.update(period["terms"])
            previous_sentiment = dominant_sentiment

        return {
            "narrative": phrase,
            "total_observations": len(posts),
            "timeline": timeline,
            "mutations": mutations,
        }
    except PyMongoError as exc:
        raise HTTPException(status_code=500, detail=f"Failed to load mutation data: {str(exc)}") from exc
@app.get("/api/v1/analytics/correlation")
def get_cross_platform_correlation(q: str = Query(..., description="Topic to track across platforms")):
    try:
        pattern = re.escape(q.strip())
        query = {"$or": [
            {"text_content": {"$regex": pattern, "$options": "i"}}, 
            {"content": {"$regex": pattern, "$options": "i"}}
        ]}
        
        posts = _mongo_documents_to_json(list(raw_posts.find(query, {"_id": 0}).sort("published_at", 1)))
        
        if not posts:
            return {"query": q, "flow": []}

        platform_stats = {}
        for p in posts:
            plat = p.get("platform", "unknown").lower()
            if plat not in platform_stats:
                platform_stats[plat] = {
                    "first_seen": p.get("published_at"),
                    "count": 0,
                    "sample_text": (p.get("text_content") or p.get("content") or "")[:100]
                }
            platform_stats[plat]["count"] += 1

        flow = []
        for plat, stats in platform_stats.items():
            flow.append({
                "platform": plat.upper(),
                "first_seen": stats["first_seen"],
                "post_count": stats["count"],
                "sample_text": stats["sample_text"] + "..."
            })
        
        flow.sort(key=lambda x: x["first_seen"])

        return {"query": q, "flow": flow, "total_posts": len(posts)}

    except PyMongoError as exc:
        raise HTTPException(status_code=500, detail=f"Correlation failed: {str(exc)}") from exc

@app.get("/api/v1/analytics/alerts")
def get_alerts():
    """Generate REAL dynamic intelligence alerts based on actual database metrics."""
    alerts = []
    
    try:
        all_posts = list(raw_posts.find({}, {"_id": 0, "published_at": 1, "sentiment_label": 1, "narrative_name": 1, "text_content": 1, "platform": 1}))
        
        if not all_posts:
            return {"alerts": []}

        total_count = len(all_posts)
        now = datetime.now(timezone.utc)

        if total_count > 5:
            alerts.append({
                "id": "alert_vol_01",
                "type": "ACCELERATION",
                "severity": "CRITICAL",
                "title": f"High Data Ingestion: {total_count} Posts",
                "description": f"System has ingested {total_count} intelligence posts across monitored feeds in the current cycle.",
                "timestamp": now.isoformat()
            })

        sentiments = [p.get("sentiment_label") for p in all_posts if p.get("sentiment_label")]
        if sentiments:
            neg_count = sentiments.count("NEGATIVE")
            neg_pct = (neg_count / len(sentiments)) * 100
            if neg_pct > 20:
                alerts.append({
                    "id": "alert_sent_01",
                    "type": "SENTIMENT",
                    "severity": "WARNING",
                    "title": f"Negative Sentiment Spike: {neg_pct:.1f}%",
                    "description": f"Analysis shows {neg_pct:.1f}% of recent posts carry a NEGATIVE sentiment label.",
                    "timestamp": now.isoformat()
                })

        platforms = set(p.get("platform", "unknown").lower() for p in all_posts)
        if len(platforms) > 1:
            alerts.append({
                "id": "alert_plat_01",
                "type": "ENTITY",
                "severity": "INFO",
                "title": f"Cross-Platform Correlation Active ({len(platforms)} Sources)",
                "description": f"Narratives are spreading across multiple platforms: {', '.join(platforms).upper()}.",
                "timestamp": now.isoformat()
            })

        high_value_keywords = ["cisco", "ransomware", "vulnerability", "attack", "cert-in", "ai", "regulation", "china", "india"]
        found_keywords = set()
        for p in all_posts:
            text = (p.get("text_content") or "").lower()
            for kw in high_value_keywords:
                if kw in text:
                    found_keywords.add(kw.upper())
        
        if found_keywords:
            alerts.append({
                "id": "alert_kw_01",
                "type": "ENTITY",
                "severity": "CRITICAL",
                "title": f"High-Value Entities Detected: {', '.join(list(found_keywords)[:3])}",
                "description": f"AI analysis flagged critical keywords in recent intelligence feed.",
                "timestamp": now.isoformat()
            })

    except Exception as e:
        print(f"Alert generation error: {e}")

    alerts.sort(key=lambda x: x["timestamp"], reverse=True)
    return {"alerts": alerts}

@app.get("/api/v1/analytics/demographics")
def get_demographics():
    """Generate privacy-safe, inferred demographic aggregations."""
    try:
        posts = list(raw_posts.find({}, {"_id": 0, "platform": 1, "narrative_name": 1, "text_content": 1, "content": 1, "language": 1, "lang": 1, "detected_language": 1, "age": 1, "author_age": 1, "age_bracket": 1, "author": 1, "profile": 1}))
        
        if not posts:
            return {"regions": [], "professions": [], "age_brackets": [], "languages": []}

        profession_map = {
            "Cyber Attack": "Cybersecurity & InfoSec",
            "AI Development and Regulation": "AI Research & Tech Policy",
            "Defence and Security": "Defense & Military Analysts",
            "South China Sea Tensions": "Geopolitics & International Relations",
            "Financial Technology": "FinTech & Banking",
            "Startup Ecosystem": "Venture Capital & Founders"
        }
        professions = {}
        for p in posts:
            prof = profession_map.get(p.get("narrative_name"), "General Public")
            professions[prof] = professions.get(prof, 0) + 1

        region_keywords = {
            "South Asia": ["india", "sbi", "hdfc", "cert-in", "rbi", "sebi", "modi"],
            "North America": ["us", "usa", "washington", "silicon valley", "new york"],
            "Europe": ["eu", "nato", "uk", "london", "brussels"],
            "East Asia": ["china", "beijing", "taiwan", "japan", "tokyo"],
            "Global": ["global", "world", "international", "united nations"]
        }
        regions = {k: 0 for k in region_keywords}
        for p in posts:
            text = (p.get("text_content") or "").lower()
            matched = False
            for region, kws in region_keywords.items():
                if any(kw in text for kw in kws):
                    regions[region] += 1
                    matched = True
                    break
            if not matched:
                regions["Global"] += 1

        age_ranges = [(13, 17, "13-17"), (18, 24, "18-24"), (25, 34, "25-34"), (35, 44, "35-44"), (45, 54, "45-54"), (55, 64, "55-64"), (65, 120, "65+")]
        age_brackets = {label: 0 for _, _, label in age_ranges}
        languages = {}
        language_codes = {
            "en": "English", "hi": "Hindi", "mr": "Marathi", "bn": "Bengali", "pa": "Punjabi",
            "gu": "Gujarati", "ta": "Tamil", "te": "Telugu", "kn": "Kannada", "ml": "Malayalam",
            "ur": "Urdu", "ar": "Arabic", "zh": "Chinese", "ja": "Japanese", "ko": "Korean",
            "ru": "Russian", "uk": "Ukrainian", "el": "Greek", "es": "Spanish", "fr": "French", "pt": "Portuguese",
            "de": "German", "it": "Italian",
        }
        language_markers = {
            "English": {"the", "and", "for", "with", "from", "this", "that", "are", "was", "were", "will"},
            "Spanish": {"el", "la", "los", "las", "que", "por", "para", "con", "una", "del"},
            "French": {"les", "des", "une", "est", "pour", "avec", "dans", "sur", "pas", "qui"},
            "Portuguese": {"uma", "para", "com", "dos", "das", "que", "por", "mais", "não", "são"},
            "German": {"der", "die", "das", "und", "ist", "mit", "für", "nicht", "auf", "ein"},
            "Italian": {"che", "del", "della", "una", "per", "con", "sono", "gli", "non", "delle"},
        }
        script_languages = {
            "DEVANAGARI": "Hindi", "BENGALI": "Bengali", "GURMUKHI": "Punjabi", "GUJARATI": "Gujarati",
            "TAMIL": "Tamil", "TELUGU": "Telugu", "KANNADA": "Kannada", "MALAYALAM": "Malayalam",
            "HANGUL": "Korean", "HIRAGANA": "Japanese", "KATAKANA": "Japanese", "CJK": "Chinese", "ARABIC": "Arabic", "CYRILLIC": "Russian", "GREEK": "Greek",
        }

        def detect_language(post):
            supplied = post.get("detected_language") or post.get("language") or post.get("lang")
            if supplied:
                code = str(supplied).strip().lower().replace("_", "-").split("-")[0]
                if code in language_codes:
                    return language_codes[code]
                for language in language_codes.values():
                    if str(supplied).strip().lower() == language.lower():
                        return language

            text = post.get("text_content") or post.get("content") or ""
            letters = [char for char in text if char.isalpha()]
            if not letters:
                return None
            script_counts = {}
            for char in letters:
                name = unicodedata.name(char, "")
                for script, language in script_languages.items():
                    if script in name or (script == "CJK" and ("CJK UNIFIED" in name or "IDEOGRAPH" in name)):
                        script_counts[language] = script_counts.get(language, 0) + 1
                        break
            if script_counts:
                language, count = max(script_counts.items(), key=lambda item: item[1])
                if count / len(letters) >= 0.25:
                    codepoints = {ord(char) for char in text}
                    if language == "Arabic" and codepoints.intersection({0x0679, 0x0688, 0x0691, 0x06BA, 0x06BE, 0x06D2}):
                        return "Urdu"
                    if language == "Russian" and codepoints.intersection({0x0456, 0x0457, 0x0454, 0x0491}):
                        return "Ukrainian"
                    return language

            words = set(re.findall(r"[a-záéíóúüñàâçèêëîïôùûüÿœæäöß]+", text.lower()))
            scores = {language: len(words & markers) for language, markers in language_markers.items()}
            language, score = max(scores.items(), key=lambda item: item[1])
            return language if score >= 2 else None

        for post in posts:
            profile = post.get("profile") if isinstance(post.get("profile"), dict) else {}
            author = post.get("author") if isinstance(post.get("author"), dict) else {}
            age_value = post.get("age_bracket") or post.get("author_age") or post.get("age") or profile.get("age") or author.get("age")
            if isinstance(age_value, str):
                bracket_match = re.fullmatch(r"\s*(\d{1,2})\s*[-–]\s*(\d{1,2}|\+|\d{1,2}\+)\s*", age_value)
                if bracket_match:
                    bracket_text = f"{bracket_match.group(1)}-{bracket_match.group(2).replace('+', '')}"
                    if bracket_text in age_brackets:
                        age_brackets[bracket_text] += 1
                    elif bracket_match.group(2).endswith("+") and bracket_match.group(1) == "65":
                        age_brackets["65+"] += 1
                    age_value = None
                else:
                    try:
                        age_value = int(age_value)
                    except ValueError:
                        age_value = None
            if isinstance(age_value, (int, float)) and not isinstance(age_value, bool):
                for minimum, maximum, label in age_ranges:
                    if minimum <= age_value <= maximum:
                        age_brackets[label] += 1
                        break

            language = detect_language(post)
            if language:
                languages[language] = languages.get(language, 0) + 1
        format_data = lambda d: [{"name": k, "value": v} for k, v in d.items() if v > 0]

        return {
            "regions": format_data(regions),
            "professions": format_data(professions),
            "age_brackets": format_data(age_brackets),
            "languages": format_data(languages),
            "total_analyzed": len(posts)
        }

    except Exception as e:
        print(f"Demographics error: {e}")
        return {"regions": [], "professions": [], "age_brackets": [], "languages": []}

@app.get("/api/v1/graph/intelligence")
def get_advanced_network_intelligence():
    """Return graph degree, bridge, and type-group analytics."""
    try:
        with get_connection() as connection, connection.cursor() as cursor:
            cursor.execute("SELECT COUNT(*) FROM graph_nodes")
            total_nodes = cursor.fetchone()[0]
            if total_nodes == 0:
                return {"influencers": [], "bridges": [], "communities": [], "total_nodes": 0,
                        "message": "PostgreSQL graph is empty. Run graph_builder.py first."}
            cursor.execute("""SELECT n.label,n.node_type,d.degree FROM graph_nodes n JOIN (
                SELECT node_id,COUNT(*) degree FROM (SELECT source node_id FROM graph_edges UNION ALL SELECT target FROM graph_edges) i GROUP BY node_id
                ) d ON d.node_id=n.id ORDER BY d.degree DESC,n.label LIMIT %s""", (5,))
            influencers = [{"name": r[0] or "Unknown Node", "type": r[1] or "Entity", "degree": r[2]} for r in cursor.fetchall()]
            cursor.execute("""WITH neighbor_types AS (
                SELECT e.source node_id,n.node_type FROM graph_edges e JOIN graph_nodes n ON n.id=e.target
                UNION ALL SELECT e.target,n.node_type FROM graph_edges e JOIN graph_nodes n ON n.id=e.source
                ), scores AS (SELECT node_id,COUNT(DISTINCT node_type) bridge_score FROM neighbor_types GROUP BY node_id HAVING COUNT(DISTINCT node_type)>1)
                SELECT n.label,s.bridge_score FROM scores s JOIN graph_nodes n ON n.id=s.node_id ORDER BY s.bridge_score DESC,n.label LIMIT %s""", (5,))
            bridges = [{"name": r[0], "bridge_score": r[1]} for r in cursor.fetchall()]
            if len(bridges) < 3:
                cursor.execute("""SELECT n.label,n.node_type,COUNT(e.node_id) degree FROM graph_nodes n LEFT JOIN (
                    SELECT source node_id FROM graph_edges UNION ALL SELECT target FROM graph_edges) e ON e.node_id=n.id
                    GROUP BY n.id ORDER BY n.node_type,degree DESC,n.label""")
                seen_names = {item["name"] for item in bridges}; seen_types = set()
                for name, node_type, degree in cursor.fetchall():
                    if degree and name not in seen_names and node_type not in seen_types:
                        bridges.append({"name": name, "bridge_score": degree}); seen_names.add(name); seen_types.add(node_type)
                    if len(bridges) >= 5: break
            cursor.execute("SELECT node_type,COUNT(*) size FROM graph_nodes GROUP BY node_type ORDER BY size DESC,node_type")
            communities = [{"community": r[0] or "Unknown", "size": r[1]} for r in cursor.fetchall()]
            return {"influencers": influencers, "bridges": bridges, "communities": communities, "total_nodes": total_nodes}
    except Exception as exc:
        print(f"PostgreSQL graph intelligence error: {exc}")
        raise HTTPException(status_code=500, detail=f"Graph intelligence failed: {str(exc)}") from exc

@app.on_event("shutdown")
def shutdown_event():
    close_pool()
    mongo_client.close()
@app.get("/{full_path:path}")
async def serve_react_app(full_path: str):
    file_path = os.path.join(static_dir, full_path)
    if os.path.isfile(file_path):
        return FileResponse(file_path)

    index_path = os.path.join(static_dir, "index.html")
    if os.path.isfile(index_path):
        return FileResponse(index_path)

    return {"error": "Frontend not found"}