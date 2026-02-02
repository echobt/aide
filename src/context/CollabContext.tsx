import { createContext, useContext, ParentProps, createEffect, onCleanup, onMount } from "solid-js";
import { createStore, produce } from "solid-js/store";
import { createLogger } from "../utils/logger";

const collabLogger = createLogger("Collab");

// ============================================================================
// Types
// ============================================================================

export type CollabPermission = "owner" | "editor" | "viewer";

export interface CollabUser {
  id: string;
  name: string;
  avatar?: string;
  color: string;
  cursor?: CursorPosition;
  selection?: SelectionRange;
  isFollowing?: string; // User ID being followed
  permission: CollabPermission;
  isAudioEnabled?: boolean;
  isVideoEnabled?: boolean;
  isSpeaking?: boolean;
}

export interface CursorPosition {
  fileId: string;
  line: number;
  column: number;
  timestamp: number;
}

export interface SelectionRange {
  fileId: string;
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
  timestamp: number;
}

export interface CollabRoom {
  id: string;
  name: string;
  hostId: string;
  createdAt: number;
  participants: CollabUser[];
  sharedFiles: string[]; // File paths being shared
  defaultPermission: CollabPermission;
  sharedTerminals: SharedTerminal[];
  chatMessages: CollabChatMessage[];
}

export interface SharedTerminal {
  id: string;
  terminalId: string;
  name: string;
  ownerId: string;
  allowedUsers: string[]; // User IDs allowed to interact, empty = all
  isReadOnly: boolean;
  createdAt: number;
}

export interface CollabChatMessage {
  id: string;
  userId: string;
  userName: string;
  userColor: string;
  content: string;
  timestamp: number;
  isSystem?: boolean;
  replyToId?: string;
}

export interface CollabInviteLink {
  id: string;
  roomId: string;
  permission: CollabPermission;
  expiresAt?: number;
  maxUses?: number;
  usedCount: number;
  createdAt: number;
}

export type CollabConnectionState = 
  | "disconnected" 
  | "connecting" 
  | "connected" 
  | "reconnecting"
  | "error";

interface CollabState {
  connectionState: CollabConnectionState;
  currentUser: CollabUser | null;
  currentRoom: CollabRoom | null;
  participants: CollabUser[];
  pendingOperations: CollabOperation[];
  followingUser: string | null;
  error: string | null;
  inviteLinks: CollabInviteLink[];
  sharedTerminals: SharedTerminal[];
  chatMessages: CollabChatMessage[];
  unreadChatCount: number;
  isAudioCallActive: boolean;
  isVideoCallActive: boolean;
}

export type CollabOperationType = 
  | "insert" 
  | "delete" 
  | "cursor_move" 
  | "selection_change"
  | "file_open"
  | "file_close";

export interface CollabOperation {
  id: string;
  type: CollabOperationType;
  userId: string;
  fileId: string;
  timestamp: number;
  data: Record<string, unknown>;
}

// WebSocket message types
type WSMessageType = 
  | "join_room"
  | "leave_room"
  | "room_state"
  | "user_joined"
  | "user_left"
  | "cursor_update"
  | "selection_update"
  | "text_operation"
  | "follow_user"
  | "unfollow_user"
  | "ping"
  | "pong"
  | "error"
  // Permission management
  | "update_permission"
  | "permission_updated"
  // Invite links
  | "create_invite"
  | "invite_created"
  | "revoke_invite"
  // Shared terminals
  | "share_terminal"
  | "terminal_shared"
  | "unshare_terminal"
  | "terminal_unshared"
  | "terminal_input"
  | "terminal_output"
  // Chat
  | "chat_message"
  | "chat_received"
  // Audio/Video
  | "audio_toggle"
  | "video_toggle"
  | "call_start"
  | "call_end"
  | "user_media_state";

interface WSMessage {
  type: WSMessageType;
  payload: Record<string, unknown>;
  timestamp: number;
}

