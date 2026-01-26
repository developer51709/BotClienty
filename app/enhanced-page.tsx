'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';

// Types
type DiscordUser = {
  id: string;
  username: string;
  discriminator: string;
  global_name?: string;
  avatar?: string | null;
};

type BotUser = DiscordUser & {
  bot: boolean;
};

type DiscordGuild = {
  id: string;
  name: string;
  icon?: string | null;
  owner?: boolean;
  permissions?: string;
};

type DiscordChannel = {
  id: string;
  name: string;
  type: number;
  parent_id?: string | null;
  position?: number;
  recipients?: DiscordUser[];
  topic?: string | null;
};

type DiscordRole = {
  id: string;
  name: string;
  color: number;
  position: number;
  permissions?: string;
  managed?: boolean;
  mentionable?: boolean;
};

type DiscordAttachment = {
  id: string;
  filename: string;
  size: number;
  url: string;
  proxy_url?: string;
  content_type?: string | null;
  width?: number | null;
  height?: number | null;
  description?: string | null;
};

type DiscordMessage = {
  id: string;
  content: string;
  author: DiscordUser;
  timestamp: string;
  embeds?: DiscordEmbed[];
  attachments?: DiscordAttachment[];
  mentions?: DiscordUser[];
  mention_roles?: string[];
  mention_channels?: string[];
  reactions?: DiscordReaction[];
  edited_timestamp?: string | null;
};

type DiscordEmbed = {
  title?: string;
  description?: string;
  url?: string;
  color?: number;
  fields?: { name: string; value: string; inline?: boolean }[];
  author?: {
    name?: string;
    icon_url?: string;
    url?: string;
  };
  footer?: {
    text: string;
    icon_url?: string;
  };
  image?: { url: string } | null;
  thumbnail?: { url: string } | null;
  video?: { url?: string } | null;
};

type DiscordReaction = {
  count: number;
  me: boolean;
  emoji: {
    id: string | null;
    name: string;
    animated?: boolean;
  };
};

// Message content parsing types
type MessageContentPart =
  | { type: 'text'; content: string }
  | { type: 'link'; url: string }
  | { type: 'emoji'; id: string; name: string; animated: boolean }
  | { type: 'mention'; mentionType: 'user' | 'role' | 'channel' | 'everyone'; id: string; label: string };

type FormattingContext = {
  users?: Record<string, DiscordUser>;
  roles?: Record<string, DiscordRole>;
  channels?: Record<string, DiscordChannel>;
};

// Server Settings type
type GuildSettings = {
  name: string;
  description?: string;
  icon?: string | null;
  features: string[];
  mfa_level: number;
  verification_level: number;
  explicit_content_filter: number;
  default_message_notifications: number;
  preferred_locale: string;
  vanity_url_code?: string | null;
};

// Search result types
type SearchResult = {
  messages: DiscordMessage[];
  total_results: number;
};

// Constants
const DISCORD_API_BASE = '/api/discord';
const DISCORD_CDN = 'https://cdn.discordapp.com';

// Utility functions
function formatUserTag(user: DiscordUser) {
  const display = user.global_name || user.username;
  return user.discriminator === '0' || !user.discriminator
    ? display
    : `${display}#${user.discriminator}`;
}

function formatDate(timestamp: string) {
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short'
    }).format(new Date(timestamp));
  } catch (error) {
    return timestamp;
  }
}

function guildIconUrl(guild: DiscordGuild) {
  if (!guild.icon) return '';
  return `${DISCORD_CDN}/icons/${guild.id}/${guild.icon}.png?size=128`;
}

function userAvatarUrl(user: DiscordUser) {
  if (!user.avatar) {
    const defaultId = Number(BigInt(user.id) >> BigInt(22)) % 5;
    return `${DISCORD_CDN}/embed/avatars/${defaultId}.png`;
  }
  const format = user.avatar.startsWith('a_') ? 'gif' : 'png';
  return `${DISCORD_CDN}/avatars/${user.id}/${user.avatar}.${format}?size=128`;
}

