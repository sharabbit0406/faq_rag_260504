"""
Initialize Firebase Admin SDK once at startup.
Called from main.py lifespan.
"""
import firebase_admin
from firebase_admin import credentials


def init_firebase(credentials_source: str):
    if not firebase_admin._apps:
        import json
        # Support inline JSON string (from Secret Manager env var) or file path
        if credentials_source.strip().startswith("{"):
            cred = credentials.Certificate(json.loads(credentials_source))
        else:
            cred = credentials.Certificate(credentials_source)
        firebase_admin.initialize_app(cred)
