'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';

// ============ TYPES ============

type User = {
  id: string;
  username: string;
  discriminator: string;
  global_name?: string;
  avatar?: string | null;
  bot?: boolean;
  public_flags?: number;
  banner?: string | null;
  accent_color?: number | null;
  bio?: string | null;
};

type Guild = {
  id: string;
  name: string;
  icon?: string | null;
  features: string[];
  owner_id?: string;
  verification_level: number;
  preferred_locale: string;
  member_count?: number;
  description?: string | null;
  banner?: string | null;
};

type Channel = {
  id: string;
  name: string;
  type: number;
  position?: number;
  recipients?: User[];
  topic?: string | null;
  nsfw?: boolean;
  parent_id?: string | null;
  rate_limit_per_user?: number;
  last_message_id?: string | null;
};

type Role = {
  id: string;
  name: string;
  color: number;
  position: number;
  permissions?: string;
  hoist?: boolean;
  mentionable?: boolean;
};

type Attachment = {
  id: string;
  filename: string;
  size: number;
  url: string;
  content_type?: string | null;
  width?: number | null;
  height?: number | null;
};

type Embed = {
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
  image?: { url: string };
  thumbnail?: { url: string };
};

type Message = {
  id: string;
  content: string;
  author: User;
  timestamp: string;
  embeds?: Embed[];
  attachments?: Attachment[];
  mentions?: User[];
  reactions?: any[];
  edited_timestamp?: string | null;
  reference?: {
    message_id?: string;
    channel_id?: string;
    guild_id?: string;
  };
};

type Member = {
  user: User;
  nick?: string | null;
  roles: string[];
  joined_at: string;
};

// ============ UTILITY FUNCTIONS ============

const DISCORD_API_BASE = '/api/discord';
const DISCORD_CDN = 'https://cdn.discordapp.com';

