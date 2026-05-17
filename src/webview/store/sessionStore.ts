import type { Message, Part, Permission, Session, SessionStatus } from '@opencode-ai/sdk';
import { create } from 'zustand';

interface SessionStore {
  sessions: Session[];
  activeSessionID: string | null;
  messages: Record<string, Message[]>;
  parts: Record<string, Part[]>;
  sessionStatus: Record<string, SessionStatus>;
  pendingPermission: Permission | null;

  setActiveSession: (id: string) => void;
  setSessions: (sessions: Session[]) => void;
  addSession: (session: Session) => void;
  removeSession: (id: string) => void;
  updateSession: (session: Session) => void;
  addMessage: (sessionID: string, message: Message) => void;
  updateMessage: (message: Message) => void;
  addPart: (messageID: string, part: Part) => void;
  updatePart: (part: Part) => void;
  setSessionStatus: (sessionID: string, status: SessionStatus) => void;
  setPendingPermission: (permission: Permission | null) => void;
}

export const useSessionStore = create<SessionStore>((set) => ({
  sessions: [],
  activeSessionID: null,
  messages: {},
  parts: {},
  sessionStatus: {},
  pendingPermission: null,

  setActiveSession: (id) => set({ activeSessionID: id }),

  setSessions: (sessions) => set({ sessions }),

  addSession: (session) =>
    set((state) => {
      if (state.sessions.some((s) => s.id === session.id)) {
        return {};
      }
      return {
        sessions: [...state.sessions, session],
      };
    }),

  removeSession: (id) =>
    set((state) => ({
      sessions: state.sessions.filter((s) => s.id !== id),
      activeSessionID: state.activeSessionID === id ? null : state.activeSessionID,
    })),

  updateSession: (session) =>
    set((state) => ({
      sessions: state.sessions.map((s) => (s.id === session.id ? session : s)),
    })),

  addMessage: (sessionID, message) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [sessionID]: [...(state.messages[sessionID] || []), message],
      },
    })),

  updateMessage: (message) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [message.sessionID]: (state.messages[message.sessionID] || []).map((m) =>
          m.id === message.id ? message : m,
        ),
      },
    })),

  addPart: (messageID, part) =>
    set((state) => ({
      parts: {
        ...state.parts,
        [messageID]: [...(state.parts[messageID] || []), part],
      },
    })),

  updatePart: (part) =>
    set((state) => ({
      parts: {
        ...state.parts,
        [part.messageID]: (state.parts[part.messageID] || []).map((p) =>
          p.id === part.id ? part : p,
        ),
      },
    })),

  setSessionStatus: (sessionID, status) =>
    set((state) => ({
      sessionStatus: { ...state.sessionStatus, [sessionID]: status },
    })),

  setPendingPermission: (permission) => set({ pendingPermission: permission }),
}));
