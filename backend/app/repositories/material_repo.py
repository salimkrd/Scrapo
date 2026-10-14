from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.orm import Session
from backend.app.models.material import Material, MaterialAlias, MaterialCategory


class MaterialRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, material_id: str) -> Optional[Material]:
        return self.db.get(Material, material_id)

    def list_by_yard(self, yard_id: str, active_only: bool = True) -> List[Material]:
        stmt = select(Material).where(Material.yard_id == yard_id)
        if active_only:
            stmt = stmt.where(Material.active == True)
        return list(self.db.execute(stmt).scalars().all())

    def get_alias_by_id(self, alias_id: str) -> Optional[MaterialAlias]:
        return self.db.get(MaterialAlias, alias_id)

    def get_primary_alias(self, material_id: str) -> Optional[MaterialAlias]:
        stmt = select(MaterialAlias).where(
            MaterialAlias.material_id == material_id,
            MaterialAlias.is_primary == True,
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def update_alias(
        self,
        alias_id: str,
        display_name_english: Optional[str] = None,
        display_name_malayalam: Optional[str] = None,
        local_subtitle: Optional[str] = None,
        version: Optional[int] = None,
    ) -> MaterialAlias:
        alias = self.db.get(MaterialAlias, alias_id)
        if not alias:
            raise ValueError(f"Material alias {alias_id} not found")

        # Optimistic concurrency check
        if version is not None and alias.version != version:
            from backend.app.core.errors import ConflictError
            raise ConflictError(
                f"Alias has been updated by another user. Client version: {version}, Server version: {alias.version}"
            )

        if display_name_english is not None:
            alias.display_name_english = display_name_english.strip()
        if display_name_malayalam is not None:
            alias.display_name_malayalam = display_name_malayalam.strip()
        if local_subtitle is not None:
            alias.local_subtitle = local_subtitle.strip()

        alias.version += 1
        self.db.commit()
        self.db.refresh(alias)
        return alias

    def create_material(self, material: Material) -> Material:
        self.db.add(material)
        self.db.commit()
        self.db.refresh(material)
        return material

    def create_alias(self, alias: MaterialAlias) -> MaterialAlias:
        self.db.add(alias)
        self.db.commit()
        self.db.refresh(alias)
        return alias
