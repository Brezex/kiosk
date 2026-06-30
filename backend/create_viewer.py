from app.database import SessionLocal, init_db
from app.models import User
from passlib.context import CryptContext

def create_viewer():
    init_db()
    db = SessionLocal()
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    
    username = input("Логин для viewer: ").strip()
    password = input("Пароль: ").strip()
    
    existing = db.query(User).filter(User.username == username).first()
    if existing:
        print(f"⚠️  Пользователь '{username}' уже существует")
        db.close()
        return
    
    user = User(
        username=username,
        hashed_password=pwd_context.hash(password),
        role="viewer",
        must_change_password=False
    )
    db.add(user)
    db.commit()
    
    print(f"✅ Viewer создан: {username}")
    db.close()

if __name__ == "__main__":
    create_viewer()