function formatUser(user: User) {
  const display = user.global_name || user.username;
  return user.discriminator === '0' ? display : `${display}#${user.discriminator}`;
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

function parseDiscordMarkdown(content: string): React.ReactNode {
  const segments: React.ReactNode[] = [];
  let currentText = content;
  let pos = 0;

  // Escape HTML first
  currentText = escapeHtml(currentText);

  // Parse code blocks (```)
  while (pos < currentText.length) {
    const codeBlockStart = currentText.indexOf('```', pos);
    if (codeBlockStart === -1) {
      // No more code blocks, add remaining text and continue parsing inline markdown
      const remainingText = currentText.slice(pos);
      segments.push(parseInlineMarkdown(remainingText));
      break;
    }

    // Add text before code block
    if (codeBlockStart > pos) {
      segments.push(parseInlineMarkdown(currentText.slice(pos, codeBlockStart)));
    }

    const codeBlockEnd = currentText.indexOf('```', codeBlockStart + 3);
    if (codeBlockEnd === -1) {
      // Unclosed code block, treat rest as code
      segments.push(
        <code className="block bg-gray-900/80 p-4 rounded-lg text-sm font-mono overflow-x-auto my-2 border border-gray-700/50">
          {currentText.slice(codeBlockStart + 3)}
        </code>
      );
      break;
    }

    // Extract language (if any)
    let codeContent = currentText.slice(codeBlockStart + 3, codeBlockEnd);
    let language = '';
    const firstLineEnd = codeContent.indexOf('\n');
    if (firstLineEnd !== -1) {
      const possibleLang = codeContent.slice(0, firstLineEnd).trim();
      if (possibleLang && !possibleLang.includes(' ')) {
        language = possibleLang;
        codeContent = codeContent.slice(firstLineEnd + 1);
      }
    }

    segments.push(
      <div className="my-2">
        {language && (
          <div className="text-xs text-gray-500 mb-1 font-mono px-1">{language}</div>
        )}
        <code className="block bg-gray-900/80 p-4 rounded-lg text-sm font-mono overflow-x-auto border border-gray-700/50">
          {codeContent}
        </code>
      </div>
    );

    pos = codeBlockEnd + 3;
  }

  return <>{segments}</>;
}

function parseInlineMarkdown(text: string): React.ReactNode {
  const segments: React.ReactNode[] = [];
  let currentText = text;
  let pos = 0;

  while (pos < currentText.length) {
    // Find next markdown token
    const boldMatch = currentText.slice(pos).match(/^\*\*([^*]+?)\*\*/);
    const italicMatch = currentText.slice(pos).match(/^(\*|_)([^*_]+?)\1/);
    const underlineMatch = currentText.slice(pos).match(/^__([^_]+?)__/);
    const strikethroughMatch = currentText.slice(pos).match(/^~~([^~]+?)~~/);
    const codeMatch = currentText.slice(pos).match(/^`([^`]+?)`/);
    const spoilerMatch = currentText.slice(pos).match(/^\|\|([^|]+?)\|\|/);
    const linkMatch = currentText.slice(pos).match(/^\[([^\]]+)\]\(([^)]+)\)/);

    const matches = [
      { type: 'bold', match: boldMatch },
      { type: 'italic', match: italicMatch },
      { type: 'underline', match: underlineMatch },
      { type: 'strikethrough', match: strikethroughMatch },
      { type: 'code', match: codeMatch },
      { type: 'spoiler', match: spoilerMatch },
      { type: 'link', match: linkMatch },
    ].filter((m) => m.match);

    if (matches.length === 0) {
      // No more markdown, add remaining text
      const remaining = currentText.slice(pos);
      if (remaining) {
        segments.push(<span>{parseMentions(remaining)}</span>);
      }
      break;
    }

    // Sort by position
    matches.sort((a, b) => {
      const aPos = currentText.slice(pos).indexOf(a.match![0]);
      const bPos = currentText.slice(pos).indexOf(b.match![0]);
      return aPos - bPos;
    });

    const firstMatch = matches[0];
    const fullMatch = firstMatch.match![0];
    const matchPos = currentText.slice(pos).indexOf(fullMatch);

    // Add text before match
    if (matchPos > 0) {
      const beforeText = currentText.slice(pos, pos + matchPos);
      segments.push(<span>{parseMentions(beforeText)}</span>);
    }

    // Process the matched markdown
    const content = firstMatch.match![1] || firstMatch.match![2];
    switch (firstMatch.type) {
      case 'bold':
        segments.push(<strong className="font-bold">{content}</strong>);
        break;
      case 'italic':
        segments.push(<em className="italic">{content}</em>);
        break;
      case 'underline':
        segments.push(<u className="underline">{content}</u>);
        break;
      case 'strikethrough':
        segments.push(<s className="line-through">{content}</s>);
        break;
      case 'code':
        segments.push(
          <code className="bg-gray-700/60 px-1.5 py-0.5 rounded text-sm font-mono text-pink-300">
            {content}
          </code>
        );
        break;
      case 'spoiler':
        segments.push(
          <span className="bg-gray-700/60 px-1.5 py-0.5 rounded cursor-pointer group relative inline-block">
            <span className="invisible group-hover:visible">{content}</span>
            <span className="absolute inset-0 bg-gray-700/80 flex items-center justify-center text-xs text-gray-400 group-hover:hidden">
              SPOILER
            </span>
          </span>
        );
        break;
      case 'link':
        segments.push(
          <a href={content} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
            {firstMatch.match![1]}
          </a>
        );
        break;
    }

    pos += matchPos + fullMatch.length;
  }

  return <>{segments}</>;
}

function parseMentions(text: string): React.ReactNode {
  const segments: React.ReactNode[] = [];
  let pos = 0;

  // Match user mentions <@userid> or <@!userid>
  const userMentionRegex = /<@!?(\d+)>/g;
  // Match role mentions <@&roleid>
  const roleMentionRegex = /<@&(\d+)>/g;
  // Match channel mentions <#channelid>
  const channelMentionRegex = /<#(\d+)>/g;

  // Find all mention positions
  const allMatches: { type: string; id: string; start: number; end: number }[] = [];

  let match;
  while ((match = userMentionRegex.exec(text)) !== null) {
    allMatches.push({ type: 'user', id: match[1], start: match.index, end: match.index + match[0].length });
  }
  userMentionRegex.lastIndex = 0;

  while ((match = roleMentionRegex.exec(text)) !== null) {
    allMatches.push({ type: 'role', id: match[1], start: match.index, end: match.index + match[0].length });
  }
  roleMentionRegex.lastIndex = 0;

  while ((match = channelMentionRegex.exec(text)) !== null) {
    allMatches.push({ type: 'channel', id: match[1], start: match.index, end: match.index + match[0].length });
  }
  channelMentionRegex.lastIndex = 0;

  // Sort by position
  allMatches.sort((a, b) => a.start - b.start);

  // Build segments
  let lastIndex = 0;
  allMatches.forEach((m) => {
    // Add text before mention
    if (m.start > lastIndex) {
      segments.push(<span>{text.slice(lastIndex, m.start)}</span>);
    }

    // Add mention with styling
    if (m.type === 'user') {
      segments.push(
        <span className="mention bg-blue-600/20 text-blue-400 px-1 py-0.5 rounded hover:bg-blue-600/30 transition-colors cursor-pointer">
          @{m.id}
        </span>
      );
    } else if (m.type === 'role') {
      segments.push(
        <span className="mention bg-purple-600/20 text-purple-400 px-1 py-0.5 rounded hover:bg-purple-600/30 transition-colors cursor-pointer">
          @{m.id}
        </span>
      );
    } else if (m.type === 'channel') {
      segments.push(
        <span className="mention bg-green-600/20 text-green-400 px-1 py-0.5 rounded hover:bg-green-600/30 transition-colors cursor-pointer">
          #{m.id}
        </span>
      );
    }

    lastIndex = m.end;
  });

  // Add remaining text
  if (lastIndex < text.length) {
    segments.push(<span>{text.slice(lastIndex)}</span>);
  }

  return segments.length > 0 ? <>{segments}</> : text;
}

function formatDate(timestamp: string) {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(date);
  } else if (days === 1) {
    return (
      'Yesterday ' +
      new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }).format(date)
    );
  } else if (days < 7) {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(date);
  } else {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(date);
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function guildIconUrl(guild: Guild) {
  if (!guild.icon) return '';
  return `${DISCORD_CDN}/icons/${guild.id}/${guild.icon}.png?size=64`;
}

function userAvatarUrl(user: User) {
  if (!user.avatar) {
    const defaultId = Number(BigInt(user.id) >> BigInt(22)) % 6;
    return `${DISCORD_CDN}/embed/avatars/${defaultId}.png?size=128`;
  }
  const ext = user.avatar.startsWith('a_') ? 'gif' : 'png';
  return `${DISCORD_CDN}/avatars/${user.id}/${user.avatar}.${ext}?size=128`;
}

function getChannelTypeIcon(type: number): string {
  const icons: Record<number, string> = {
    0: '#', // Text
    2: '🔊', // Voice
    4: '📁', // Category
    5: '📢', // Announcement
    13: '🎙️', // Stage
    15: '🧵', // Forum
  };
  return icons[type] || '#';
}

function hexToRgb(color: number): string {
  const r = (color >> 16) & 255;
  const g = (color >> 8) & 255;
  const b = color & 255;
  return `${r}, ${g}, ${b}`;
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

// ============ COMPONENTS ============

const Button: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' }
> = ({ children, className = '', variant = 'secondary', ...props }) => {
  const baseClasses =
    'px-4 py-2 rounded-lg font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50';
  const variantClasses = {
    primary:
      'bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg disabled:bg-blue-600/50',
    secondary: 'bg-gray-700/80 hover:bg-gray-600/80 text-gray-100 border border-gray-600/50',
    danger: 'bg-red-600/90 hover:bg-red-700 text-white border border-red-500/50',
  };

  return (
    <button className={`${baseClasses} ${variantClasses[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
};

const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = ({
  className = '',
  ...props
}) => (
  <input
    className={`bg-gray-800/80 border border-gray-600/50 rounded-lg px-4 py-2.5 text-sm text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all ${className}`}
    {...props}
  />
);

const TextArea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement>> = ({
  className = '',
  ...props
}) => (
  <textarea
    className={`bg-gray-800/80 border border-gray-600/50 rounded-lg px-4 py-2.5 text-sm text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 resize-none min-h-[60px] transition-all ${className}`}
    {...props}
  />
);

const Card: React.FC<{ children: React.ReactNode; className?: string; interactive?: boolean }> = ({
  children,
  className = '',
  interactive = false,
}) => (
  <div
    className={`bg-gray-800/60 backdrop-blur-sm border border-gray-700/50 rounded-xl p-6 shadow-lg ${interactive ? 'hover:bg-gray-800/80 hover:border-gray-600/50 transition-all duration-200' : ''} ${className}`}
  >
    {children}
  </div>
);

// ============ MESSAGE COMPONENTS ============

const MessageEmbed: React.FC<{ embed: Embed }> = ({ embed }) => {
  const borderColor = embed.color ? `rgb(${hexToRgb(embed.color)})` : 'rgb(79, 84, 92)';

  return (
    <div
      className="bg-gray-800/60 border-l-4 rounded-lg p-4 my-2 max-w-lg"
      style={{ borderLeftColor: borderColor }}
    >
      {embed.author && (
        <div className="flex items-center gap-2 mb-2">
          {embed.author.icon_url && (
            <img src={embed.author.icon_url} alt="" className="w-6 h-6 rounded-full" />
          )}
          <span className="text-sm font-medium text-gray-200">{embed.author.name}</span>
        </div>
      )}

      {embed.title && (
        <div className="font-semibold text-blue-400 mb-2 hover:underline cursor-pointer">
          {embed.url ? (
            <a href={embed.url} target="_blank" rel="noopener noreferrer">
              {embed.title}
            </a>
          ) : (
            embed.title
          )}
        </div>
      )}

      {embed.description && (
        <div className="text-sm text-gray-300 whitespace-pre-wrap mb-3">{parseDiscordMarkdown(embed.description)}</div>
      )}

      {embed.fields && embed.fields.length > 0 && (
        <div
          className={`grid gap-2 ${embed.fields.some((f) => f.inline) ? 'grid-cols-2' : 'grid-cols-1'}`}
        >
          {embed.fields.map((field, i) => (
            <div key={i} className={field.inline ? 'col-span-1' : 'col-span-2'}>
              <div className="text-sm font-semibold text-gray-200 mb-1">{field.name}</div>
              <div className="text-sm text-gray-400 whitespace-pre-wrap">{parseDiscordMarkdown(field.value)}</div>
            </div>
          ))}
        </div>
      )}

      {embed.image && (
        <img
          src={embed.image.url}
          alt=""
          className="rounded-lg mt-3 max-w-full max-h-80 object-contain"
        />
      )}

      {embed.thumbnail && (
        <img
          src={embed.thumbnail.url}
          alt=""
          className="rounded-lg float-right ml-4 max-w-20 max-h-20 object-contain"
        />
      )}

      {embed.footer && (
        <div className="flex items-center gap-2 mt-3 pt-2 border-t border-gray-700/50">
          {embed.footer.icon_url && (
            <img src={embed.footer.icon_url} alt="" className="w-5 h-5 rounded-full" />
          )}
          <span className="text-xs text-gray-400">{embed.footer.text}</span>
        </div>
      )}
    </div>
  );
};

const MessageAttachment: React.FC<{ attachment: Attachment }> = ({ attachment }) => {
  const isImage = attachment.content_type?.startsWith('image/');
  const isVideo = attachment.content_type?.startsWith('video/');

  if (isImage) {
    return (
      <a href={attachment.url} target="_blank" rel="noopener noreferrer" className="block my-2">
        <img
          src={attachment.url}
          alt={attachment.filename}
          className="rounded-lg max-w-md max-h-96 object-contain cursor-pointer hover:opacity-90 transition-opacity"
        />
      </a>
    );
  }

  if (isVideo) {
    return (
      <video controls className="rounded-lg max-w-md max-h-96 my-2">
        <source src={attachment.url} type={attachment.content_type || 'video/mp4'} />
      </video>
    );
  }

  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 bg-gray-700/60 hover:bg-gray-600/60 px-4 py-2 rounded-lg my-2 transition-colors"
    >
      <span className="text-2xl">📎</span>
      <div className="flex flex-col">
        <span className="text-sm font-medium text-gray-200">{attachment.filename}</span>
        <span className="text-xs text-gray-400">{formatBytes(attachment.size)}</span>
      </div>
    </a>
  );
};

const MessageComponent: React.FC<{
  message: Message;
  currentUser: User | null;
  onEdit?: (message: Message) => void;
  onDelete?: (id: string) => void;
  onUserClick?: (user: User) => void;
}> = ({ message, currentUser, onEdit, onDelete, onUserClick }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isCurrentUser = message.author.id === currentUser?.id;

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
      className="group flex gap-3 px-4 py-2 hover:bg-gray-800/40 transition-colors relative"
    >
      <img
        src={userAvatarUrl(message.author)}
        alt={message.author.username}
        onClick={() => onUserClick?.(message.author)}
        className="w-10 h-10 rounded-full cursor-pointer hover:opacity-80 transition-opacity flex-shrink-0 mt-0.5"
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-1">
          <button
            className={`font-semibold hover:underline cursor-pointer ${
              isCurrentUser ? 'text-green-400' : 'text-gray-100'
            }`}
            onClick={() => onUserClick?.(message.author)}
          >
            {formatUser(message.author)}
          </button>
          {message.author.bot && (
            <span className="text-xs bg-blue-600/80 text-white px-1.5 py-0.5 rounded font-medium">
              BOT
            </span>
          )}
          <span className="text-xs text-gray-500">{formatDate(message.timestamp)}</span>
          {message.edited_timestamp && <span className="text-xs text-gray-500">(edited)</span>}
        </div>

        <div className="relative">
          {isEditing ? (
            <div className="space-y-2">
              <TextArea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={3}
                autoFocus
                className="w-full"
              />
              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setIsEditing(false)}>
                  Cancel
                </Button>
                <Button variant="primary" onClick={handleSaveEdit}>
                  Save
                </Button>
              </div>
            </div>
          ) : (
            <>
              {message.content && (
                <div className="whitespace-pre-wrap break-words text-gray-200 leading-relaxed">
                  {parseDiscordMarkdown(message.content)}
                </div>
              )}

              {message.embeds && message.embeds.length > 0 && (
                <div className="space-y-2">
                  {message.embeds.map((embed, i) => (
                    <MessageEmbed key={i} embed={embed} />
                  ))}
                </div>
              )}

              {message.attachments && message.attachments.length > 0 && (
                <div className="space-y-2">
                  {message.attachments.map((attachment) => (
                    <MessageAttachment key={attachment.id} attachment={attachment} />
                  ))}
                </div>
              )}
            </>
          )}

          <div className="absolute -top-4 right-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="bg-gray-700/90 hover:bg-gray-600 px-2 py-1 rounded text-gray-300 text-sm border border-gray-600/50"
            >
              ⋮
            </button>
          </div>

          {showMenu && (
            <div
              ref={menuRef}
              className="absolute right-0 top-8 w-40 bg-gray-800 border border-gray-600/50 rounded-lg shadow-xl z-20 overflow-hidden"
            >
              {isCurrentUser && (
                <>
                  <button
                    onClick={() => {
                      setIsEditing(true);
                      setShowMenu(false);
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-gray-700 transition-colors flex items-center gap-2"
                  >
                    <span>✏️</span> Edit Message
                  </button>
                  <button
                    onClick={handleDelete}
                    className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-gray-700 transition-colors flex items-center gap-2"
                  >
                    <span>🗑️</span> Delete Message
                  </button>
                </>
              )}
              <button
                onClick={() => {
                  navigator.clipboard.writeText(message.id);
                  setShowMenu(false);
                }}
                className="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-gray-700 transition-colors flex items-center gap-2"
              >
                <span>📋</span> Copy ID
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============ MAIN APP COMPONENT ============

export default function DiscordClient() {
  // Core state
  const [tokenInput, setTokenInput] = useState('');
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [botUser, setBotUser] = useState<User | null>(null);

  // Data state
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [selectedGuildId, setSelectedGuildId] = useState<string | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [members, setMembers] = useState<Member[]>([]);

  // Messages
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState('');

  // UI state
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showChannelInfo, setShowChannelInfo] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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
      const user = await authedFetch<User>(authToken, '/users/@me');
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
      const data = await authedFetch<Guild[]>(authToken, '/users/@me/guilds');
      setGuilds(data);
      if (data.length > 0 && !selectedGuildId) setSelectedGuildId(data[0].id);
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
        authedFetch<Channel[]>(authToken, `/guilds/${selectedGuildId}/channels`),
        authedFetch<Role[]>(authToken, `/guilds/${selectedGuildId}/roles`),
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
      const data = await authedFetch<Message[]>(
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
      const user = await authedFetch<User>(token, '/users/@me');
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
      await authedFetch(authToken, `/channels/${selectedChannelId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content: messageInput }),
      });
      setMessageInput('');
      setTimeout(loadMessages, 300);
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const handleEditMessage = async (message: Message) => {
    if (!authToken || !selectedChannelId) return;
    try {
      await authedFetch(authToken, `/channels/${selectedChannelId}/messages/${message.id}`, {
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
    authedFetch(authToken, `/channels/${selectedChannelId}/messages/${messageId}`, {
      method: 'DELETE',
    })
      .then(loadMessages)
      .catch(console.error);
  };

  const handleUserClick = (user: User) => {
    setSelectedUser(user);
    setShowUserProfile(true);
  };

  // Login Screen
  if (!authToken || !botUser) {
    return (
      <div className="fixed inset-0 flex items-center justify-center p-6 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
        <Card className="w-full max-w-md shadow-2xl">
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-4xl shadow-lg">
              🤖
            </div>
          </div>
          <h1 className="text-3xl font-bold text-center mb-2 text-gray-100">BotClienty</h1>
          <p className="text-gray-400 text-center mb-8">Discord Bot Web Client</p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-200">Bot Token</label>
              <Input
                type="password"
                placeholder="Enter your Discord bot token"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                autoFocus
              />
            </div>

            {authError && (
              <div className="bg-red-500/10 border border-red-500/50 p-3 rounded-lg">
                <p className="text-red-400 text-sm flex items-center gap-2">
                  <span>⚠️</span> {authError}
                </p>
              </div>
            )}

            <Button type="submit" variant="primary" className="w-full" disabled={isAuthenticating}>
              {isAuthenticating ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Authenticating...
                </span>
              ) : (
                'Connect Bot'
              )}
            </Button>
          </form>

          <div className="mt-8 pt-6 border-t border-gray-700/50">
            <h3 className="font-semibold mb-3 text-gray-200">Features</h3>
            <div className="space-y-2 text-sm text-gray-400">
              <div className="flex items-center gap-2">
                <span className="text-blue-400">✓</span> View all servers and channels
              </div>
              <div className="flex items-center gap-2">
                <span className="text-blue-400">✓</span> Send and receive messages
              </div>
              <div className="flex items-center gap-2">
                <span className="text-blue-400">✓</span> Rich embeds and attachments
              </div>
              <div className="flex items-center gap-2">
                <span className="text-blue-400">✓</span> Edit and delete messages
              </div>
              <div className="flex items-center gap-2">
                <span className="text-blue-400">✓</span> User profiles and details
              </div>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  const selectedGuild = guilds.find((g) => g.id === selectedGuildId);
  const selectedChannel = channels.find((c) => c.id === selectedChannelId);
  const textChannels = channels.filter((c) => c.type === 0);
  const voiceChannels = channels.filter((c) => c.type === 2);
  const categories = channels.filter((c) => c.type === 4);

  return (
    <div className="flex h-screen bg-gray-900 text-gray-100">
      {/* Server Sidebar */}
      <nav className="w-20 bg-gray-900 border-r border-gray-800 flex flex-col items-center py-4 gap-2 overflow-y-auto">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-xl transition-all hover:rounded-lg cursor-pointer shadow-lg">
          🏠
        </div>
        <div className="w-10 h-0.5 bg-gray-700 rounded-full my-1" />
        {guilds.map((guild) => (
          <button
            key={guild.id}
            onClick={() => {
              setSelectedGuildId(guild.id);
              setSelectedChannelId(null);
              setMessages([]);
            }}
            className={`w-12 h-12 rounded-2xl overflow-hidden flex items-center justify-center transition-all hover:rounded-lg shadow-md ${
              selectedGuildId === guild.id ? 'ring-2 ring-blue-500 rounded-lg' : ''
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
              <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center">
                <span className="font-bold text-sm">{guild.name.charAt(0)}</span>
              </div>
            )}
          </button>
        ))}
      </nav>

      {/* Channel Sidebar */}
      <aside className="w-60 bg-gray-800/60 border-r border-gray-700/50 flex flex-col">
        <header className="p-4 border-b border-gray-700/50 bg-gray-800/40">
          <h2 className="font-bold text-base truncate text-gray-100">
            {selectedGuild?.name || 'BotClienty'}
          </h2>
          {selectedGuild?.description && (
            <p className="text-xs text-gray-400 truncate mt-1">{selectedGuild.description}</p>
          )}
        </header>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {textChannels.length > 0 && (
            <div className="mb-4">
              <div className="text-xs font-semibold text-gray-400 uppercase px-2 mb-1 flex items-center gap-1">
                <span>Text Channels</span>
                <span className="text-gray-500">({textChannels.length})</span>
              </div>
              {textChannels.map((channel) => (
                <button
                  key={channel.id}
                  onClick={() => setSelectedChannelId(channel.id)}
                  className={`w-full text-left px-2 py-1.5 rounded hover:bg-gray-700/50 transition-colors flex items-center gap-2 group ${
                    selectedChannelId === channel.id
                      ? 'bg-gray-700/70 text-gray-100'
                      : 'text-gray-400'
                  }`}
                >
                  <span className="text-sm">{getChannelTypeIcon(channel.type)}</span>
                  <span className="text-sm truncate flex-1">{channel.name}</span>
                  {channel.nsfw && <span className="text-xs bg-red-600/80 px-1 rounded">NSFW</span>}
                </button>
              ))}
            </div>
          )}

          {voiceChannels.length > 0 && (
            <div className="mb-4">
              <div className="text-xs font-semibold text-gray-400 uppercase px-2 mb-1 flex items-center gap-1">
                <span>Voice Channels</span>
                <span className="text-gray-500">({voiceChannels.length})</span>
              </div>
              {voiceChannels.map((channel) => (
                <div
                  key={channel.id}
                  className="px-2 py-1.5 rounded text-gray-400 flex items-center gap-2 text-sm"
                >
                  <span className="text-sm">{getChannelTypeIcon(channel.type)}</span>
                  <span className="text-sm truncate">{channel.name}</span>
                </div>
              ))}
            </div>
          )}

          {channels.filter((c) => c.type === 0).length === 0 && !isLoading && (
            <p className="text-gray-500 text-sm px-2 py-4">No channels available</p>
          )}
        </div>

        <div className="p-3 border-t border-gray-700/50 bg-gray-800/40">
          <div className="flex items-center gap-3 mb-3">
            <img
              src={userAvatarUrl(botUser)}
              alt={botUser.username}
              className="w-8 h-8 rounded-full"
            />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm text-gray-100 truncate">
                {botUser.global_name || botUser.username}
              </p>
              <p className="text-xs text-gray-400 truncate">#{botUser.discriminator}</p>
            </div>
          </div>
          <Button variant="danger" className="w-full text-sm py-2" onClick={handleLogout}>
            Logout
          </Button>
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col bg-gray-900/50">
        {/* Chat Header */}
        <header className="px-4 py-3 border-b border-gray-700/50 bg-gray-800/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-gray-400">
              {selectedChannel ? getChannelTypeIcon(selectedChannel.type) : '#'}
            </span>
            <h1 className="text-lg font-semibold text-gray-100">
              {selectedChannel?.name || 'Select a channel'}
            </h1>
            {selectedChannel?.nsfw && (
              <span className="text-xs bg-red-600/80 text-white px-2 py-0.5 rounded font-medium">
                NSFW
              </span>
            )}
          </div>
          {selectedChannel && (
            <button
              onClick={() => setShowChannelInfo(!showChannelInfo)}
              className="text-gray-400 hover:text-gray-200 transition-colors"
              title="Channel Info"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </button>
          )}
        </header>

        {selectedChannel?.topic && (
          <div className="px-4 py-2 bg-gray-800/30 border-b border-gray-700/50">
            <p className="text-sm text-gray-400">{selectedChannel.topic}</p>
          </div>
        )}

        {/* Messages Container */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center items-center h-full">
              <div className="text-center">
                <div className="w-12 h-12 border-4 border-gray-700 border-t-blue-500 rounded-full animate-spin mx-auto mb-4" />
                <p className="text-gray-400">Loading messages...</p>
              </div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center max-w-md">
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gray-800/60 flex items-center justify-center text-4xl">
                  💬
                </div>
                <h3 className="text-xl font-semibold mb-2 text-gray-200">No messages yet</h3>
                <p className="text-gray-400">Be the first to send a message in this channel!</p>
              </div>
            </div>
          ) : (
            <div className="py-4">
              {messages.map((message) => (
                <MessageComponent
                  key={message.id}
                  message={message}
                  currentUser={botUser}
                  onEdit={handleEditMessage}
                  onDelete={handleDeleteMessage}
                  onUserClick={handleUserClick}
                />
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Message Composer */}
        <footer className="p-4 border-t border-gray-700/50 bg-gray-800/40">
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <TextArea
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              placeholder={
                selectedChannelId
                  ? `Message #${selectedChannel?.name || 'channel'}`
                  : 'Select a channel first'
              }
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage(e);
                }
              }}
              className="flex-1"
              disabled={!selectedChannelId}
              rows={1}
            />

            <Button
              type="submit"
              variant="primary"
              disabled={!selectedChannelId || !messageInput.trim() || isLoading}
              className="px-6"
            >
              Send
            </Button>
          </form>
        </footer>
      </main>

      {/* Right Sidebar - Channel Info */}
      {showChannelInfo && selectedChannel && (
        <aside className="w-64 bg-gray-800/60 border-l border-gray-700/50 p-4 overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-100">Channel Info</h3>
            <button
              onClick={() => setShowChannelInfo(false)}
              className="text-gray-400 hover:text-gray-200"
            >
              ✕
            </button>
          </div>

          <div className="space-y-4">
            <div className="bg-gray-700/40 rounded-lg p-3">
              <div className="text-xs text-gray-400 mb-1">Name</div>
              <div className="text-sm font-medium text-gray-200 flex items-center gap-2">
                <span>{getChannelTypeIcon(selectedChannel.type)}</span>
                {selectedChannel.name}
              </div>
            </div>

            <div className="bg-gray-700/40 rounded-lg p-3">
              <div className="text-xs text-gray-400 mb-1">Channel ID</div>
              <div className="text-xs font-mono text-gray-300 flex items-center gap-2">
                <span className="flex-1 truncate">{selectedChannel.id}</span>
                <button
                  onClick={() => navigator.clipboard.writeText(selectedChannel.id)}
                  className="text-blue-400 hover:text-blue-300"
                  title="Copy ID"
                >
                  📋
                </button>
              </div>
            </div>

            {selectedChannel.topic && (
              <div className="bg-gray-700/40 rounded-lg p-3">
                <div className="text-xs text-gray-400 mb-1">Topic</div>
                <div className="text-sm text-gray-300">{selectedChannel.topic}</div>
              </div>
            )}

            {selectedChannel.rate_limit_per_user !== undefined &&
              selectedChannel.rate_limit_per_user > 0 && (
                <div className="bg-gray-700/40 rounded-lg p-3">
                  <div className="text-xs text-gray-400 mb-1">Slowmode</div>
                  <div className="text-sm text-gray-300">
                    {selectedChannel.rate_limit_per_user}s
                  </div>
                </div>
              )}

            <div className="bg-gray-700/40 rounded-lg p-3">
              <div className="text-xs text-gray-400 mb-1">Messages</div>
              <div className="text-sm font-medium text-gray-200">{messages.length}</div>
            </div>

            {roles.length > 0 && (
              <div>
                <div className="text-xs text-gray-400 mb-2">Server Roles ({roles.length})</div>
                <div className="space-y-1 max-h-60 overflow-y-auto">
                  {roles
                    .sort((a, b) => b.position - a.position)
                    .map((role) => (
                      <div
                        key={role.id}
                        className="bg-gray-700/40 rounded px-2 py-1.5 text-xs flex items-center gap-2"
                      >
                        {role.color !== 0 && (
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{
                              backgroundColor: `#${role.color.toString(16).padStart(6, '0')}`,
                            }}
                          />
                        )}
                        <span className="text-gray-300 truncate">{role.name}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </aside>
      )}

      {/* User Profile Modal */}
      {showUserProfile && selectedUser && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowUserProfile(false)}
        >
          <div
            className="bg-gray-800 border border-gray-700 rounded-2xl max-w-lg w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-100">User Profile</h2>
                <button
                  onClick={() => setShowUserProfile(false)}
                  className="text-gray-400 hover:text-gray-200 text-2xl"
                >
                  ✕
                </button>
              </div>

              <div className="flex gap-4 mb-6">
                <img
                  src={userAvatarUrl(selectedUser)}
                  alt={selectedUser.username}
                  className="w-24 h-24 rounded-full shadow-lg"
                />
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-100">{formatUser(selectedUser)}</h3>
                  <p className="text-gray-400 text-sm mb-2">@{selectedUser.username}</p>
                  {selectedUser.bot && (
                    <span className="inline-block text-xs bg-blue-600/80 text-white px-2 py-1 rounded font-medium">
                      BOT
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <div className="bg-gray-700/40 rounded-lg p-3">
                  <div className="text-xs text-gray-400 mb-1">User ID</div>
                  <div className="text-sm font-mono text-gray-300 flex items-center justify-between">
                    <span>{selectedUser.id}</span>
                    <button
                      onClick={() => navigator.clipboard.writeText(selectedUser.id)}
                      className="text-blue-400 hover:text-blue-300 text-xs"
                    >
                      Copy
                    </button>
                  </div>
                </div>

                {selectedUser.bio && (
                  <div className="bg-gray-700/40 rounded-lg p-3">
                    <div className="text-xs text-gray-400 mb-1">About Me</div>
                    <div className="text-sm text-gray-300">{selectedUser.bio}</div>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    className="flex-1"
                    onClick={() => setShowUserProfile(false)}
                  >
                    Close
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
