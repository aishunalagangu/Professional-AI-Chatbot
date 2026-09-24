from datetime import datetime
from pydantic import BaseModel


# -------------------------
# USER AUTHENTICATION
# -------------------------

class UserRegister(BaseModel):
    name: str
    email: str
    password: str


class UserResponse(BaseModel):
    id: int
    name: str
    email: str


class LoginRequest(BaseModel):
    email: str
    password: str


class LoginResponse(BaseModel):
    message: str
    user: UserResponse


# -------------------------
# CONVERSATIONS
# -------------------------

class ConversationCreate(BaseModel):
    title: str
    user_id: int


class ConversationResponse(BaseModel):
    id: int
    title: str
    user_id: int


# -------------------------
# CHAT
# -------------------------

class ChatRequest(BaseModel):
    message: str
    conversation_id: int
    user_id: int


class ChatResponse(BaseModel):
    id: int
    conversation_id: int
    user_message: str
    bot_response: str
    created_at: datetime


class ChatHistoryResponse(BaseModel):
    id: int
    conversation_id: int
    user_message: str
    bot_response: str
    created_at: datetime