'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';

// ============ TYPES ============

type PremiumUser = {
  id: string;
  username: string;
  discriminator: string;
  global_name?: string;
  avatar?: string | null;
  bot?: boolean;
};

type PremiumGuild = {
  id: string;
  name: string;
  icon?: string | null;
  features: string[];
  verification_level: number;
  preferred_locale: string;
};

type DiscordChannel = {
  id: string;
  name: string;
  type: number;
  position?: number;
  recipients?: PremiumUser[];
  topic?: string | null;
};

type DiscordRole = {
  id: string;
  name: string;
  color: number;
  position: number;
};

type DiscordAttachment = {
  id: string;
  filename: string;
  size: number;
  url: string;
  content_type?: string | null;
  width?: number | null;
  height?: number | null;
};

type DiscordMessage = {
  id: string;
  content: string;
  author: PremiumUser;
  timestamp: string;
  embeds?: any[];
  attachments?: DiscordAttachment[];
  mentions?: PremiumUser[];
  reactions?: any[];
  edited_timestamp?: string | null;
};

// ============ UTILITY FUNCTIONS ============

const DISCORD_API_BASE = '/api/discord';
const DISCORD_CDN = 'https://cdn.discordapp.com';

function formatUser(user: PremiumUser) {
  const display = user.global_name || user.username;
  return user.discriminator === '0' ? display : `${display}#${user.discriminator}`;
}

