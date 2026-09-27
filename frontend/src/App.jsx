import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import {
  Send,
  Bot,
  User,
  Plus,
  Trash2,
  MessageSquare,
  Menu,
  X,
  Copy,
  Search,
  Pencil,
  Check,
} from "lucide-react";

import Auth from "./Auth";
import "./App.css";

const API_URL = "http://127.0.0.1:8000";

function App() {
  // -----------------------------
  // USER
  // -----------------------------

  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem("chatbot_user");

    try {
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });

  // -----------------------------
  // CHAT STATE
  // -----------------------------

  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] =
    useState(null);

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");

  // General request state
  const [loading, setLoading] = useState(false);

  // Conversation history loading
  const [loadingConversationId, setLoadingConversationId] =
    useState(null);

  // AI typing state
  // This contains ONLY the conversation currently generating AI response
  const [typingConversationId, setTypingConversationId] =
    useState(null);

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Copy state
  const [copiedIndex, setCopiedIndex] = useState(null);

  // Rename state
  const [editingId, setEditingId] = useState(null);
  const [editingTitle, setEditingTitle] = useState("");

  const messagesEndRef = useRef(null);

  // Used to identify the latest message request
  const typingRequestRef = useRef(0);

  // Used to prevent old conversation-loading requests
  // from overwriting the currently selected conversation
  const historyRequestRef = useRef(0);

  // -----------------------------
  // FORMAT TIME - IST
  // -----------------------------

  const formatMessageTime = (timestamp) => {
    if (!timestamp) return "";

    let date;

    if (typeof timestamp === "string") {
      const value = timestamp.endsWith("Z")
        ? timestamp
        : `${timestamp}Z`;

      date = new Date(value);
    } else {
      date = new Date(timestamp);
    }

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    return date.toLocaleTimeString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  // -----------------------------
  // FORMAT DATABASE MESSAGES
  // -----------------------------

  const formatHistoryMessages = (data) => {
    if (!Array.isArray(data)) {
      return [];
    }

    const formattedMessages = [];

    data.forEach((chat) => {
      if (chat.user_message !== undefined) {
        formattedMessages.push({
          id: `${chat.id}-user`,
          role: "user",
          content: chat.user_message,
          created_at: chat.created_at,
        });
      }

      if (chat.bot_response !== undefined) {
        formattedMessages.push({
          id: `${chat.id}-assistant`,
          role: "assistant",
          content: chat.bot_response,
          created_at: chat.created_at,
        });
      }
    });

    return formattedMessages;
  };

  // -----------------------------
  // LOGIN
  // -----------------------------

  const handleLogin = (loggedInUser) => {
    localStorage.setItem(
      "chatbot_user",
      JSON.stringify(loggedInUser)
    );

    setUser(loggedInUser);

    setConversations([]);
    setMessages([]);
    setActiveConversationId(null);
    setSearchTerm("");
    setLoading(false);
    setLoadingConversationId(null);
    setTypingConversationId(null);
    setCopiedIndex(null);
    setEditingId(null);
    setEditingTitle("");

    typingRequestRef.current += 1;
    historyRequestRef.current += 1;
  };

  // -----------------------------
  // LOGOUT
  // -----------------------------

  const handleLogout = () => {
    localStorage.removeItem("chatbot_user");

    setUser(null);
    setConversations([]);
    setMessages([]);
    setActiveConversationId(null);
    setSearchTerm("");
    setEditingId(null);
    setEditingTitle("");
    setLoadingConversationId(null);
    setTypingConversationId(null);
    setCopiedIndex(null);
    setLoading(false);
    setInput("");

    typingRequestRef.current += 1;
    historyRequestRef.current += 1;
  };

  // -----------------------------
  // LOAD CONVERSATIONS
  // -----------------------------

  const loadConversations = async () => {
    if (!user?.id) {
      return [];
    }

    try {
      const response = await fetch(
        `${API_URL}/conversations?user_id=${user.id}`
      );

      if (!response.ok) {
        const errorText = await response.text();

        console.error(
          "Conversation loading failed:",
          response.status,
          errorText
        );

        throw new Error("Failed to load conversations");
      }

      const data = await response.json();

      console.log("Previous conversations:", data);

      if (!Array.isArray(data)) {
        setConversations([]);
        return [];
      }

      setConversations(data);

      return data;
    } catch (error) {
      console.error(
        "Error loading conversations:",
        error
      );

      setConversations([]);

      return [];
    }
  };

  // -----------------------------
  // LOAD MESSAGES
  // -----------------------------

  const loadMessages = async (conversationId) => {
    if (!conversationId || !user?.id) {
      setMessages([]);
      setLoadingConversationId(null);
      return;
    }

    const requestId = ++historyRequestRef.current;

    try {
      setLoadingConversationId(conversationId);
      setCopiedIndex(null);

      setMessages([]);

      const response = await fetch(
        `${API_URL}/conversations/${conversationId}/messages?user_id=${user.id}`
      );

      if (!response.ok) {
        const errorText = await response.text();

        console.error(
          "Message history loading failed:",
          response.status,
          errorText
        );

        throw new Error("Failed to load messages");
      }

      const data = await response.json();

      console.log(
        `Messages for conversation ${conversationId}:`,
        data
      );

      // Ignore old request if user changed conversation
      if (requestId !== historyRequestRef.current) {
        return;
      }

      if (!Array.isArray(data)) {
        console.error(
          "Unexpected messages response:",
          data
        );

        setMessages([]);
        return;
      }

      const formattedMessages =
        formatHistoryMessages(data);

      setMessages(formattedMessages);
    } catch (error) {
      // Ignore old request errors
      if (requestId !== historyRequestRef.current) {
        return;
      }

      console.error(
        "Error loading messages:",
        error
      );

      setMessages([]);
    } finally {
      // Only clear loading if this is still the latest request
      if (requestId === historyRequestRef.current) {
        setLoadingConversationId(null);
      }
    }
  };

  // -----------------------------
  // SELECT CONVERSATION
  // -----------------------------

  const handleConversationSelect = async (
    conversationId
  ) => {
    if (!conversationId || !user?.id) {
      return;
    }

    console.log(
      "Switching to conversation:",
      conversationId
    );

    // IMPORTANT:
    // Immediately stop showing AI typing indicator
    // when changing conversation.
    setTypingConversationId(null);

    // Invalidate any previous AI request UI
    typingRequestRef.current += 1;

    setCopiedIndex(null);
    setEditingId(null);
    setEditingTitle("");

    // Clear old messages immediately
    setMessages([]);

    // Select new conversation
    setActiveConversationId(conversationId);

    // Load its messages
    await loadMessages(conversationId);
  };

  // -----------------------------
  // INITIAL LOAD
  // -----------------------------

  useEffect(() => {
    const initializeChat = async () => {
      if (!user?.id) {
        return;
      }

      console.log(
        "Loading conversations for user:",
        user.id
      );

      const data = await loadConversations();

      if (data.length > 0) {
        if (activeConversationId === null) {
          setActiveConversationId(data[0].id);
        }
      } else {
        setActiveConversationId(null);
        setMessages([]);
      }
    };

    initializeChat();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // -----------------------------
  // ACTIVE CONVERSATION CHANGE
  // -----------------------------

  useEffect(() => {
    if (activeConversationId && user?.id) {
      loadMessages(activeConversationId);
    } else {
      setMessages([]);
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConversationId, user]);

  // -----------------------------
  // AUTO SCROLL
  // -----------------------------

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages, loading, typingConversationId]);

  // -----------------------------
  // CREATE CONVERSATION
  // -----------------------------

  const createConversation = async () => {
    if (!user?.id) {
      return null;
    }

    try {
      const response = await fetch(
        `${API_URL}/conversations`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: "New Conversation",
            user_id: user.id,
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();

        console.error(
          "Create conversation failed:",
          response.status,
          errorText
        );

        throw new Error(
          "Failed to create conversation"
        );
      }

      const newConversation = await response.json();

      console.log(
        "New conversation created:",
        newConversation
      );

      setConversations((previous) => [
        newConversation,
        ...previous,
      ]);

      setActiveConversationId(newConversation.id);
      setMessages([]);
      setSearchTerm("");
      setCopiedIndex(null);
      setEditingId(null);
      setEditingTitle("");

      // New conversation should never inherit
      // another conversation's typing indicator.
      setTypingConversationId(null);

      return newConversation.id;
    } catch (error) {
      console.error(
        "Error creating conversation:",
        error
      );

      return null;
    }
  };

  // -----------------------------
  // SEND MESSAGE
  // -----------------------------

  const sendMessage = async () => {
    const message = input.trim();

    if (!message || loading || !user?.id) {
      return;
    }

    setInput("");
    setLoading(true);
    setCopiedIndex(null);

    // Generate unique request ID
    const requestId = ++typingRequestRef.current;

    try {
      let conversationId = activeConversationId;

      // If no conversation exists, create one
      if (!conversationId) {
        conversationId = await createConversation();

        if (!conversationId) {
          throw new Error(
            "Failed to create conversation"
          );
        }
      }

      console.log(
        "Sending message to conversation:",
        conversationId
      );

      // IMPORTANT:
      // Typing indicator belongs ONLY to this conversation.
      setTypingConversationId(conversationId);

      const currentTime =
        new Date().toISOString();

      // Add user's message
      setMessages((previous) => [
        ...previous,
        {
          id: `user-${Date.now()}`,
          role: "user",
          content: message,
          created_at: currentTime,
        },
      ]);

      const response = await fetch(
        `${API_URL}/chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message,
            conversation_id: conversationId,
            user_id: user.id,
          }),
        }
      );

      if (!response.ok) {
        let errorMessage =
          "Chat request failed";

        try {
          const errorData =
            await response.json();

          errorMessage =
            errorData.detail ||
            errorMessage;
        } catch {
          // Ignore JSON parsing error
        }

        throw new Error(errorMessage);
      }

      const data = await response.json();

      console.log(
        "Chat response:",
        data
      );

      /*
       * IMPORTANT:
       * Only update the visible messages if
       * the user is still viewing the same conversation.
       */
      if (
        activeConversationId ===
        conversationId
      ) {
        setMessages((previous) => [
          ...previous,
          {
            id:
              data.id ||
              `assistant-${Date.now()}`,
            role: "assistant",
            content:
              data.bot_response ||
              "Sorry, I couldn't generate a response.",
            created_at:
              data.created_at ||
              currentTime,
          },
        ]);
      }

      await loadConversations();

      // Refresh history only if user is still
      // viewing this conversation.
      if (
        activeConversationId ===
        conversationId
      ) {
        const historyResponse =
          await fetch(
            `${API_URL}/conversations/${conversationId}/messages?user_id=${user.id}`
          );

        if (historyResponse.ok) {
          const historyData =
            await historyResponse.json();

          /*
           * Only update if:
           * 1. Same conversation
           * 2. Same request
           */
          if (
            Array.isArray(historyData) &&
            activeConversationId ===
              conversationId &&
            requestId ===
              typingRequestRef.current
          ) {
            const formattedMessages =
              formatHistoryMessages(
                historyData
              );

            setMessages(
              formattedMessages
            );
          }
        } else {
          console.error(
            "Failed to refresh chat history:",
            historyResponse.status
          );
        }
      }
    } catch (error) {
      console.error(
        "Chat error:",
        error
      );

      /*
       * Only display error in the conversation
       * where the request was started.
       */
      if (
        activeConversationId !== null &&
        activeConversationId ===
          activeConversationId
      ) {
        setMessages((previous) => [
          ...previous,
          {
            id: `error-${Date.now()}`,
            role: "assistant",
            content:
              error.message ||
              "Sorry, something went wrong. Please try again.",
            created_at:
              new Date().toISOString(),
          },
        ]);
      }
    } finally {
      /*
       * Only clear typing indicator for the
       * request that is still current.
       */
      if (
        requestId ===
        typingRequestRef.current
      ) {
        setTypingConversationId(null);
        setLoading(false);
      }
    }
  };

  // -----------------------------
  // ENTER KEY
  // -----------------------------

  const handleKeyDown = (event) => {
    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault();
      sendMessage();
    }
  };

  // -----------------------------
  // DELETE CONVERSATION
  // -----------------------------

  const deleteConversation = async (
    conversationId
  ) => {
    if (!user?.id) {
      return;
    }

    const confirmed = window.confirm(
      "Delete this conversation?"
    );

    if (!confirmed) {
      return;
    }

    try {
      const response = await fetch(
        `${API_URL}/conversations/${conversationId}?user_id=${user.id}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        const errorText =
          await response.text();

        console.error(
          "Delete failed:",
          response.status,
          errorText
        );

        throw new Error(
          "Failed to delete conversation"
        );
      }

      const remainingConversations =
        conversations.filter(
          (conversation) =>
            conversation.id !==
            conversationId
        );

      setConversations(
        remainingConversations
      );

      // If deleted conversation was active
      if (
        activeConversationId ===
        conversationId
      ) {
        setMessages([]);
        setCopiedIndex(null);

        // Stop typing immediately
        setTypingConversationId(null);

        // Invalidate old request
        typingRequestRef.current += 1;

        if (
          remainingConversations.length >
          0
        ) {
          setActiveConversationId(
            remainingConversations[0].id
          );
        } else {
          setActiveConversationId(null);
        }

        setLoading(false);
      }

      // If deleted conversation was typing
      if (
        typingConversationId ===
        conversationId
      ) {
        setTypingConversationId(null);
        setLoading(false);

        typingRequestRef.current += 1;
      }
    } catch (error) {
      console.error(
        "Error deleting conversation:",
        error
      );
    }
  };

  // -----------------------------
  // START RENAME
  // -----------------------------

  const startRename = (
    conversation
  ) => {
    setEditingId(conversation.id);
    setEditingTitle(
      conversation.title || ""
    );
  };

  // -----------------------------
  // SAVE RENAME
  // -----------------------------

  const saveRename = async (
    conversationId
  ) => {
    if (!user?.id) {
      return;
    }

    const title =
      editingTitle.trim();

    if (!title) {
      setEditingId(null);
      setEditingTitle("");
      return;
    }

    try {
      const response = await fetch(
        `${API_URL}/conversations/${conversationId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            title,
            user_id: user.id,
          }),
        }
      );

      if (!response.ok) {
        const errorText =
          await response.text();

        console.error(
          "Rename failed:",
          response.status,
          errorText
        );

        throw new Error(
          "Failed to rename conversation"
        );
      }

      const updatedConversation =
        await response.json();

      setConversations((previous) =>
        previous.map(
          (conversation) =>
            conversation.id ===
            conversationId
              ? updatedConversation
              : conversation
        )
      );

      setEditingId(null);
      setEditingTitle("");
    } catch (error) {
      console.error(
        "Error renaming conversation:",
        error
      );
    }
  };

  // -----------------------------
  // FILTER CONVERSATIONS
  // -----------------------------

  const filteredConversations =
    conversations.filter(
      (conversation) =>
        (conversation.title || "")
          .toLowerCase()
          .includes(
            searchTerm.toLowerCase()
          )
    );

  // -----------------------------
  // COPY MESSAGE
  // -----------------------------

  const copyMessage = async (
    content,
    index
  ) => {
    try {
      if (
        navigator.clipboard &&
        window.isSecureContext
      ) {
        await navigator.clipboard.writeText(
          content
        );

        setCopiedIndex(index);

        setTimeout(() => {
          setCopiedIndex(null);
        }, 2000);

        return;
      }

      const textArea =
        document.createElement(
          "textarea"
        );

      textArea.value = content;

      textArea.setAttribute(
        "readonly",
        ""
      );

      textArea.style.position =
        "fixed";
      textArea.style.top = "0";
      textArea.style.left = "0";
      textArea.style.width = "2px";
      textArea.style.height = "2px";
      textArea.style.padding = "0";
      textArea.style.border = "none";
      textArea.style.outline = "none";
      textArea.style.boxShadow =
        "none";
      textArea.style.background =
        "transparent";

      document.body.appendChild(
        textArea
      );

      textArea.focus();
      textArea.select();

      textArea.setSelectionRange(
        0,
        textArea.value.length
      );

      const successful =
        document.execCommand(
          "copy"
        );

      document.body.removeChild(
        textArea
      );

      if (successful) {
        setCopiedIndex(index);

        setTimeout(() => {
          setCopiedIndex(null);
        }, 2000);
      } else {
        console.error(
          "Copy command failed"
        );
      }
    } catch (error) {
      console.error(
        "Copy failed:",
        error
      );
    }
  };

  // -----------------------------
  // LOGIN SCREEN
  // -----------------------------

  if (!user) {
    return (
      <Auth
        onLogin={handleLogin}
      />
    );
  }

  // -----------------------------
  // CHATBOT UI
  // -----------------------------

  return (
    <div className="app">

      {/* SIDEBAR */}

      <aside
        className={`sidebar ${
          sidebarOpen
            ? "open"
            : "closed"
        }`}
      >
        <div className="sidebar-header">

          <div className="brand">
            <Bot size={22} />

            {sidebarOpen && (
              <span>
                AI Chatbot
              </span>
            )}
          </div>

          <button
            className="icon-btn"
            onClick={() =>
              setSidebarOpen(false)
            }
            title="Close sidebar"
          >
            <X size={20} />
          </button>

        </div>

        {sidebarOpen && (
          <>

            {/* NEW CHAT */}

            <button
              className="new-chat-btn"
              onClick={
                createConversation
              }
            >
              <Plus size={18} />

              <span>
                New Chat
              </span>
            </button>

            {/* SEARCH */}

            <div className="search-box">

              <Search size={17} />

              <input
                type="text"
                placeholder="Search chats..."
                value={searchTerm}
                onChange={(e) =>
                  setSearchTerm(
                    e.target.value
                  )
                }
              />

              {searchTerm && (
                <button
                  className="search-clear"
                  onClick={() =>
                    setSearchTerm("")
                  }
                  type="button"
                >
                  ×
                </button>
              )}

            </div>

            {/* CONVERSATION LIST */}

            <div className="conversation-list">

              {filteredConversations.length ===
              0 ? (

                <div className="empty-conversations">

                  <MessageSquare
                    size={20}
                  />

                  <span>
                    No conversations
                  </span>

                </div>

              ) : (

                filteredConversations.map(
                  (conversation) => (

                    <div
                      key={
                        conversation.id
                      }
                      className={`conversation-item ${
                        activeConversationId ===
                        conversation.id
                          ? "active"
                          : ""
                      }`}
                    >

                      {editingId ===
                      conversation.id ? (

                        <div className="rename-container">

                          <input
                            className="rename-input"
                            value={
                              editingTitle
                            }
                            autoFocus
                            onChange={(e) =>
                              setEditingTitle(
                                e.target.value
                              )
                            }
                            onKeyDown={(e) => {

                              if (
                                e.key ===
                                "Enter"
                              ) {
                                e.preventDefault();

                                saveRename(
                                  conversation.id
                                );
                              }

                              if (
                                e.key ===
                                "Escape"
                              ) {
                                setEditingId(
                                  null
                                );

                                setEditingTitle(
                                  ""
                                );
                              }

                            }}
                          />

                          <button
                            type="button"
                            className="edit-action-btn"
                            onClick={() =>
                              saveRename(
                                conversation.id
                              )
                            }
                            title="Save"
                          >
                            <Check size={15} />
                          </button>

                        </div>

                      ) : (

                        <>

                          {/* CONVERSATION SELECT */}

                          <button
                            type="button"
                            className="conversation-main"
                            onClick={() =>
                              handleConversationSelect(
                                conversation.id
                              )
                            }
                          >
                            <MessageSquare
                              size={17}
                            />

                            <span>
                              {
                                conversation.title ||
                                "New Conversation"
                              }
                            </span>

                          </button>

                          {/* CONVERSATION ACTIONS */}

                          <div className="conversation-actions">

                            <button
                              type="button"
                              className="conversation-action-btn"
                              onClick={() =>
                                startRename(
                                  conversation
                                )
                              }
                              title="Rename"
                            >
                              <Pencil size={15} />
                            </button>

                            <button
                              type="button"
                              className="conversation-action-btn delete"
                              onClick={() =>
                                deleteConversation(
                                  conversation.id
                                )
                              }
                              title="Delete"
                            >
                              <Trash2 size={15} />
                            </button>

                          </div>

                        </>

                      )}

                    </div>

                  )
                )

              )}

            </div>

            {/* USER AREA */}

            <div className="user-info">

              <div className="user-avatar">
                <User size={18} />
              </div>

              <div className="user-details">

                <div className="user-name">
                  {user.name}
                </div>

                <div className="user-email">
                  {user.email}
                </div>

              </div>

              <button
                type="button"
                className="logout-button"
                onClick={
                  handleLogout
                }
                title="Logout"
              >
                Logout
              </button>

            </div>

          </>
        )}

      </aside>

      {/* MAIN CHAT */}

      <main className="chat-container">

        <header className="chat-header">

          {!sidebarOpen && (
            <button
              type="button"
              className="icon-btn header-menu"
              onClick={() =>
                setSidebarOpen(true)
              }
              title="Open sidebar"
            >
              <Menu size={21} />
            </button>
          )}

          <div className="header-title">

            <Bot size={22} />

            <div>

              <h2>
                AI Assistant
              </h2>

              <span>
                Powered by Ollama
              </span>

            </div>

          </div>

        </header>

        {/* MESSAGES */}

        <div className="messages-container">

          {!activeConversationId &&
          messages.length === 0 ? (

            <div className="welcome-screen">

              <div className="welcome-icon">
                <Bot size={38} />
              </div>

              <h1>
                How can I help you?
              </h1>

              <p>
                Ask me anything and
                I'll do my best to
                help.
              </p>

              <button
                type="button"
                className="welcome-btn"
                onClick={
                  createConversation
                }
              >
                <Plus size={18} />

                Start a new conversation
              </button>

            </div>

          ) : (

            <div
              className="messages"
              style={{
                width: "100%",
                maxWidth: "100%",
                display: "block",
                boxSizing:
                  "border-box",
              }}
            >

              {/* PREVIOUS CONVERSATION LOADING */}

              {loadingConversationId ===
                activeConversationId && (
                <div className="chat-loading">

                  <div className="typing-indicator">

                    <span></span>
                    <span></span>
                    <span></span>

                  </div>

                  <span>
                    Loading conversation...
                  </span>

                </div>
              )}

              {/* CHAT MESSAGES */}

              {loadingConversationId !==
                activeConversationId &&
                messages.map(
                  (message, index) => {

                    const isAI =
                      message.role ===
                      "assistant";

                    return (
                      <div
                        key={
                          message.id ||
                          `${message.role}-${index}`
                        }
                        className={`message-row ${
                          isAI
                            ? "bot-row"
                            : "user-row"
                        }`}
                        style={{
                          width: "100%",
                          maxWidth: "100%",
                          display: "flex",
                          flexDirection:
                            "row",
                          justifyContent:
                            isAI
                              ? "flex-start"
                              : "flex-end",
                          alignItems:
                            "flex-start",
                          gap: "12px",
                          marginBottom:
                            "28px",
                          marginLeft: "0",
                          marginRight: "0",
                          boxSizing:
                            "border-box",
                        }}
                      >

                        {/* AI AVATAR */}

                        {isAI && (
                          <div
                            className="message-avatar bot-avatar"
                            style={{
                              flexShrink: 0,
                            }}
                          >
                            <Bot size={18} />
                          </div>
                        )}

                        {/* MESSAGE CONTENT */}

                        <div
                          className="message-content"
                          style={{
                            width: "auto",
                            maxWidth:
                              isAI
                                ? "75%"
                                : "70%",
                            display:
                              "flex",
                            flexDirection:
                              "column",
                            alignItems:
                              isAI
                                ? "flex-start"
                                : "flex-end",
                            textAlign:
                              isAI
                                ? "left"
                                : "right",
                            flexShrink: 1,
                          }}
                        >

                          <div
                            className="message-name"
                            style={{
                              textAlign:
                                isAI
                                  ? "left"
                                  : "right",
                              width:
                                "100%",
                            }}
                          >
                            {isAI
                              ? "AI Assistant"
                              : "You"}
                          </div>

                          {/* AI MESSAGE */}

                          {isAI ? (

                            <div
                              className="bot-message"
                              style={{
                                textAlign:
                                  "left",
                              }}
                            >
                              <ReactMarkdown
                                remarkPlugins={[
                                  remarkGfm,
                                ]}
                              >
                                {
                                  message.content ||
                                  ""
                                }
                              </ReactMarkdown>
                            </div>

                          ) : (

                            /* USER MESSAGE */

                            <div
                              className="user-message"
                              style={{
                                textAlign:
                                  "left",
                              }}
                            >
                              {
                                message.content ||
                                ""
                              }
                            </div>

                          )}

                          {/* TIMESTAMP */}

                          {message.created_at && (
                            <div
                              className="message-time"
                              style={{
                                display:
                                  "block",
                                marginTop:
                                  "6px",
                                fontSize:
                                  "11px",
                                lineHeight:
                                  "14px",
                                color:
                                  "#8a8f98",
                                textAlign:
                                  isAI
                                    ? "left"
                                    : "right",
                                width:
                                  "100%",
                              }}
                            >
                              {formatMessageTime(
                                message.created_at
                              )}
                            </div>
                          )}

                          {/* COPY BUTTON */}

                          {isAI && (
                            <button
                              type="button"
                              className="copy-btn"
                              onClick={() =>
                                copyMessage(
                                  message.content ||
                                    "",
                                  index
                                )
                              }
                              title={
                                copiedIndex ===
                                index
                                  ? "Copied"
                                  : "Copy message"
                              }
                            >
                              {copiedIndex ===
                              index ? (
                                <>
                                  <Check size={14} />

                                  <span>
                                    Copied
                                  </span>
                                </>
                              ) : (
                                <>
                                  <Copy size={14} />

                                  <span>
                                    Copy
                                  </span>
                                </>
                              )}
                            </button>
                          )}

                        </div>

                        {/* USER AVATAR */}

                        {!isAI && (
                          <div
                            className="message-avatar user-message-avatar"
                            style={{
                              flexShrink: 0,
                            }}
                          >
                            <User size={18} />
                          </div>
                        )}

                      </div>
                    );
                  }
                )}

              {/* AI TYPING INDICATOR */}

              {typingConversationId !== null &&
                typingConversationId ===
                  activeConversationId && (
                  <div
                    className="message-row bot-row"
                    style={{
                      width: "100%",
                      display: "flex",
                      flexDirection:
                        "row",
                      justifyContent:
                        "flex-start",
                      alignItems:
                        "flex-start",
                      gap: "12px",
                      marginBottom:
                        "28px",
                      boxSizing:
                        "border-box",
                    }}
                  >

                    <div
                      className="message-avatar bot-avatar"
                      style={{
                        flexShrink: 0,
                      }}
                    >
                      <Bot size={18} />
                    </div>

                    <div
                      className="message-content"
                      style={{
                        maxWidth: "75%",
                        display:
                          "flex",
                        flexDirection:
                          "column",
                        alignItems:
                          "flex-start",
                        textAlign:
                          "left",
                      }}
                    >

                      <div className="message-name">
                        AI Assistant
                      </div>

                      <div className="bot-message">

                        <div className="typing-indicator">
                          <span></span>
                          <span></span>
                          <span></span>
                        </div>

                      </div>

                    </div>

                  </div>
                )}

              <div ref={messagesEndRef} />

            </div>
          )}

        </div>

        {/* INPUT */}

        <div className="input-area">

          {/* CHAT INPUT - KEEP THIS CLASS */}
          <div className="input-wrapper">

            <textarea
              value={input}
              onChange={(e) =>
                setInput(
                  e.target.value
                )
              }
              onKeyDown={
                handleKeyDown
              }
              placeholder="Message AI Assistant..."
              rows="1"
              disabled={loading}
            />

            <button
              type="button"
              className="send-btn"
              onClick={
                sendMessage
              }
              disabled={
                loading ||
                !input.trim()
              }
              title="Send message"
            >
              <Send size={19} />
            </button>

          </div>

          <p className="input-note">
            AI can make mistakes.
            Check important
            information.
          </p>

        </div>

      </main>

    </div>
  );
}

export default App;