"""Pydantic request models for the API."""

from pydantic import BaseModel, Field


class PlayerCreate(BaseModel):
    name: str = Field(min_length=1, max_length=40)
    color: str = Field(default="#4f46e5", max_length=16)


class GameCreate(BaseModel):
    player_ids: list[int] = Field(default_factory=list)


class JoinGame(BaseModel):
    player_id: int


class ScoreEntry(BaseModel):
    game_player_id: int
    category: str
    value: int


class BonusEntry(BaseModel):
    game_player_id: int
    bonus_count: int = Field(ge=0)
