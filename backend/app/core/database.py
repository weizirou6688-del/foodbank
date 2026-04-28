"""共享的异步 engine 和 session 生命周期,供请求和后台任务使用。"""

from typing import AsyncGenerator

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings


engine: AsyncEngine = create_async_engine(
    settings.database_url,
    echo=settings.debug,
    future=True,
    pool_pre_ping=True,
)

AsyncSessionLocal = sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            # 依赖注入这一层管事务,这样 router 和 service 可以自由组合写操作,
            # 不用每个调用方各自决定什么时候提交
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def check_database_connection() -> tuple[bool, str | None]:
    # 健康检查用一个短连接,而不是借用请求 session
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return True, None
    except Exception as exc:
        return False, str(exc)


async def close_db() -> None:
    # 显式释放连接池,本地重启时能快速回收连接
    await engine.dispose()
