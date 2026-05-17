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
  updatePartDelta: (messageID: string, partID: string, field: string, delta: string) => void;
  setSessionStatus: (sessionID: string, status: SessionStatus) => void;
  setPendingPermission: (permission: Permission | null) => void;
  setSessionMessagesAndParts: (sessionID: string, messages: Message[], parts: Part[]) => void;
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
    set((state) => {
      const currentMessages = state.messages[sessionID] || [];
      const exists = currentMessages.some((m) => m.id === message.id);
      const newMessages = exists
        ? currentMessages.map((m) => (m.id === message.id ? message : m))
        : [...currentMessages, message];
      return {
        messages: {
          ...state.messages,
          [sessionID]: newMessages,
        },
      };
    }),

  updateMessage: (message) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [message.sessionID]: (state.messages[message.sessionID] || []).map((m) =>
          m.id === message.id ? message : m,
        ),
      },
    })),

  setSessionMessagesAndParts: (sessionID, messages, parts) =>
    set((state) => {
      const partsMap: Record<string, Part[]> = { ...state.parts };
      for (const m of messages) {
        partsMap[m.id] = [];
      }
      for (const p of parts) {
        if (!partsMap[p.messageID]) {
          partsMap[p.messageID] = [];
        }
        partsMap[p.messageID].push(p);
      }
      return {
        messages: {
          ...state.messages,
          [sessionID]: messages,
        },
        parts: partsMap,
      };
    }),

  addPart: (messageID, part) =>
    set((state) => ({
      parts: {
        ...state.parts,
        [messageID]: [...(state.parts[messageID] || []), part],
      },
    })),

  updatePart: (part) =>
    set((state) => {
      const messageID = part.messageID;
      const currentParts = state.parts[messageID] || [];
      const exists = currentParts.some((p) => p.id === part.id);
      const newParts = exists
        ? currentParts.map((p) => (p.id === part.id ? part : p))
        : [...currentParts, part];
      return {
        parts: {
          ...state.parts,
          [messageID]: newParts,
        },
      };
    }),

  updatePartDelta: (messageID, partID, field, delta) =>
    set((state) => {
      const currentParts = state.parts[messageID] || [];
      const exists = currentParts.some((p) => p.id === partID);

      let newParts: Part[];
      if (exists) {
        newParts = currentParts.map((p) => {
          if (p.id === partID) {
            const record = p as Record<string, unknown>;
            const existingValue = record[field] as string | undefined;
            return {
              ...p,
              [field]: (existingValue || '') + delta,
            };
          }
          return p;
        });
      } else {
        // If part delta arrives before part is created, initialize the part skeleton
        const newPart = {
          id: partID,
          messageID,
          type: 'text', // Fallback to 'text' type default
          [field]: delta,
        };
        newParts = [...currentParts, newPart as unknown as Part];
      }

      return {
        parts: {
          ...state.parts,
          [messageID]: newParts,
        },
      };
    }),

  setSessionStatus: (sessionID, status) =>
    set((state) => ({
      sessionStatus: { ...state.sessionStatus, [sessionID]: status },
    })),

  setPendingPermission: (permission) => set({ pendingPermission: permission }),
}));
