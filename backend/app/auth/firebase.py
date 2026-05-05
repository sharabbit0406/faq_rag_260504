"""
Initialize Firebase Admin SDK once at startup.
Called from main.py lifespan.
"""
import firebase_admin
from firebase_admin import credentials


def init_firebase(credentials_path: str):
    if not firebase_admin._apps:
        cred = credentials.Certificate(credentials_path)
        firebase_admin.initialize_app(cred)