// User colors for remote cursors - vibrant and distinguishable
const USER_COLORS = [
  "#f97316", // orange
  "#22c55e", // green
  "#3b82f6", // blue
  "#a855f7", // purple
  "#ec4899", // pink
  "#14b8a6", // teal
  "#f59e0b", // amber
  "#ef4444", // red
  "#06b6d4", // cyan
  "#8b5cf6", // violet
];

// ============================================================================
// Context Value Interface
// ============================================================================

interface CollabContextValue {
  state: CollabState;
  
  // Connection management
  connect: (serverUrl: string) => Promise<void>;
  disconnect: () => void;
  
  // Room management
  createRoom: (name: string, defaultPermission?: CollabPermission) => Promise<string>;
  joinRoom: (roomId: string, userName: string) => Promise<void>;
  joinRoomWithLink: (inviteLinkId: string, userName: string) => Promise<void>;
  leaveRoom: () => void;
  
  // Cursor & Selection
  updateCursor: (position: Omit<CursorPosition, "timestamp">) => void;
  updateSelection: (selection: Omit<SelectionRange, "timestamp">) => void;
  
  // Text operations (CRDT-based)
  applyTextOperation: (operation: Omit<CollabOperation, "id" | "userId" | "timestamp">) => void;
  
  // Follow mode
  followUser: (userId: string) => void;
  unfollowUser: () => void;
  
  // Permission management
  updateUserPermission: (userId: string, permission: CollabPermission) => void;
  canEdit: () => boolean;
  
  // Invite link management
  createInviteLink: (permission: CollabPermission, options?: { expiresIn?: number; maxUses?: number }) => Promise<string>;
  revokeInviteLink: (linkId: string) => void;
  
  // Shared terminals
  shareTerminal: (terminalId: string, name: string, isReadOnly?: boolean) => Promise<string>;
  unshareTerminal: (sharedTerminalId: string) => void;
  sendTerminalInput: (sharedTerminalId: string, data: string) => void;
  
  // Chat
  sendChatMessage: (content: string, replyToId?: string) => void;
  markChatAsRead: () => void;
  
  // Audio/Video calls (placeholder APIs)
  startAudioCall: () => Promise<void>;
  stopAudioCall: () => void;
  toggleAudio: () => void;
  startVideoCall: () => Promise<void>;
  stopVideoCall: () => void;
  toggleVideo: () => void;
  
  // Helpers
  getParticipant: (userId: string) => CollabUser | undefined;
  isHost: () => boolean;
  generateShareLink: (permission?: CollabPermission) => string;
  parseShareLink: (link: string) => { roomId?: string; inviteLinkId?: string } | null;
}

// ============================================================================
// Context
// ============================================================================

const CollabContext = createContext<CollabContextValue>();

// ============================================================================
// Provider
// ============================================================================

