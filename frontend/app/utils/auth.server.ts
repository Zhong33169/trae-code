import { createCookieSessionStorage, redirect } from "@remix-run/node";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env") });

const BACKEND_PORT = process.env.BACKEND_PORT || '8004';
export const API_BASE_URL = `http://localhost:${BACKEND_PORT}`;

const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: "supervision_session",
    secrets: ["supervision-record-secret-key-2024"],
    sameSite: "lax",
    path: "/",
    httpOnly: true,
    maxAge: 60 * 60 * 24,
  },
});

export const { getSession, commitSession, destroySession } = sessionStorage;

export const getAuthToken = (request: Request) => {
  const authHeader = request.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }
  return null;
};

export const requireAuth = async (request: Request) => {
  const session = await getSession(request.headers.get("Cookie"));
  const token = session.get("token");
  
  if (!token) {
    throw redirect("/login");
  }
  
  const user = await getCurrentUser(token);
  if (!user) {
    throw redirect("/login");
  }
  
  return { token, user };
};

export const getCurrentUser = async (token: string) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/profile`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    
    if (response.ok) {
      const data = await response.json();
      return data.data;
    }
    return null;
  } catch {
    return null;
  }
};

export const logout = async (request: Request) => {
  const session = await getSession(request.headers.get("Cookie"));
  const token = session.get("token");
  
  if (token) {
    try {
      await fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    } catch {}
  }
  
  return redirect("/login", {
    headers: {
      "Set-Cookie": await destroySession(session),
    },
  });
};