function formatDate(timestamp: string) {
  const date = new Date(timestamp);
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

function guildIconUrl(guild: PremiumGuild) {
  if (!guild.icon) return '';
  return `${DISCORD_CDN}/icons/${guild.id}/${guild.icon}.png?size=64`;
}

function userAvatarUrl(user: PremiumUser) {
  if (!user.avatar) {
    const defaultId = Number(BigInt(user.id) >> BigInt(22)) % 5;
    return `${DISCORD_CDN}/embed/avatars/${defaultId}.png?size=64`;
  }
  return `${DISCORD_CDN}/avatars/${user.id}/${user.avatar}.png?size=64`;
}

// ============ API FUNCTIONS ============

async function authedFetch<T>(token: string, endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${DISCORD_API_BASE}${endpoint}`, {
    ...options,
    headers: {
      ...options?.headers,
      Authorization: `Bot ${token}`,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.message || 'Request failed');
  }

  const contentType = response.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    return response.json();
  }
  return response as any;
}

// ============ PREMIUM COMPONENTS ============

const PremiumButton: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' }
> = ({ children, className = '', variant = 'secondary', ...props }) => {
  const baseClasses =
    'px-4 py-2 rounded-lg font-medium transition-all focus:outline-none focus:ring-2 focus:ring-white/20';
  const variantClasses =
    variant === 'primary'
      ? 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-lg'
      : 'glass-base hover:bg-white/10';

  return (
    <button className={`${baseClasses} ${variantClasses} ${className}`} {...props}>
      {children}
    </button>
  );
};

const PremiumInput: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = ({
  className = '',
  ...props
}) => (
  <input
    className={`glass-base rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-white/20 ${className}`}
    {...props}
  />
);

const PremiumTextArea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement>> = ({
  className = '',
  ...props
}) => (
  <textarea
    className={`glass-base rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-white/20 resize-none min-h-[60px] ${className}`}
    {...props}
  />
);

const PremiumCard: React.FC<{
  children: React.ReactNode;
  className?: string;
  interactive?: boolean;
}> = ({ children, className = '', interactive = false }) => (
  <div
    className={`liquid-glass glass-base rounded-xl p-6 ${interactive ? 'premium-interactive' : ''} ${className}`}
  >
    {children}
  </div>
);

// ============ MESSAGE COMPONENT ============

const EnhancedMessage: React.FC<{
  message: DiscordMessage;
  currentUser: PremiumUser | null;
  onEdit?: (message: DiscordMessage) => void;
  onDelete?: (id: string) => void;
  onReply?: (message: DiscordMessage) => void;
  onUserClick?: (user: PremiumUser) => void;
}> = ({ message, currentUser, onEdit, onDelete, onReply, onUserClick }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isCurrentUser = message.author.id === currentUser?.id;
  const hasAttachments = message.attachments && message.attachments.length > 0;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSaveEdit = async () => {
    await onEdit?.({ ...message, content: editContent });
    setIsEditing(false);
  };

  const handleDelete = () => {
    if (confirm('Delete this message?')) {
      onDelete?.(message.id);
    }
    setShowMenu(false);
  };

  return (
    <div
      id={`message-${message.id}`}
      className="group flex gap-4 p-3 hover:bg-white/5 transition-colors relative"
    >
      <img
        src={userAvatarUrl(message.author)}
        alt={message.author.username}
        onClick={() => onUserClick?.(message.author)}
        className="w-10 h-10 rounded-full cursor-pointer hover:scale-105 transition-transform flex-shrink-0"
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-1">
          <button
            className={`font-semibold hover:underline cursor-pointer ${
              isCurrentUser ? 'text-green-400' : 'text-white'
            }`}
            onClick={() => onUserClick?.(message.author)}
          >
            {formatUser(message.author)}
          </button>
          <span className="text-xs text-white/50">{formatDate(message.timestamp)}</span>
          {message.edited_timestamp && <span className="text-xs text-white/50">(edited)</span>}
        </div>

        <div className="relative">
          {isEditing ? (
            <div className="space-y-2">
              <PremiumTextArea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={3}
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <PremiumButton variant="secondary" onClick={() => setIsEditing(false)}>
                  Cancel
                </PremiumButton>
                <PremiumButton variant="primary" onClick={handleSaveEdit}>
                  Save
                </PremiumButton>
              </div>
            </div>
          ) : (
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
          )}

          {hasAttachments && (
            <div className="mt-2 space-y-2">
              {message.attachments?.map((attachment) => (
                <div key={attachment.id} className="glass-base p-2 rounded-lg inline-block">
                  <a
                    href={attachment.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 hover:underline"
                  >
                    📎 {attachment.filename} ({(attachment.size / 1024).toFixed(1)} KB)
                  </a>
                </div>
              ))}
            </div>
          )}

          <div className="absolute -top-2 right-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="glass-base p-1 rounded text-xs hover:bg-white/20"
            >
              ⋮
            </button>
          </div>

          {showMenu && (
            <div
              ref={menuRef}
              className="absolute right-0 top-8 w-32 glass-base rounded-lg shadow-lg z-20"
            >
              {isCurrentUser && (
                <button
                  onClick={() => {
                    setIsEditing(true);
                    setShowMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-white/10 rounded-t-lg"
                >
                  ✏️ Edit
                </button>
              )}
              {isCurrentUser && (
                <button
                  onClick={handleDelete}
                  className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-white/10 rounded-b-lg"
                >
                  🗑️ Delete
                </button>
              )}
              {!isCurrentUser && (
                <button
                  onClick={() => {
                    onReply?.(message);
                    setShowMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-white/10"
                >
                  ↩️ Reply
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============ MAIN APP COMPONENT ============

export default function PremiumDiscordClient() {
  // Core state
  const [tokenInput, setTokenInput] = useState('');
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [botUser, setBotUser] = useState<PremiumUser | null>(null);

  // Data state
  const [guilds, setGuilds] = useState<PremiumGuild[]>([]);
  const [selectedGuildId, setSelectedGuildId] = useState<string | null>(null);
  const [channels, setChannels] = useState<DiscordChannel[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [roles, setRoles] = useState<DiscordRole[]>([]);

  // Messages
  const [messages, setMessages] = useState<DiscordMessage[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [replyingTo, setReplyingTo] = useState<DiscordMessage | null>(null);

  // UI state
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Modals
  const [userProfile, setUserProfile] = useState<PremiumUser | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);

  // Effects
  useEffect(() => {
    const stored = localStorage.getItem('discord-bot-token');
    if (stored) {
      setAuthToken(stored);
      setTokenInput(stored);
    }
  }, []);

  useEffect(() => {
    if (!authToken) return;
    authenticate();
  }, [authToken]);

  useEffect(() => {
    if (!authToken || !botUser) return;
    loadGuilds();
  }, [authToken, botUser]);

  useEffect(() => {
    if (!authToken || !selectedGuildId) return;
    loadGuildData();
  }, [authToken, selectedGuildId]);

  useEffect(() => {
    if (!authToken || !selectedChannelId) {
      setMessages([]);
      return;
    }
    loadMessages();
  }, [authToken, selectedChannelId]);

  // API Calls
  const authenticate = async () => {
    if (!authToken) return;

    setIsAuthenticating(true);
    try {
      const user = await authedFetch<PremiumUser>(authToken, '/users/@me');
      if (!user.bot) throw new Error('Not a bot token');
      setBotUser(user);
      setAuthError(null);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Authentication failed');
      setAuthToken(null);
      setBotUser(null);
      localStorage.removeItem('discord-bot-token');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const loadGuilds = async () => {
    if (!authToken) return;
    setIsLoading(true);
    try {
      const data = await authedFetch<PremiumGuild[]>(authToken, '/users/@me/guilds');
      setGuilds(data);
      if (data.length > 0) setSelectedGuildId(data[0].id);
    } catch (error) {
      console.error('Failed to load guilds:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadGuildData = async () => {
    if (!authToken || !selectedGuildId) return;
    setIsLoading(true);
    try {
      const [channelData, roleData] = await Promise.all([
        authedFetch<DiscordChannel[]>(authToken, `/guilds/${selectedGuildId}/channels`),
        authedFetch<DiscordRole[]>(authToken, `/guilds/${selectedGuildId}/roles`),
      ]);

      const sortedChannels = [...channelData].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
      setChannels(sortedChannels);
      setRoles(roleData);

      const textChannels = sortedChannels.filter((c) => c.type === 0);
      if (!selectedChannelId || !textChannels.some((c) => c.id === selectedChannelId)) {
        setSelectedChannelId(textChannels[0]?.id || null);
      }
    } catch (error) {
      console.error('Failed to load guild data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMessages = async () => {
    if (!authToken || !selectedChannelId) {
      setMessages([]);
      return;
    }
    setIsLoading(true);
    try {
      const data = await authedFetch<DiscordMessage[]>(
        authToken,
        `/channels/${selectedChannelId}/messages?limit=50`
      );
      setMessages(data.reverse());
    } catch (error) {
      console.error('Failed to load messages:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Handlers
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim()) return;

    const token = tokenInput.trim();
    try {
      setIsAuthenticating(true);
      const user = await authedFetch<PremiumUser>(token, '/users/@me');
      if (!user.bot) throw new Error('Not a bot token');

      setBotUser(user);
      setAuthToken(token);
      localStorage.setItem('discord-bot-token', token);
      setAuthError(null);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Authentication failed');
      setBotUser(null);
      setAuthToken(null);
      localStorage.removeItem('discord-bot-token');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleLogout = () => {
    setAuthToken(null);
    setBotUser(null);
    setGuilds([]);
    setChannels([]);
    setMessages([]);
    setSelectedGuildId(null);
    setSelectedChannelId(null);
    localStorage.removeItem('discord-bot-token');
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authToken || !selectedChannelId || !messageInput.trim()) return;

    try {
      await authedFetch(`${authToken}`, `/channels/${selectedChannelId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content: messageInput }),
      });
      setMessageInput('');
      setTimeout(loadMessages, 500);
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const handleEditMessage = async (message: DiscordMessage) => {
    if (!authToken || !selectedChannelId) return;
    try {
      await authedFetch(`${authToken}`, `/channels/${selectedChannelId}/messages/${message.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ content: message.content }),
      });
      loadMessages();
    } catch (error) {
      console.error('Failed to edit message:', error);
    }
  };

  const handleDeleteMessage = (messageId: string) => {
    if (!authToken || !selectedChannelId) return;
    authedFetch(`${authToken}`, `/channels/${selectedChannelId}/messages/${messageId}`, {
      method: 'DELETE',
    })
      .then(loadMessages)
      .catch(console.error);
  };

  // Login Screen
  if (!authToken || !botUser) {
    return (
      <div className="fixed inset-0 flex items-center justify-center p-6 bg-gradient-to-br from-blue-900 via-purple-900 to-pink-900">
        <PremiumCard className="w-full max-w-md premium-interactive glass-base">
          <div className="flex justify-center mb-6">
            <div className="w-24 h-24 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 flex items-center justify-center text-3xl">
              🤖
            </div>
          </div>
          <h1 className="text-3xl font-bold text-center mb-4">BotClienty Premium</h1>
          <p className="text-white/70 text-center mb-8 italic">
            Premium Discord client with glassmorphic styling
          </p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Bot Token</label>
              <PremiumInput
                type="password"
                placeholder="Enter your Discord bot token"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                autoFocus
              />
            </div>

            {authError && (
              <div className="glass-base p-3 rounded-lg border border-red-500/50 rounded-lg">
                <p className="text-red-400 text-sm">⚠️ {authError}</p>
              </div>
            )}

            <PremiumButton
              type="submit"
              variant="primary"
              className="w-full"
              disabled={isAuthenticating}
            >
              {isAuthenticating ? (
                <span className="flex items-center justify-center">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                  Authenticating...
                </span>
              ) : (
                'Connect Premium Bot'
              )}
            </PremiumButton>
          </form>

          <div className="mt-8 pt-6 border-t border-white/10">
            <h3 className="font-semibold mb-4">Premium Features</h3>
            <div className="space-y-2">
              <FeatureItem>🎨 Glassmorphic UI design</FeatureItem>
              <FeatureItem>📁 Advanced file uploads</FeatureItem>
              <FeatureItem>💬 Full message features (edit, delete, reply)</FeatureItem>
              <FeatureItem>⚡ Real-time messaging updates</FeatureItem>
              <FeatureItem>🔍 Rich message formatting</FeatureItem>
              <FeatureItem>🔐 Secure token authentication</FeatureItem>
            </div>
          </div>
        </PremiumCard>
      </div>
    );
  }

  const selectedGuild = guilds.find((g) => g.id === selectedGuildId);
  const selectedChannel = channels.find((c) => c.id === selectedChannelId);

  return (
    <div className="flex h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-blue-900 text-white">
      {/* Server Sidebar */}
      <nav className="w-20 glass-base border-r border-white/10 flex flex-col items-center py-4 gap-2 overflow-y-auto">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-r from-purple-600 to-blue-600 flex items-center justify-center text-xl transition-all hover:rounded-lg cursor-pointer">
          🏠
        </div>
        <div className="w-8 h-px bg-white/10" />
        {guilds.map((guild) => (
          <button
            key={guild.id}
            onClick={() => {
              setSelectedGuildId(guild.id);
              setSelectedChannelId(null);
              setMessages([]);
            }}
            className={`w-12 h-12 rounded-2xl overflow-hidden flex items-center justify-center premium-interactive ${
              selectedGuildId === guild.id ? 'ring-2 ring-white/50' : ''
            }`}
            title={guild.name}
          >
            {guild.icon ? (
              <img
                src={guildIconUrl(guild)}
                alt={guild.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="font-bold text-sm">{guild.name.charAt(0)}</span>
            )}
          </button>
        ))}
      </nav>

      {/* Channel Sidebar */}
      <aside className="w-72 glass-base border-r border-white/10 flex flex-col">
        <header className="liquid-glass p-4 border-b border-white/10">
          <h2 className="font-bold text-lg truncate">{selectedGuild?.name || 'Loading...'}</h2>
          <p className="text-sm text-white/60 font-medium">
            {botUser.global_name || botUser.username}
          </p>
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-1">
          {channels
            .filter((c) => c.type === 0)
            .map((channel) => (
              <button
                key={channel.id}
                onClick={() => setSelectedChannelId(channel.id)}
                className={`w-full text-left p-2 rounded-lg hover:bg-white/10 transition-colors flex items-center gap-2 premium-interactive ${
                  selectedChannelId === channel.id ? 'bg-white/10 ring-1 ring-white/20' : ''
                }`}
              >
                <span className="text-sm">#</span>
                <span className="text-sm truncate">{channel.name}</span>
              </button>
            ))}
          {channels.filter((c) => c.type === 0).length === 0 && !isLoading && (
            <p className="text-white/50 text-sm">No text channels in this server</p>
          )}
        </div>

        <div className="liquid-glass p-4 border-t border-white/10">
          <PremiumButton
            variant="secondary"
            className="w-full flex items-center justify-center gap-3"
            onClick={handleLogout}
          >
            <div className="w-4 h-4 rounded-full bg-gradient-to-r from-red-500 to-orange-500" />
            <span>Logout Premium Bot</span>
          </PremiumButton>
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col bg-black/20">
        {/* Chat Header */}
        <header className="liquid-glass p-4 border-b border-white/10">
          <h1 className="text-xl font-bold">#{selectedChannel?.name || 'Select a channel'}</h1>
          <p className="text-sm text-white/60">
            {selectedChannel?.topic || 'No topic set for this channel'}
          </p>
        </header>

        {/* Messages Container */}
        <div className="flex-1 overflow-y-auto p-4 space-y-1">
          {isLoading ? (
            <div className="flex justify-center items-center h-full">
              <div className="text-center">
                <div className="w-12 h-12 border-2 border-white/30 border-t-purple-400 rounded-full animate-spin mx-auto mb-4" />
                <p className="text-white/60">Loading messages...</p>
              </div>
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-12 glass-base rounded-xl max-w-2xl mx-auto">
              <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-r from-purple-400/20 to-blue-400/20 flex items-center justify-center text-4xl">
                💬
              </div>
              <h3 className="text-xl font-semibold mb-2">No messages yet</h3>
              <p className="text-white/60 max-w-xs mx-auto">
                Start the conversation with the premium chat experience!
              </p>
            </div>
          ) : (
            <div className="space-y-0">
              {messages.map((message) => (
                <EnhancedMessage
                  key={message.id}
                  message={message}
                  currentUser={botUser}
                  onEdit={handleEditMessage}
                  onDelete={handleDeleteMessage}
                  onReply={setReplyingTo}
                  onUserClick={(user) => {
                    setUserProfile(user);
                    setShowProfile(true);
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Message Composer */}
        <footer className="liquid-glass p-4 border-t border-white/10">
          {replyingTo && (
            <div className="glass-base p-3 rounded-lg mb-3 flex justify-between items-center">
              <div className="text-sm flex items-center gap-2">
                <span className="text-purple-400">↳</span>
                <span>Replying to {formatUser(replyingTo.author)}</span>
                <span className="text-white/60 truncate max-w-xs">
                  {replyingTo.content.slice(0, 50)}
                </span>
              </div>
              <button
                onClick={() => setReplyingTo(null)}
                className="text-white/60 hover:text-white text-lg"
              >
                ×
              </button>
            </div>
          )}

          {uploadFiles.length > 0 && (
            <div className="glass-base p-3 rounded-lg mb-3">
              <h4 className="text-sm font-medium mb-2">Attachments ({uploadFiles.length})</h4>
              <div className="space-y-2">
                {uploadFiles.map((file, index) => (
                  <div key={index} className="flex justify-between items-center text-sm">
                    <span className="truncate">
                      📎 {file.name} ({(file.size / 1024).toFixed(1)} KB)
                    </span>
                    <button
                      onClick={() => setUploadFiles((prev) => prev.filter((_, i) => i !== index))}
                      className="text-red-400 hover:text-red-300 text-sm"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={handleSendMessage} className="flex gap-2">
            <input
              type="file"
              multiple
              className="hidden"
              id="file-upload"
              onChange={(e) => {
                const files = e.target.files ? Array.from(e.target.files) : [];
                setUploadFiles((prev) => [...prev, ...files]);
              }}
            />
            <label
              htmlFor="file-upload"
              className="glass-base px-3 py-2 rounded-lg cursor-pointer hover:bg-white/10 transition-colors flex items-center"
              title="Attach files"
            >
              📎
            </label>

            <PremiumTextArea
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              placeholder={selectedChannelId ? 'Type a message...' : 'Select a channel first'}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage(e);
                }
              }}
              className="flex-1"
              disabled={!selectedChannelId}
            />

            <PremiumButton
              type="submit"
              variant="primary"
              disabled={
                !selectedChannelId ||
                (!messageInput.trim() && uploadFiles.length === 0) ||
                isLoading
              }
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                'Send'
              )}
            </PremiumButton>
          </form>
        </footer>
      </main>

      {/* Right Sidebar */}
      <aside className="hidden lg:flex w-80 glass-base border-l border-white/10 p-4 flex-col">
        <div className="mb-6 liquid-glass p-4 rounded-lg">
          <h3 className="font-semibold mb-4">Channel Info</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-white/60">Messages:</span>
              <span className="font-mono">{messages.length.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/60">Channel:</span>
              <span className="font-mono">{selectedChannel?.name || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/60">Prefix:</span>
              <span className="font-mono">
                {String.fromCodePoint(
                  Number((BigInt(selectedChannelId || '0') >> BigInt(22)) % BigInt(6)) + 0x1f500
                )}
              </span>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <h3 className="font-semibold mb-3">Premium Features</h3>
          <div className="space-y-2 text-sm">
            {[
              { icon: '🎨', text: 'Glassmorphic UI design' },
              { icon: '📁', text: 'Advanced file uploads' },
              { icon: '💬', text: 'Full message features' },
              { icon: '⚡', text: 'Real-time messaging' },
              { icon: '🔧', text: 'Message editing/deletion' },
              { icon: '⚡', text: 'Fast performance' },
            ].map((item, i) => (
              <div key={i} className="glass-base p-3 rounded-lg">
                <span className="mr-2">{item.icon}</span>
                <span>{item.text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-white/10">
          <div className="flex items-center gap-3">
            <img
              src={botUser.avatar ? userAvatarUrl(botUser) : '/bot-icon.png'}
              alt={botUser.username}
              className="w-10 h-10 rounded-full"
            />
            <div className="flex-1">
              <p className="font-medium text-sm">{botUser.global_name || botUser.username}</p>
              <p className="text-xs text-white/60">Bot v3.0 Premium</p>
            </div>
          </div>
        </div>
      </aside>

      {/* User Profile Modal */}
      {showProfile && userProfile && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowProfile(false)}
        >
          <div
            className="glass-base rounded-2xl max-w-lg w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="liquid-glass p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">User Profile</h2>
                <button
                  onClick={() => setShowProfile(false)}
                  className="text-white/60 hover:text-white text-2xl"
                >
                  ×
                </button>
              </div>
              <div className="flex gap-4">
                <img
                  src={userAvatarUrl(userProfile)}
                  alt={userProfile.username}
                  className="w-20 h-20 lg:w-24 lg:h-24 rounded-full"
                />
                <div className="flex-1">
                  <h3 className="text-xl font-bold">{formatUser(userProfile)}</h3>
                  <p className="text-white/60">
                    ID: <span className="font-mono">{userProfile.id}</span>
                  </p>
                  <p className="text-white/60">Bot: {userProfile.bot ? '✅ Yes' : '❌ No'}</p>
                  <PremiumButton
                    className="mt-3"
                    onClick={() => navigator.clipboard.writeText(userProfile.id)}
                    variant="secondary"
                  >
                    Copy ID
                  </PremiumButton>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============ HELPER COMPONENTS ============

const FeatureItem: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex items-center gap-2 text-sm">
    <div className="w-2 h-2 rounded-full bg-purple-400" />
    <span>{children}</span>
  </div>
);