export function CollabProvider(props: ParentProps) {
  const [state, setState] = createStore<CollabState>({
    connectionState: "disconnected",
    currentUser: null,
    currentRoom: null,
    participants: [],
    pendingOperations: [],
    followingUser: null,
    error: null,
    inviteLinks: [],
    sharedTerminals: [],
    chatMessages: [],
    unreadChatCount: 0,
    isAudioCallActive: false,
    isVideoCallActive: false,
  });

  let ws: WebSocket | null = null;
  let reconnectTimer: number | null = null;
  let pingInterval: number | null = null;
  let serverUrl: string = "";

  // Generate unique ID
  const generateId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

  // Get a color for a user based on their position in the room
  const getColorForUser = (userIndex: number): string => {
    return USER_COLORS[userIndex % USER_COLORS.length];
  };

  // ============================================================================
  // WebSocket Management
  // ============================================================================

  const connect = async (url: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (ws?.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      serverUrl = url;
      setState("connectionState", "connecting");
      setState("error", null);

      try {
        ws = new WebSocket(url);

        ws.onopen = () => {
          setState("connectionState", "connected");
          startPingInterval();
          resolve();
        };

        ws.onclose = (event) => {
          setState("connectionState", "disconnected");
          stopPingInterval();
          
          // Auto-reconnect if was previously connected and not a clean close
          if (!event.wasClean && state.currentRoom) {
            scheduleReconnect();
          }
        };

        ws.onerror = () => {
          setState("connectionState", "error");
          setState("error", "WebSocket connection failed");
          reject(new Error("WebSocket connection failed"));
        };

        ws.onmessage = (event) => {
          handleMessage(event.data);
        };
      } catch (err) {
        setState("connectionState", "error");
        setState("error", err instanceof Error ? err.message : "Connection failed");
        reject(err);
      }
    });
  };

  const disconnect = () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    stopPingInterval();
    
    if (ws) {
      ws.close(1000, "User disconnected");
      ws = null;
    }
    
    setState(produce((s) => {
      s.connectionState = "disconnected";
      s.currentRoom = null;
      s.participants = [];
      s.currentUser = null;
      s.followingUser = null;
    }));
  };

  const scheduleReconnect = () => {
    setState("connectionState", "reconnecting");
    reconnectTimer = window.setTimeout(async () => {
      try {
        await connect(serverUrl);
        // Rejoin room if we were in one
        if (state.currentRoom && state.currentUser) {
          await joinRoom(state.currentRoom.id, state.currentUser.name);
        }
      } catch {
        scheduleReconnect();
      }
    }, 3000);
  };

  const startPingInterval = () => {
    pingInterval = window.setInterval(() => {
      sendMessage({ type: "ping", payload: {}, timestamp: Date.now() });
    }, 30000);
  };

  const stopPingInterval = () => {
    if (pingInterval) {
      clearInterval(pingInterval);
      pingInterval = null;
    }
  };

  // ============================================================================
  // Message Handling
  // ============================================================================

  const sendMessage = (message: WSMessage) => {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  };

  const handleMessage = (data: string) => {
    try {
      const message: WSMessage = JSON.parse(data);
      
      switch (message.type) {
        case "room_state":
          handleRoomState(message.payload);
          break;
        case "user_joined":
          handleUserJoined(message.payload);
          break;
        case "user_left":
          handleUserLeft(message.payload);
          break;
        case "cursor_update":
          handleCursorUpdate(message.payload);
          break;
        case "selection_update":
          handleSelectionUpdate(message.payload);
          break;
        case "text_operation":
          handleTextOperation(message.payload);
          break;
        case "follow_user":
          handleFollowUser(message.payload);
          break;
        case "permission_updated":
          handlePermissionUpdated(message.payload);
          break;
        case "invite_created":
          handleInviteCreated(message.payload);
          break;
        case "terminal_shared":
          handleTerminalShared(message.payload);
          break;
        case "terminal_unshared":
          handleTerminalUnshared(message.payload);
          break;
        case "terminal_output":
          handleTerminalOutput(message.payload);
          break;
        case "chat_received":
          handleChatReceived(message.payload);
          break;
        case "user_media_state":
          handleUserMediaState(message.payload);
          break;
        case "call_start":
          handleCallStart(message.payload);
          break;
        case "call_end":
          handleCallEnd(message.payload);
          break;
        case "pong":
          // Connection is alive
          break;
        case "error":
          setState("error", message.payload.message as string);
          break;
      }
    } catch (err) {
      console.error("Failed to parse WebSocket message:", err);
    }
  };

  const handleRoomState = (payload: Record<string, unknown>) => {
    const room = payload.room as CollabRoom;
    const participants = payload.participants as CollabUser[];
    
    setState(produce((s) => {
      s.currentRoom = room;
      s.participants = participants;
    }));
  };

  const handleUserJoined = (payload: Record<string, unknown>) => {
    const user = payload.user as CollabUser;
    
    // Assign a color based on current participant count
    const coloredUser = {
      ...user,
      color: getColorForUser(state.participants.length),
    };
    
    setState("participants", (participants) => [...participants, coloredUser]);
  };

  const handleUserLeft = (payload: Record<string, unknown>) => {
    const userId = payload.userId as string;
    
    setState("participants", (participants) => 
      participants.filter((p) => p.id !== userId)
    );
    
    // Stop following if the followed user left
    if (state.followingUser === userId) {
      setState("followingUser", null);
    }
  };

  const handleCursorUpdate = (payload: Record<string, unknown>) => {
    const userId = payload.userId as string;
    const cursor = payload.cursor as CursorPosition;
    
    setState("participants", (p) => p.id === userId, "cursor", cursor);
  };

  const handleSelectionUpdate = (payload: Record<string, unknown>) => {
    const userId = payload.userId as string;
    const selection = payload.selection as SelectionRange;
    
    setState("participants", (p) => p.id === userId, "selection", selection);
  };

  const handleTextOperation = (payload: Record<string, unknown>) => {
    const operation = payload.operation as CollabOperation;
    
    // Add to pending operations for the editor to apply
    setState("pendingOperations", (ops) => [...ops, operation]);
  };

  const handleFollowUser = (payload: Record<string, unknown>) => {
    const followerId = payload.followerId as string;
    const targetId = payload.targetId as string;
    
    setState("participants", (p) => p.id === followerId, "isFollowing", targetId);
  };

  const handlePermissionUpdated = (payload: Record<string, unknown>) => {
    const userId = payload.userId as string;
    const permission = payload.permission as CollabPermission;
    
    setState("participants", (p) => p.id === userId, "permission", permission);
    
    // Update current user if it's them
    if (state.currentUser?.id === userId) {
      setState("currentUser", "permission", permission);
    }
  };

  const handleInviteCreated = (payload: Record<string, unknown>) => {
    const link = payload.link as CollabInviteLink;
    setState("inviteLinks", (links) => [...links, link]);
  };

  const handleTerminalShared = (payload: Record<string, unknown>) => {
    const terminal = payload.terminal as SharedTerminal;
    setState("sharedTerminals", (terminals) => {
      // Don't add duplicates
      if (terminals.some(t => t.id === terminal.id)) return terminals;
      return [...terminals, terminal];
    });
  };

  const handleTerminalUnshared = (payload: Record<string, unknown>) => {
    const terminalId = payload.terminalId as string;
    setState("sharedTerminals", (terminals) => 
      terminals.filter((t) => t.id !== terminalId)
    );
  };

  const handleTerminalOutput = (payload: Record<string, unknown>) => {
    // Terminal output from shared terminal - emit event for terminal component
    const terminalId = payload.terminalId as string;
    const data = payload.data as string;
    const userId = payload.userId as string;
    
    // Dispatch custom event for terminal components to handle
    window.dispatchEvent(new CustomEvent("collab:terminal_output", {
      detail: { terminalId, data, userId }
    }));
  };

  const handleChatReceived = (payload: Record<string, unknown>) => {
    const message = payload.message as CollabChatMessage;
    
    // Don't add our own messages (already added locally)
    if (message.userId === state.currentUser?.id) return;
    
    setState("chatMessages", (messages) => [...messages, message]);
    setState("unreadChatCount", (count) => count + 1);
  };

  const handleUserMediaState = (payload: Record<string, unknown>) => {
    const userId = payload.userId as string;
    const isAudioEnabled = payload.isAudioEnabled as boolean | undefined;
    const isVideoEnabled = payload.isVideoEnabled as boolean | undefined;
    const isSpeaking = payload.isSpeaking as boolean | undefined;
    
    setState(produce((s) => {
      const participant = s.participants.find((p) => p.id === userId);
      if (participant) {
        if (isAudioEnabled !== undefined) participant.isAudioEnabled = isAudioEnabled;
        if (isVideoEnabled !== undefined) participant.isVideoEnabled = isVideoEnabled;
        if (isSpeaking !== undefined) participant.isSpeaking = isSpeaking;
      }
    }));
  };

  const handleCallStart = (payload: Record<string, unknown>) => {
    const type = payload.type as "audio" | "video";
    const userId = payload.userId as string;
    
    if (type === "audio") {
      setState("isAudioCallActive", true);
    } else {
      setState("isVideoCallActive", true);
    }
    
    // Add system message to chat
    const participant = state.participants.find(p => p.id === userId);
    if (participant) {
      const systemMessage: CollabChatMessage = {
        id: generateId(),
        userId: "system",
        userName: "System",
        userColor: "#6366f1",
        content: `${participant.name} started a ${type} call`,
        timestamp: Date.now(),
        isSystem: true,
      };
      setState("chatMessages", (messages) => [...messages, systemMessage]);
    }
  };

  const handleCallEnd = (payload: Record<string, unknown>) => {
    const type = payload.type as "audio" | "video";
    const userId = payload.userId as string;
    
    if (type === "audio") {
      setState("isAudioCallActive", false);
    } else {
      setState("isVideoCallActive", false);
    }
    
    // Add system message to chat
    const participant = state.participants.find(p => p.id === userId);
    if (participant) {
      const systemMessage: CollabChatMessage = {
        id: generateId(),
        userId: "system",
        userName: "System",
        userColor: "#6366f1",
        content: `${participant.name} ended the ${type} call`,
        timestamp: Date.now(),
        isSystem: true,
      };
      setState("chatMessages", (messages) => [...messages, systemMessage]);
    }
  };

  // ============================================================================
  // Room Management
  // ============================================================================

  const createRoom = async (name: string, defaultPermission: CollabPermission = "editor"): Promise<string> => {
    const roomId = generateId();
    const userId = generateId();
    
    const user: CollabUser = {
      id: userId,
      name: name,
      color: getColorForUser(0),
      permission: "owner",
    };
    
    const room: CollabRoom = {
      id: roomId,
      name: `${name}'s Room`,
      hostId: userId,
      createdAt: Date.now(),
      participants: [user],
      sharedFiles: [],
      defaultPermission,
      sharedTerminals: [],
      chatMessages: [],
    };
    
    setState(produce((s) => {
      s.currentUser = user;
      s.currentRoom = room;
      s.participants = [user];
      s.chatMessages = [];
      s.sharedTerminals = [];
      s.inviteLinks = [];
    }));
    
    sendMessage({
      type: "join_room",
      payload: { room, user },
      timestamp: Date.now(),
    });
    
    return roomId;
  };

  const joinRoom = async (roomId: string, userName: string): Promise<void> => {
    const userId = generateId();
    
    const user: CollabUser = {
      id: userId,
      name: userName,
      color: getColorForUser(0), // Will be reassigned by server
      permission: "editor", // Default, will be updated by server
    };
    
    setState("currentUser", user);
    
    sendMessage({
      type: "join_room",
      payload: { roomId, user },
      timestamp: Date.now(),
    });
  };

  const joinRoomWithLink = async (inviteLinkId: string, userName: string): Promise<void> => {
    const userId = generateId();
    
    const user: CollabUser = {
      id: userId,
      name: userName,
      color: getColorForUser(0), // Will be reassigned by server
      permission: "viewer", // Will be updated by server based on invite link
    };
    
    setState("currentUser", user);
    
    sendMessage({
      type: "join_room",
      payload: { inviteLinkId, user },
      timestamp: Date.now(),
    });
  };

  const leaveRoom = () => {
    if (state.currentRoom && state.currentUser) {
      sendMessage({
        type: "leave_room",
        payload: { 
          roomId: state.currentRoom.id, 
          userId: state.currentUser.id 
        },
        timestamp: Date.now(),
      });
    }
    
    setState(produce((s) => {
      s.currentRoom = null;
      s.participants = [];
      s.currentUser = null;
      s.followingUser = null;
    }));
  };

  // ============================================================================
  // Cursor & Selection
  // ============================================================================

  const updateCursor = (position: Omit<CursorPosition, "timestamp">) => {
    if (!state.currentUser || !state.currentRoom) return;
    
    const cursor: CursorPosition = {
      ...position,
      timestamp: Date.now(),
    };
    
    setState("currentUser", "cursor", cursor);
    
    sendMessage({
      type: "cursor_update",
      payload: {
        userId: state.currentUser.id,
        cursor,
      },
      timestamp: Date.now(),
    });
  };

  const updateSelection = (selection: Omit<SelectionRange, "timestamp">) => {
    if (!state.currentUser || !state.currentRoom) return;
    
    const fullSelection: SelectionRange = {
      ...selection,
      timestamp: Date.now(),
    };
    
    setState("currentUser", "selection", fullSelection);
    
    sendMessage({
      type: "selection_update",
      payload: {
        userId: state.currentUser.id,
        selection: fullSelection,
      },
      timestamp: Date.now(),
    });
  };

  // ============================================================================
  // Text Operations
  // ============================================================================

  const applyTextOperation = (operation: Omit<CollabOperation, "id" | "userId" | "timestamp">) => {
    if (!state.currentUser || !state.currentRoom) return;
    
    const fullOperation: CollabOperation = {
      ...operation,
      id: generateId(),
      userId: state.currentUser.id,
      timestamp: Date.now(),
    };
    
    sendMessage({
      type: "text_operation",
      payload: { operation: fullOperation },
      timestamp: Date.now(),
    });
  };

  // ============================================================================
  // Follow Mode
  // ============================================================================

  const followUser = (userId: string) => {
    if (!state.currentUser || !state.currentRoom) return;
    
    setState("followingUser", userId);
    
    sendMessage({
      type: "follow_user",
      payload: {
        followerId: state.currentUser.id,
        targetId: userId,
      },
      timestamp: Date.now(),
    });
  };

  const unfollowUser = () => {
    if (!state.currentUser) return;
    
    sendMessage({
      type: "unfollow_user",
      payload: {
        followerId: state.currentUser.id,
      },
      timestamp: Date.now(),
    });
    
    setState("followingUser", null);
  };

  // ============================================================================
  // Permission Management
  // ============================================================================

  const updateUserPermission = (userId: string, permission: CollabPermission) => {
    if (!state.currentUser || !state.currentRoom) return;
    if (!isHost() && state.currentUser.permission !== "owner") return;
    
    sendMessage({
      type: "update_permission",
      payload: { userId, permission },
      timestamp: Date.now(),
    });
    
    setState("participants", (p) => p.id === userId, "permission", permission);
  };

  const canEdit = (): boolean => {
    if (!state.currentUser) return false;
    return state.currentUser.permission === "owner" || state.currentUser.permission === "editor";
  };

  // ============================================================================
  // Invite Link Management
  // ============================================================================

  const createInviteLink = async (
    permission: CollabPermission, 
    options?: { expiresIn?: number; maxUses?: number }
  ): Promise<string> => {
    if (!state.currentRoom) throw new Error("Not in a room");
    if (!isHost() && state.currentUser?.permission !== "owner") {
      throw new Error("Only the host can create invite links");
    }
    
    const linkId = generateId();
    const link: CollabInviteLink = {
      id: linkId,
      roomId: state.currentRoom.id,
      permission,
      expiresAt: options?.expiresIn ? Date.now() + options.expiresIn : undefined,
      maxUses: options?.maxUses,
      usedCount: 0,
      createdAt: Date.now(),
    };
    
    setState("inviteLinks", (links) => [...links, link]);
    
    sendMessage({
      type: "create_invite",
      payload: { link },
      timestamp: Date.now(),
    });
    
    return `cortex://collab/invite/${linkId}`;
  };

  const revokeInviteLink = (linkId: string) => {
    if (!state.currentRoom) return;
    if (!isHost() && state.currentUser?.permission !== "owner") return;
    
    setState("inviteLinks", (links) => links.filter((l) => l.id !== linkId));
    
    sendMessage({
      type: "revoke_invite",
      payload: { linkId },
      timestamp: Date.now(),
    });
  };

  // ============================================================================
  // Shared Terminals
  // ============================================================================

  const shareTerminal = async (
    terminalId: string, 
    name: string, 
    isReadOnly: boolean = false
  ): Promise<string> => {
    if (!state.currentUser || !state.currentRoom) {
      throw new Error("Not in a collaboration session");
    }
    
    const sharedTerminal: SharedTerminal = {
      id: generateId(),
      terminalId,
      name,
      ownerId: state.currentUser.id,
      allowedUsers: [],
      isReadOnly,
      createdAt: Date.now(),
    };
    
    setState("sharedTerminals", (terminals) => [...terminals, sharedTerminal]);
    
    sendMessage({
      type: "share_terminal",
      payload: { terminal: sharedTerminal },
      timestamp: Date.now(),
    });
    
    return sharedTerminal.id;
  };

  const unshareTerminal = (sharedTerminalId: string) => {
    if (!state.currentUser || !state.currentRoom) return;
    
    const terminal = state.sharedTerminals.find((t) => t.id === sharedTerminalId);
    if (!terminal) return;
    if (terminal.ownerId !== state.currentUser.id && !isHost()) return;
    
    setState("sharedTerminals", (terminals) => 
      terminals.filter((t) => t.id !== sharedTerminalId)
    );
    
    sendMessage({
      type: "unshare_terminal",
      payload: { terminalId: sharedTerminalId },
      timestamp: Date.now(),
    });
  };

  const sendTerminalInput = (sharedTerminalId: string, data: string) => {
    if (!state.currentUser || !state.currentRoom) return;
    
    const terminal = state.sharedTerminals.find((t) => t.id === sharedTerminalId);
    if (!terminal) return;
    if (terminal.isReadOnly && terminal.ownerId !== state.currentUser.id) return;
    
    sendMessage({
      type: "terminal_input",
      payload: { 
        terminalId: sharedTerminalId,
        data,
        userId: state.currentUser.id,
      },
      timestamp: Date.now(),
    });
  };

  // ============================================================================
  // Chat
  // ============================================================================

  const sendChatMessage = (content: string, replyToId?: string) => {
    if (!state.currentUser || !state.currentRoom) return;
    if (!content.trim()) return;
    
    const message: CollabChatMessage = {
      id: generateId(),
      userId: state.currentUser.id,
      userName: state.currentUser.name,
      userColor: state.currentUser.color,
      content: content.trim(),
      timestamp: Date.now(),
      replyToId,
    };
    
    setState("chatMessages", (messages) => [...messages, message]);
    
    sendMessage({
      type: "chat_message",
      payload: { message },
      timestamp: Date.now(),
    });
  };

  const markChatAsRead = () => {
    setState("unreadChatCount", 0);
  };

  // ============================================================================
  // Audio/Video Calls (Placeholder APIs)
  // ============================================================================

  const startAudioCall = async (): Promise<void> => {
    if (!state.currentUser || !state.currentRoom) return;
    
    // Placeholder: In a real implementation, this would initialize WebRTC
    collabLogger.debug("Audio call starting - placeholder implementation");
    
    setState("isAudioCallActive", true);
    setState("currentUser", "isAudioEnabled", true);
    
    sendMessage({
      type: "call_start",
      payload: { type: "audio", userId: state.currentUser.id },
      timestamp: Date.now(),
    });
  };

  const stopAudioCall = () => {
    if (!state.currentUser) return;
    
    setState("isAudioCallActive", false);
    setState("currentUser", "isAudioEnabled", false);
    
    sendMessage({
      type: "call_end",
      payload: { type: "audio", userId: state.currentUser.id },
      timestamp: Date.now(),
    });
  };

  const toggleAudio = () => {
    if (!state.currentUser) return;
    
    const newState = !state.currentUser.isAudioEnabled;
    setState("currentUser", "isAudioEnabled", newState);
    
    sendMessage({
      type: "audio_toggle",
      payload: { userId: state.currentUser.id, enabled: newState },
      timestamp: Date.now(),
    });
  };

  const startVideoCall = async (): Promise<void> => {
    if (!state.currentUser || !state.currentRoom) return;
    
    // Placeholder: In a real implementation, this would initialize WebRTC
    collabLogger.debug("Video call starting - placeholder implementation");
    
    setState("isVideoCallActive", true);
    setState("currentUser", "isVideoEnabled", true);
    
    sendMessage({
      type: "call_start",
      payload: { type: "video", userId: state.currentUser.id },
      timestamp: Date.now(),
    });
  };

  const stopVideoCall = () => {
    if (!state.currentUser) return;
    
    setState("isVideoCallActive", false);
    setState("currentUser", "isVideoEnabled", false);
    
    sendMessage({
      type: "call_end",
      payload: { type: "video", userId: state.currentUser.id },
      timestamp: Date.now(),
    });
  };

  const toggleVideo = () => {
    if (!state.currentUser) return;
    
    const newState = !state.currentUser.isVideoEnabled;
    setState("currentUser", "isVideoEnabled", newState);
    
    sendMessage({
      type: "video_toggle",
      payload: { userId: state.currentUser.id, enabled: newState },
      timestamp: Date.now(),
    });
  };

  // ============================================================================
  // Helpers
  // ============================================================================

  const getParticipant = (userId: string): CollabUser | undefined => {
    return state.participants.find((p) => p.id === userId);
  };

  const isHost = (): boolean => {
    return state.currentRoom?.hostId === state.currentUser?.id;
  };

  const generateShareLink = (permission?: CollabPermission): string => {
    if (!state.currentRoom) return "";
    if (permission) {
      // Generate an invite link with specific permission
      const linkId = generateId();
      return `cortex://collab/invite/${state.currentRoom.id}/${linkId}?permission=${permission}`;
    }
    // Basic room link
    return `cortex://collab/${state.currentRoom.id}`;
  };

  const parseShareLink = (link: string): { roomId?: string; inviteLinkId?: string } | null => {
    try {
      // Handle cortex:// protocol
      if (link.startsWith("cortex://collab/")) {
        const path = link.replace("cortex://collab/", "");
        
        if (path.startsWith("invite/")) {
          const parts = path.replace("invite/", "").split("/");
          return { roomId: parts[0], inviteLinkId: parts[1]?.split("?")[0] };
        }
        
        return { roomId: path.split("?")[0] };
      }
      
      // Handle web URLs (https://cortex.app/collab/...)
      const url = new URL(link);
      const pathParts = url.pathname.split("/").filter(Boolean);
      
      if (pathParts[0] === "collab") {
        if (pathParts[1] === "invite") {
          return { roomId: pathParts[2], inviteLinkId: pathParts[3] };
        }
        return { roomId: pathParts[1] };
      }
      
      return null;
    } catch {
      return null;
    }
  };

  // Cleanup on unmount - wrap in onMount for proper reactive context
  onMount(() => {
    onCleanup(() => {
      disconnect();
    });
  });

  // Clear pending operations after they've been processed
  createEffect(() => {
    if (state.pendingOperations.length > 0) {
      // Operations are cleared after a small delay to allow consumers to process them
      const timer = setTimeout(() => {
        setState("pendingOperations", []);
      }, 100);
      onCleanup(() => clearTimeout(timer));
    }
  });

  const contextValue: CollabContextValue = {
    state,
    connect,
    disconnect,
    createRoom,
    joinRoom,
    joinRoomWithLink,
    leaveRoom,
    updateCursor,
    updateSelection,
    applyTextOperation,
    followUser,
    unfollowUser,
    updateUserPermission,
    canEdit,
    createInviteLink,
    revokeInviteLink,
    shareTerminal,
    unshareTerminal,
    sendTerminalInput,
    sendChatMessage,
    markChatAsRead,
    startAudioCall,
    stopAudioCall,
    toggleAudio,
    startVideoCall,
    stopVideoCall,
    toggleVideo,
    getParticipant,
    isHost,
    generateShareLink,
    parseShareLink,
  };

  return (
    <CollabContext.Provider value={contextValue}>
      {props.children}
    </CollabContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function useCollab(): CollabContextValue {
  const context = useContext(CollabContext);
  if (!context) {
    throw new Error("useCollab must be used within CollabProvider");
  }
  return context;
}