function getChannelDisplayName(channel: DiscordChannel | null) {
  if (!channel) return '';
  if (channel.recipients && channel.recipients.length > 0) {
    return formatUserTag(channel.recipients[0]);
  }
  if (channel.type === 1 || channel.type === 3) {
    return channel.name ?? 'Direct Message';
  }
  return channel.name;
}

function getAttachmentKind(attachment: DiscordAttachment): 'image' | 'video' | 'audio' | 'file' {
  const contentType = attachment.content_type?.toLowerCase() ?? '';
  if (contentType.startsWith('image/')) return 'image';
  if (contentType.startsWith('video/')) return 'video';
  if (contentType.startsWith('audio/')) return 'audio';

  const extension = attachment.filename.split('.').pop()?.toLowerCase() ?? '';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(extension)) return 'image';
  if (['mp4', 'mov', 'webm', 'mkv'].includes(extension)) return 'video';
  if (['mp3', 'wav', 'ogg', 'flac'].includes(extension)) return 'audio';

  return 'file';
}

// API functions
type FetchMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD';

async function authedFetch<T>(
  token: string,
  endpoint: string,
  method: FetchMethod = 'GET',
  body?: Record<string, unknown>,
  formData?: FormData
): Promise<T> {
  const headers: HeadersInit = {};
  
  const hasBody = Boolean(body) && method !== 'GET' && method !== 'HEAD';

  if (!formData) {
    headers['Authorization'] = `Bot ${token}`;
    headers['Accept'] = 'application/json';
    
    if (hasBody) {
      headers['Content-Type'] = 'application/json';
    }
  } else {
    headers['Authorization'] = `Bot ${token}`;
  }

  const response = await fetch(`${DISCORD_API_BASE}${endpoint}`, {
    method,
    headers,
    body: formData ? formData : (hasBody ? JSON.stringify(body) : undefined),
    cache: 'no-store'
  });

  if (!response.ok) {
    let message = 'Failed to communicate with Discord.';
    try {
      const data = await response.json();
      if (data && typeof data === 'object' && 'message' in data) {
        message = String((data as { message?: string }).message ?? message);
      } else {
        message = JSON.stringify(data);
      }
    } catch {
      try {
        message = await response.text();
      } catch {
        // ignore parsing errors
      }
    }

    throw new Error(message || 'Failed to communicate with Discord.');
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (response.status === 204 || !contentType.includes('application/json')) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

// Enhanced components
interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ size = 'md', className = '' }) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  };

  return (
    <div className={`animate-spin rounded-full border-2 border-gray-300 border-t-blue-600 ${sizeClasses[size]} ${className}`}></div>
  );
};

interface ErrorMessageProps {
  message: string;
  onRetry?: () => void;
}

const ErrorMessage: React.FC<ErrorMessageProps> = ({ message, onRetry }) => (
  <div className="error-message">
    <span>❌ {message}</span>
    {onRetry && (
      <button onClick={onRetry} className="retry-button">
        Retry
      </button>
    )}
  </div>
);

interface SearchBarProps {
  onSearch: (query: string) => void;
  isLoading?: boolean;
  placeholder?: string;
}

const SearchBar: React.FC<SearchBarProps> = ({ onSearch, isLoading = false, placeholder = "Search messages..." }) => {
  const [query, setQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query.trim());
    }
  };

  return (
    <form onSubmit={handleSubmit} className="search-bar">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        disabled={isLoading}
      />
      <button type="submit" disabled={isLoading || !query.trim()}>
        {isLoading ? <LoadingSpinner size="sm" /> : '🔍'}
      </button>
    </form>
  );
};

interface FileUploadProps {
  onFileSelect: (files: FileList) => void;
  disabled?: boolean;
  accept?: string;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFileSelect, disabled = false, accept = "*/*" }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      onFileSelect(e.target.files);
    }
  };

  return (
    <div className="file-upload">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        className="upload-button"
      >
        📎
      </button>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={accept}
        onChange={handleChange}
        style={{ display: 'none' }}
      />
    </div>
  );
};

