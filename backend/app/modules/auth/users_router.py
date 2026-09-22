from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.core.database.session import get_db
from app.core.auth_deps import get_current_user
from app.core.database.models import User
from app.modules.auth.schemas import UserSearchResult

router = APIRouter(prefix="/api/v1/users", tags=["users"])

@router.get("/search", response_model=list[UserSearchResult])
def search_users(
    q: str = Query("", description="Término de búsqueda (mínimo 2 caracteres)"),
    limit: int = Query(10, ge=1, le=10, description="Límite máximo de resultados"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query_str = q.strip()
    if len(query_str) < 2:
        return []
    
    search_term = f"%{query_str}%"
    users = db.query(User).filter(
        User.id != current_user.id,
        User.is_active == True,
        (User.username.ilike(search_term) | User.display_name.ilike(search_term))
    ).limit(limit).all()
    
    return [
        UserSearchResult(
            id=u.id,
            username=u.username,
            display_name=u.display_name,
            avatar_url=None
        )
        for u in users
    ]
