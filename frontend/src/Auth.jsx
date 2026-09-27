import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Bot, Mail, Lock, User, LogIn, UserPlus } from "lucide-react";
import "./Auth.css";

const API_URL = "http://127.0.0.1:8000";

function Auth({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const endpoint = isLogin ? "/login" : "/register";

      const body = isLogin
        ? {
            email,
            password,
          }
        : {
            name,
            email,
            password,
          };

      const response = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Something went wrong");
      }

      if (isLogin) {
        localStorage.setItem(
          "chatbot_user",
          JSON.stringify(data.user)
        );

        onLogin(data.user);
      } else {
        setSuccess("Registration successful. Please login.");

        setIsLogin(true);
        setName("");
        setPassword("");
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">

        {/* LOGO / HEADER */}
        <div className="auth-logo">
          <div className="auth-logo-icon">
            <Bot size={30} />
          </div>

          <h1>AI Chatbot</h1>

          <p>
            Your intelligent conversational assistant
          </p>
        </div>

        {/* LOGIN / REGISTER TABS */}
        <div className="auth-tabs">

          <button
            type="button"
            className={isLogin ? "active" : ""}
            onClick={() => {
              setIsLogin(true);
              setError("");
              setSuccess("");
            }}
          >
            Login
          </button>

          <button
            type="button"
            className={!isLogin ? "active" : ""}
            onClick={() => {
              setIsLogin(false);
              setError("");
              setSuccess("");
            }}
          >
            Register
          </button>

        </div>

        {/* FORM */}
        <form onSubmit={handleSubmit}>

          {/* FULL NAME */}
          {!isLogin && (
            <div className="input-group">

              <label>Full Name</label>

              <div className="auth-input-wrapper">

                <User
                  size={20}
                  className="input-icon"
                />

                <input
                  type="text"
                  placeholder="Enter your name"
                  value={name}
                  onChange={(e) =>
                    setName(e.target.value)
                  }
                  required
                />

              </div>

            </div>
          )}

          {/* EMAIL */}
          <div className="input-group">

            <label>Email</label>

            <div className="auth-input-wrapper">

              <Mail
                size={20}
                className="input-icon"
              />

              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) =>
                  setEmail(e.target.value)
                }
                required
              />

            </div>

          </div>

          {/* PASSWORD */}
          <div className="input-group">

            <label>Password</label>

            <div className="auth-input-wrapper">

              <Lock
                size={20}
                className="input-icon"
              />

              <input
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(e) =>
                  setPassword(e.target.value)
                }
                required
              />

              <button
                type="button"
                className="password-toggle"
                onClick={() =>
                  setShowPassword(!showPassword)
                }
                aria-label={
                  showPassword
                    ? "Hide password"
                    : "Show password"
                }
              >
                {showPassword ? (
                  <EyeOff size={20} />
                ) : (
                  <Eye size={20} />
                )}
              </button>

            </div>

          </div>

          {/* ERROR MESSAGE */}
          {error && (
            <div className="auth-error">
              {error}
            </div>
          )}

          {/* SUCCESS MESSAGE */}
          {success && (
            <div className="auth-success">
              {success}
            </div>
          )}

          {/* SUBMIT BUTTON */}
          <button
            type="submit"
            className="auth-submit"
            disabled={loading}
          >
            {loading ? (
              "Please wait..."
            ) : isLogin ? (
              <>
                <LogIn size={18} />
                Login
              </>
            ) : (
              <>
                <UserPlus size={18} />
                Create Account
              </>
            )}
          </button>

        </form>

        {/* FOOTER */}
        <p className="auth-footer">

          {isLogin
            ? "Don't have an account?"
            : "Already have an account?"}

          <button
            type="button"
            onClick={() => {
              setIsLogin(!isLogin);
              setError("");
              setSuccess("");
            }}
          >
            {isLogin ? " Register" : " Login"}
          </button>

        </p>

      </div>
    </div>
  );
}

export default Auth;