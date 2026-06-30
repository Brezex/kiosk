from app.database import SessionLocal, init_db
from app.models import User
from passlib.context import CryptContext

def reset():
    init_db()
    db = SessionLocal()
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    
    user = db.query(User).filter(User.username == "admin").first()
    if user:
        user.hashed_password = pwd_context.hash("admin123")
        user.must_change_password = True
        db.commit()
        print("✅ Пароль админа успешно сброшен на: admin123")
    else:
        new_user = User(
            username="admin",
            hashed_password=pwd_context.hash("admin123"),
            role="admin",
            must_change_password=False
        )
        db.add(new_user)
        db.commit()
        print("✅ Админ создан! Пароль: admin123")
    
    db.close()

if __name__ == "__main__":
    reset()