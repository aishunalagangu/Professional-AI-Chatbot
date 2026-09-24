from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

import ollama

from database import engine, get_db, Base
from models import User, Conversation, ChatMessage

from schemas import (
    ConversationCreate,
    ConversationResponse,
    ChatRequest,
    ChatResponse,
    ChatHistoryResponse,
    UserRegister,
    UserResponse,
    LoginRequest,
    LoginResponse
)

from passlib.context import CryptContext


Base.metadata.create_all(bind=engine)


app = FastAPI(
    title="Professional Chatbot API",
    version="1.0.0"
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto"
)


@app.get("/")
def home():
    return {
        "message": "Professional Chatbot API is running"
    }

@app.post("/register", response_model=UserResponse)
def register_user(
    request: UserRegister,
    db: Session = Depends(get_db)
):
    existing_user = (
        db.query(User)
        .filter(User.email == request.email)
        .first()
    )

    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Email already registered"
        )

    hashed_password = pwd_context.hash(
        request.password
    )

    user = User(
        name=request.name,
        email=request.email,
        password=hashed_password
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return user


@app.post("/login", response_model=LoginResponse)
def login_user(
    request: LoginRequest,
    db: Session = Depends(get_db)
):
    user = (
        db.query(User)
        .filter(User.email == request.email)
        .first()
    )

    if user is None:
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    password_correct = pwd_context.verify(
        request.password,
        user.password
    )

    if not password_correct:
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    return {
        "message": "Login successful",
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email
        }
    }

# -----------------------------------------
# CREATE CONVERSATION
# -----------------------------------------
@app.post(
    "/conversations",
    response_model=ConversationResponse
)
def create_conversation(
    request: ConversationCreate,
    db: Session = Depends(get_db)
):
    user = (
        db.query(User)
        .filter(User.id == request.user_id)
        .first()
    )

    if user is None:
        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    conversation = Conversation(
        title=request.title,
        user_id=request.user_id
    )

    db.add(conversation)
    db.commit()
    db.refresh(conversation)

    return conversation
# -----------------------------------------
# GET ALL CONVERSATIONS
# -----------------------------------------
@app.get(
    "/conversations",
    response_model=list[ConversationResponse]
)
def get_conversations(
    user_id: int,
    db: Session = Depends(get_db)
):
    conversations = (
        db.query(Conversation)
        .filter(
            Conversation.user_id == user_id
        )
        .order_by(Conversation.id.desc())
        .all()
    )

    return conversations

# -----------------------------------------
# SEND MESSAGE
# -----------------------------------------

@app.post(
    "/chat",
    response_model=ChatResponse
)
def chat(
    request: ChatRequest,
    db: Session = Depends(get_db)
):
    conversation = (
        db.query(Conversation)
        .filter(
            Conversation.id ==
            request.conversation_id,
            Conversation.user_id ==
            request.user_id
        )
        .first()
    )

    if conversation is None:
        raise HTTPException(
            status_code=404,
            detail="Conversation not found"
        )

    user_message = request.message

    if conversation.title == "New Conversation":
        title = user_message.strip()

        if len(title) > 35:
            title = title[:35] + "..."

        conversation.title = title

    history = (
        db.query(ChatMessage)
        .filter(
            ChatMessage.conversation_id ==
            request.conversation_id
        )
        .order_by(ChatMessage.id.asc())
        .all()
    )

    messages = []

    for chat in history:
        messages.append({
            "role": "user",
            "content": chat.user_message
        })

        messages.append({
            "role": "assistant",
            "content": chat.bot_response
        })

    messages.append({
        "role": "user",
        "content": user_message
    })

    try:
        response = ollama.chat(
            model="llama3.2",
            messages=messages
        )

        ai_response = response["message"]["content"]

    except Exception as e:
        print(f"Ollama AI Error: {e}")

        raise HTTPException(
            status_code=500,
            detail="AI service error"
        )

    chat_message = ChatMessage(
        conversation_id=request.conversation_id,
        user_message=user_message,
        bot_response=ai_response
    )

    db.add(chat_message)

    db.commit()

    db.refresh(chat_message)

    return chat_message
   
# -----------------------------------------
# GET MESSAGES OF ONE CONVERSATION
# -----------------------------------------
@app.get(
    "/conversations/{conversation_id}/messages",
    response_model=list[ChatHistoryResponse]
)
def get_conversation_messages(
    conversation_id: int,
    user_id: int,
    db: Session = Depends(get_db)
):
    conversation = (
        db.query(Conversation)
        .filter(
            Conversation.id == conversation_id,
            Conversation.user_id == user_id
        )
        .first()
    )

    if conversation is None:
        raise HTTPException(
            status_code=404,
            detail="Conversation not found"
        )

    messages = (
        db.query(ChatMessage)
        .filter(
            ChatMessage.conversation_id ==
            conversation_id
        )
        .order_by(ChatMessage.id.asc())
        .all()
    )

    return messages
   
# -----------------------------------------
# DELETE CONVERSATION
# -----------------------------------------

@app.delete(
    "/conversations/{conversation_id}"
)
def delete_conversation(
    conversation_id: int,
    user_id: int,
    db: Session = Depends(get_db)
):
    conversation = (
        db.query(Conversation)
        .filter(
            Conversation.id == conversation_id,
            Conversation.user_id == user_id
        )
        .first()
    )

    if conversation is None:
        raise HTTPException(
            status_code=404,
            detail="Conversation not found"
        )

    db.query(ChatMessage).filter(
        ChatMessage.conversation_id ==
        conversation_id
    ).delete(
        synchronize_session=False
    )

    db.delete(conversation)

    db.commit()

    return {
        "message": "Conversation deleted successfully"
    }

@app.put(
    "/conversations/{conversation_id}",
    response_model=ConversationResponse
)
def rename_conversation(
    conversation_id: int,
    request: ConversationCreate,
    db: Session = Depends(get_db)
):
    conversation = (
        db.query(Conversation)
        .filter(
            Conversation.id == conversation_id,
            Conversation.user_id == request.user_id
        )
        .first()
    )

    if conversation is None:
        raise HTTPException(
            status_code=404,
            detail="Conversation not found"
        )

    new_title = request.title.strip()

    if not new_title:
        raise HTTPException(
            status_code=400,
            detail="Conversation title cannot be empty"
        )

    conversation.title = new_title

    db.commit()

    db.refresh(conversation)

    return conversation