// Main component
export default function EnhancedBotClient() {
  // Existing state
  const [tokenInput, setTokenInput] = useState('');
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [botUser, setBotUser] = useState<BotUser | null>(null);
  const [guilds, setGuilds] = useState<DiscordGuild[]>([]);
  const [dmChannels, setDmChannels] = useState<DiscordChannel[]>([]);
  const [selectedGuildId, setSelectedGuildId] = useState<string | null>(null);
  const [channels, setChannels] = useState<DiscordChannel[]>([]);
  const [roles, setRoles] = useState<DiscordRole[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [messages, setMessages] = useState<DiscordMessage[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isLoadingChannels, setIsLoadingChannels] = useState(false);

  // New state for enhanced features
  const [messageOffset, setMessageOffset] = useState(0);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<DiscordUser | null>(null);
  const [guildSettings, setGuildSettings] = useState<GuildSettings | null>(null);
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [showGuildSettings, setShowGuildSettings] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // Load stored token on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem('discord-bot-token');
    if (stored) {
      setAuthToken(stored);
      setTokenInput(stored);
    }
  }, []);

  // Authentication effect
  useEffect(() => {
    if (!authToken) return;

    async function loadIdentity() {
      if (!authToken) return;
      
      try {
        setIsAuthenticating(true);
        const bot = await authedFetch<BotUser>(authToken, '/users/@me');
        if (!bot.bot) {
          throw new Error('The provided token does not belong to a bot.');
        }
        setBotUser(bot);
        setAuthError(null);
      } catch (error) {
        console.error(error);
        setAuthError('Invalid token or insufficient permissions.');
        setAuthToken(null);
        setBotUser(null);
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem('discord-bot-token');
        }
      } finally {
        setIsAuthenticating(false);
      }
    }

    loadIdentity();
  }, [authToken]);

  // Load guilds and DM channels
  useEffect(() => {
    if (!authToken) return;

    const loadGuilds = async () => {
      try {
        const data = await authedFetch<DiscordGuild[]>(authToken, '/users/@me/guilds');
        setGuilds(data);
        // Only auto-select first guild if no guild is currently selected and we have guilds
        if (data.length > 0 && !selectedGuildId && !selectedChannelId) {
          setSelectedGuildId(data[0].id);
        }
      } catch (error) {
        console.error('Error loading guilds:', error);
      }
    };

    const loadDmChannels = async () => {
      try {
        const data = await authedFetch<DiscordChannel[]>(authToken, '/users/@me/channels');
        const directMessages = data.filter((channel) => channel.type === 1);
        setDmChannels(directMessages);
        // Auto-select first DM if no guild/channel is selected
        if (directMessages.length > 0 && !selectedGuildId && !selectedChannelId) {
          setSelectedChannelId(directMessages[0].id);
        }
      } catch (error) {
        console.error('Error loading DM channels:', error);
      }
    };

    loadGuilds();
    loadDmChannels();
  }, [authToken]);

  // Load channels for selected guild
  useEffect(() => {
    if (!authToken || !selectedGuildId) {
      setChannels([]);
      setRoles([]);
      return;
    }

    const fetchChannels = async () => {
      try {
        setIsLoadingChannels(true);
        const data = await authedFetch<DiscordChannel[]>(
          authToken,
          `/guilds/${selectedGuildId}/channels`
        );
        const sortedChannels = [...data].sort(
          (a, b) => (a.position ?? 0) - (b.position ?? 0)
        );
        setChannels(sortedChannels);
        const textChannels = sortedChannels.filter((channel) => channel.type === 0);
        if (!selectedChannelId || !textChannels.some((channel) => channel.id === selectedChannelId)) {
          setSelectedChannelId(textChannels[0]?.id ?? null);
        }
      } catch (error) {
        console.error('Error loading guild channels:', error);
        setChannels([]);
      } finally {
        setIsLoadingChannels(false);
      }
    };

    const fetchRoles = async () => {
      try {
        const data = await authedFetch<DiscordRole[]>(
          authToken,
          `/guilds/${selectedGuildId}/roles`
        );
        setRoles(data);
      } catch (error) {
        console.error('Error loading guild roles:', error);
        setRoles([]);
      }
    };

    fetchChannels();
    fetchRoles();
  }, [authToken, selectedGuildId]);

  // Load messages for selected channel
  useEffect(() => {
    if (!authToken || !selectedChannelId) {
      setMessages([]);
      return;
    }

    const fetchMessages = async () => {
      try {
        setIsLoadingMessages(true);
        setMessageOffset(0);
        const data = await authedFetch<DiscordMessage[]>(
          authToken,
          `/channels/${selectedChannelId}/messages?limit=50`
        );
        setMessages(data.reverse());
        setHasMoreMessages(data.length === 50);
      } catch (error) {
        console.error('Error loading messages:', error);
        setMessages([]);
        setHasMoreMessages(false);
      } finally {
        setIsLoadingMessages(false);
      }
    };

    fetchMessages();
  }, [authToken, selectedChannelId]);

  // Load more messages
  const loadMoreMessages = async () => {
    if (!authToken || !selectedChannelId || isLoadingMore || !hasMoreMessages) return;

    try {
      setIsLoadingMore(true);
      const oldestMessage = messages[0];
      const data = await authedFetch<DiscordMessage[]>(
        authToken,
        `/channels/${selectedChannelId}/messages?limit=50&before=${oldestMessage.id}`
      );
      
      if (data.length < 50) {
        setHasMoreMessages(false);
      }
      
      setMessages(prev => [...data.reverse(), ...prev]);
    } catch (error) {
      console.error('Error loading more messages:', error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Search messages
  const searchMessages = async (query: string) => {
    if (!authToken || !selectedChannelId) return;

    try {
      setIsSearching(true);
      setSearchQuery(query);
      const data = await authedFetch<SearchResult>(
        authToken,
        `/channels/${selectedChannelId}/messages/search?query=${encodeURIComponent(query)}&limit=25`
      );
      setSearchResults(data);
    } catch (error) {
      console.error('Error searching messages:', error);
      setSearchResults(null);
    } finally {
      setIsSearching(false);
    }
  };

  // Load user profile
  const loadUserProfile = async (userId: string) => {
    if (!authToken) return;

    try {
      const user = await authedFetch<DiscordUser>(authToken, `/users/${userId}`);
      setSelectedUser(user);
      setShowUserProfile(true);
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
  };

  // Load guild settings
  const loadGuildSettings = async () => {
    if (!authToken || !selectedGuildId) return;

    try {
      const data = await authedFetch<GuildSettings>(authToken, `/guilds/${selectedGuildId}`);
      setGuildSettings(data);
      setShowGuildSettings(true);
    } catch (error) {
      console.error('Error loading guild settings:', error);
    }
  };

  // Handle file upload
  const handleFileSelect = (files: FileList) => {
    setUploadedFiles(Array.from(files));
  };

  // Send message with files
  const sendMessageWithFiles = async (content: string, files: File[]) => {
    if (!authToken || !selectedChannelId || (!content.trim() && files.length === 0)) return;

    try {
      setIsUploading(true);
      const formData = new FormData();
      
      if (content.trim()) {
        formData.append('content', content);
      }
      
      files.forEach((file) => {
        formData.append('files', file);
      });

      await authedFetch(authToken, `/channels/${selectedChannelId}/messages`, 'POST', undefined, formData);
      
      // Reload messages
      const newMessages = await authedFetch<DiscordMessage[]>(
        authToken,
        `/channels/${selectedChannelId}/messages?limit=50`
      );
      setMessages(newMessages.reverse());
      
      setUploadedFiles([]);
      setMessageInput('');
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsUploading(false);
    }
  };

  // Handle message sending
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    await sendMessageWithFiles(messageInput, uploadedFiles);
  };

  // Add reaction to message
  const addReaction = async (messageId: string, emoji: string) => {
    if (!authToken) return;

    try {
      await authedFetch(
        authToken,
        `/channels/${selectedChannelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}/@me`,
        'PUT'
      );
      
      // Update local state
      setMessages(prev => prev.map(msg => {
        if (msg.id === messageId) {
          const existingReaction = msg.reactions?.find(r => r.emoji.name === emoji);
          if (existingReaction) {
            return {
              ...msg,
              reactions: msg.reactions?.map(r => 
                r.emoji.name === emoji 
                  ? { ...r, count: r.count + 1, me: true }
                  : r
              )
            };
          } else {
            return {
              ...msg,
              reactions: [
                ...(msg.reactions || []),
                { count: 1, me: true, emoji: { id: null, name: emoji } }
              ]
            };
          }
        }
        return msg;
      }));
    } catch (error) {
      console.error('Error adding reaction:', error);
    }
  };

  // Login handler
  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!tokenInput.trim()) return;
    
    setIsAuthenticating(true);
    setAuthError(null);

    try {
      const sanitizedToken = tokenInput.trim();
      const bot = await authedFetch<BotUser>(sanitizedToken, '/users/@me');
      if (!bot.bot) {
        throw new Error('The provided token does not belong to a bot.');
      }
      
      setBotUser(bot);
      setAuthToken(sanitizedToken);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('discord-bot-token', sanitizedToken);
      }
      
      const [guildData, dmData] = await Promise.all([
        authedFetch<DiscordGuild[]>(sanitizedToken, '/users/@me/guilds'),
        authedFetch<DiscordChannel[]>(sanitizedToken, '/users/@me/channels')
      ]);
      
      setGuilds(guildData);
      const directMessages = dmData.filter((channel) => channel.type === 1);
      setDmChannels(directMessages);
      
      if (guildData.length > 0) {
        setSelectedGuildId(guildData[0].id);
      } else if (directMessages.length > 0) {
        setSelectedChannelId(directMessages[0].id);
      }
    } catch (error) {
      console.error(error);
      setAuthError('Could not validate token. Please check and try again.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  // Logout handler
  const logout = () => {
    setAuthToken(null);
    setBotUser(null);
    setGuilds([]);
    setChannels([]);
    setMessages([]);
    setSelectedGuildId(null);
    setSelectedChannelId(null);
    setDmChannels([]);
    setSearchResults(null);
    setShowUserProfile(false);
    setShowGuildSettings(false);
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('discord-bot-token');
    }
  };

  // Render functions
  const renderLogin = () => (
    <div className="login-overlay">
      <div className="topbar">
        <img src="/logo.png" alt="BotClienty Logo" className="topbar-logo" />
        <strong>Enhanced BotClienty</strong>
      </div>
      <form className="login-card" onSubmit={handleLogin}>
        <h1>Enhanced BotClienty</h1>
        <p>Connect with your Discord bot token to manage servers, channels, and messages.</p>
        <label htmlFor="token">Bot token</label>
        <input
          id="token"
          type="password"
          placeholder="MTAxM..."
          value={tokenInput}
          onChange={(event) => setTokenInput(event.target.value)}
          autoComplete="off"
        />
        {authError && <ErrorMessage message={authError} />}
        <button type="submit" disabled={isAuthenticating}>
          {isAuthenticating ? <LoadingSpinner size="sm" /> : 'Connect'}
        </button>
        <small>
          The application authenticates as a bot and uses the permissions granted to the token.
        </small>
      </form>
    </div>
  );

  const renderUserProfile = () => {
    if (!selectedUser) return null;

    return (
      <div className="modal-overlay" onClick={() => setShowUserProfile(false)}>
        <div className="modal-content user-profile" onClick={(e) => e.stopPropagation()}>
          <header>
            <h2>User Profile</h2>
            <button onClick={() => setShowUserProfile(false)}>×</button>
          </header>
          <div className="profile-content">
            <img src={userAvatarUrl(selectedUser)} alt={selectedUser.username} className="profile-avatar" />
            <h3>{formatUserTag(selectedUser)}</h3>
            <div className="profile-info">
              <p><strong>ID:</strong> {selectedUser.id}</p>
              <p><strong>Username:</strong> {selectedUser.username}</p>
              {selectedUser.global_name && (
                <p><strong>Display Name:</strong> {selectedUser.global_name}</p>
              )}
              <p><strong>Discriminator:</strong> {selectedUser.discriminator}</p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderGuildSettings = () => {
    if (!guildSettings) return null;

    return (
      <div className="modal-overlay" onClick={() => setShowGuildSettings(false)}>
        <div className="modal-content guild-settings" onClick={(e) => e.stopPropagation()}>
          <header>
            <h2>Server Settings</h2>
            <button onClick={() => setShowGuildSettings(false)}>×</button>
          </header>
          <div className="settings-content">
            {guildSettings.icon && (
              <img src={guildIconUrl({ id: selectedGuildId!, name: guildSettings.name, icon: guildSettings.icon })} alt={guildSettings.name} className="guild-icon" />
            )}
            <h3>{guildSettings.name}</h3>
            {guildSettings.description && <p>{guildSettings.description}</p>}
            
            <div className="settings-grid">
              <div className="setting-item">
                <strong>Verification Level:</strong> {guildSettings.verification_level}
              </div>
              <div className="setting-item">
                <strong>MFA Level:</strong> {guildSettings.mfa_level}
              </div>
              <div className="setting-item">
                <strong>Content Filter:</strong> {guildSettings.explicit_content_filter}
              </div>
              <div className="setting-item">
                <strong>Locale:</strong> {guildSettings.preferred_locale}
              </div>
            </div>
            
            {guildSettings.features.length > 0 && (
              <div className="features-list">
                <strong>Features:</strong>
                <ul>
                  {guildSettings.features.map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderSearchResults = () => {
    if (!searchResults || !searchQuery) return null;

    return (
      <div className="search-results">
        <div className="search-header">
          <h3>Search Results for &quot;{searchQuery}&quot;</h3>
          <button onClick={() => setSearchResults(null)}>Clear</button>
        </div>
        <div className="search-messages">
          {searchResults.messages.length === 0 ? (
            <p className="placeholder">No messages found.</p>
          ) : (
            searchResults.messages.map((message) => (
              <div key={message.id} className="search-message-item" onClick={() => {
                // Scroll to message
                const element = document.getElementById(`message-${message.id}`);
                element?.scrollIntoView({ behavior: 'smooth' });
                setSearchResults(null);
              }}>
                <img src={userAvatarUrl(message.author)} alt={message.author.username} className="avatar" />
                <div className="search-message-content">
                  <div className="search-message-header">
                    <strong>{message.author.username}</strong>
                    <span>{formatDate(message.timestamp)}</span>
                  </div>
                  <p>{message.content}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  const renderMessageWithReactions = (message: DiscordMessage) => {
    return (
      <article key={message.id} id={`message-${message.id}`} className="message">
        <img src={userAvatarUrl(message.author)} alt={message.author.username} />
        <div>
          <header>
            <strong 
              className="clickable"
              onClick={() => loadUserProfile(message.author.id)}
            >
              {message.author.global_name ?? message.author.username}
            </strong>
            <span>{formatDate(message.timestamp)}</span>
            {message.edited_timestamp && <span className="edited">(edited)</span>}
          </header>
          <div className="message-content">
            {message.content}
          </div>
          {message.attachments && message.attachments.length > 0 && (
            <div className="message-attachments">
              {message.attachments.map((attachment) => (
                <div key={attachment.id} className="attachment">
                  <a href={attachment.url} target="_blank" rel="noopener noreferrer">
                    📎 {attachment.filename} ({(attachment.size / 1024).toFixed(1)} KB)
                  </a>
                </div>
              ))}
            </div>
          )}
          {message.reactions && message.reactions.length > 0 && (
            <div className="message-reactions">
              {message.reactions.map((reaction, index) => (
                <button
                  key={index}
                  className={`reaction ${reaction.me ? 'reacted' : ''}`}
                  onClick={() => addReaction(message.id, reaction.emoji.name)}
                >
                  {reaction.emoji.name} {reaction.count}
                </button>
              ))}
            </div>
          )}
        </div>
      </article>
    );
  };

  // Main render
  if (!authToken || !botUser) {
    return renderLogin();
  }

  return (
    <div className="enhanced-app">
      {/* Sidebar with servers */}
      <nav className="server-sidebar">
        <div className="server-home">
          <span>🏠</span>
        </div>
        <div className="divider" />
        {guilds.map((guild) => (
          <button
            key={guild.id}
            className={`server-button ${selectedGuildId === guild.id ? 'selected' : ''}`}
            onClick={() => {
              setSelectedGuildId(guild.id);
              setSelectedChannelId(null);
              setMessages([]);
              setSearchResults(null);
            }}
            title={guild.name}
          >
            {guildIconUrl(guild) ? (
              <img src={guildIconUrl(guild)} alt={guild.name} />
            ) : (
              <span>{guild.name[0]}</span>
            )}
          </button>
        ))}
      </nav>

      {/* Channel sidebar */}
      <aside className="channel-sidebar">
        <header>
          <div>
            <strong>{guilds.find(g => g.id === selectedGuildId)?.name ?? 'Direct Messages'}</strong>
            <span>{formatUserTag(botUser)}</span>
          </div>
          <div className="header-actions">
            {selectedGuildId && (
              <button onClick={loadGuildSettings} title="Server Settings">⚙️</button>
            )}
            <button onClick={logout}>Logout</button>
          </div>
        </header>
        
        <SearchBar onSearch={searchMessages} isLoading={isSearching} />
        
        <section className="channel-list">
          {selectedGuildId ? (
            <div className="channels">
              {channels.filter(c => c.type === 0).map((channel) => (
                <button
                  key={channel.id}
                  className={`channel-item ${selectedChannelId === channel.id ? 'active' : ''}`}
                  onClick={() => setSelectedChannelId(channel.id)}
                >
                  # {channel.name}
                </button>
              ))}
            </div>
          ) : (
            <div className="dm-channels">
              {dmChannels.map((channel) => {
                const recipient = channel.recipients?.[0];
                return (
                  <button
                    key={channel.id}
                    className={`dm-item ${selectedChannelId === channel.id ? 'active' : ''}`}
                    onClick={() => setSelectedChannelId(channel.id)}
                  >
                    {recipient && <img src={userAvatarUrl(recipient)} alt={recipient.username} />}
                    <span>{recipient ? formatUserTag(recipient) : 'DM'}</span>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </aside>

      {/* Main chat area */}
      <main className="chat-area">
        <header className="chat-header">
          <h2>
            {selectedChannelId 
              ? `#${channels.find(c => c.id === selectedChannelId)?.name || 'Unknown'}`
              : 'Select a channel'
            }
          </h2>
          {hasMoreMessages && (
            <button 
              onClick={loadMoreMessages} 
              disabled={isLoadingMore}
              className="load-more-btn"
            >
              {isLoadingMore ? <LoadingSpinner size="sm" /> : 'Load More'}
            </button>
          )}
        </header>

        {searchResults && renderSearchResults()}

        <div className="message-container">
          {isLoadingMessages ? (
            <div className="loading-container">
              <LoadingSpinner size="lg" />
              <p>Loading messages...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="placeholder">No messages yet. Start the conversation!</div>
          ) : (
            <div className="message-list">
              {messages.map(renderMessageWithReactions)}
            </div>
          )}
        </div>

        {/* Enhanced message composer */}
        <footer className="enhanced-composer">
          {uploadedFiles.length > 0 && (
            <div className="upload-preview">
              <p>Attached files:</p>
              <ul>
                {uploadedFiles.map((file, index) => (
                  <li key={index}>
                    📎 {file.name} ({(file.size / 1024).toFixed(1)} KB)
                    <button onClick={() => setUploadedFiles(prev => prev.filter((_, i) => i !== index))}>×</button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          <form onSubmit={handleSendMessage} className="message-form">
            <FileUpload 
              onFileSelect={handleFileSelect} 
              disabled={isUploading || !selectedChannelId}
            />
            <textarea
              value={messageInput}
              placeholder={selectedChannelId ? "Type a message..." : "Select a channel first"}
              onChange={(e) => setMessageInput(e.target.value)}
              disabled={!selectedChannelId || isUploading}
              rows={1}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage(e as any);
                }
              }}
            />
            <button 
              type="submit" 
              disabled={!selectedChannelId || (!messageInput.trim() && uploadedFiles.length === 0) || isUploading}
            >
              {isUploading ? <LoadingSpinner size="sm" /> : 'Send'}
            </button>
          </form>
        </footer>
      </main>

      {/* Modals */}
      {showUserProfile && renderUserProfile()}
      {showGuildSettings && renderGuildSettings()}
    </div>
  );
}