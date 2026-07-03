import asyncio
from app.database import get_async_db
from app.models import User
from app.auth import hash_password

async def create_user():
    async for db in get_async_db():
        # Проверяем, есть ли уже такой пользователь
        from sqlalchemy import select
        result = await db.execute(select(User).where(User.username == "test"))
        if result.scalar_one_or_none():
            print("Пользователь 'test' уже существует")
            return
        
        user = User(
            username="test",
            hashed_password=hash_password("test123"),
            role="user"  # или "admin", если нужна админка
        )
        db.add(user)
        await db.commit()
        print("Создан пользователь: test / test123")
        return

if __name__ == "__main__":
    asyncio.run(create_user())