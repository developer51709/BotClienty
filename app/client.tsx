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
  reactions?: Reaction[];
  edited_timestamp?: string | null;
  reference?: {
    message_id?: string;
    channel_id?: string;
    guild_id?: string;
  };
};

type Reaction = {
  emoji: {
    id: string | null;
    name: string;
    animated?: boolean;
  };
  count: number;
  me: boolean;
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

function decodeHtmlEntities(text: string): string {
  const map: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#039;': "'",
    '&apos;': "'",
  };
  return text.replace(/&amp;|&lt;|&gt;|&quot;|&#039;|&apos;/g, (m) => map[m]);
}

function parseDiscordMarkdown(content: string): React.ReactNode {
  if (!content) return null;
  
  // 1. Decode entities
  let text = decodeHtmlEntities(content);

  // 2. Split by lines to handle block elements
  const lines = text.split('\n');
  const result: React.ReactNode[] = [];
  
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Code blocks
    if (line.trim().startsWith('```')) {
      const lang = line.trim().slice(3).trim();
      let codeContent = '';
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeContent += (codeContent ? '\n' : '') + lines[i];
        i++;
      }
      result.push(
        <div key={`cb-${i}`} className="my-2">
          {lang && (
            <div className="text-xs text-[#949ba4] mb-1 font-mono px-1">{lang}</div>
          )}
          <code className="block bg-[#1e1f22] p-4 rounded-lg text-sm font-mono overflow-x-auto border border-[#1e1f22]">
            {codeContent}
          </code>
        </div>
      );
      i++;
      continue;
    }

    // Headers
    const headerMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headerMatch) {
      const level = headerMatch[1].length;
      const title = headerMatch[2];
      const classes = [
        '',
        'text-2xl font-bold mt-4 mb-2 border-b border-[#3f4147] pb-1',
        'text-xl font-bold mt-3 mb-1',
        'text-lg font-bold mt-2 mb-1'
      ][level];
      const Tag = (level === 1 ? 'h1' : level === 2 ? 'h2' : 'h3') as any;
      result.push(<Tag key={`h-${i}`} className={`${classes} text-white`}>{parseInlineMarkdown(title)}</Tag>);
      i++;
      continue;
    }

    // Blockquotes
    if (line.startsWith('> ')) {
      let quoteLines = [line.slice(2)];
      i++;
      while (i < lines.length && lines[i].startsWith('> ')) {
        quoteLines.push(lines[i].slice(2));
        i++;
      }
      result.push(
        <blockquote key={`bq-${i}`} className="border-l-4 border-[#4e5058] pl-4 my-1 text-[#dbdee1] italic bg-[#35363c]/30 py-1 rounded-r">
          {quoteLines.map((ql, idx) => (
            <div key={idx}>{parseInlineMarkdown(ql)}</div>
          ))}
        </blockquote>
      );
      continue;
    }

    // List items
    const listMatch = line.match(/^(\s*)([-*]|\d+\.)\s+(.+)$/);
    if (listMatch) {
      const indent = listMatch[1].length;
      const content = listMatch[3];
      result.push(
        <div key={`li-${i}`} className="flex gap-2 my-0.5" style={{ marginLeft: `${indent * 0.5 + 1}rem` }}>
          <span className="text-[#949ba4] mt-1.5 w-1.5 h-1.5 rounded-full bg-[#949ba4] flex-shrink-0" />
          <span className="text-[#dbdee1]">{parseInlineMarkdown(content)}</span>
        </div>
      );
      i++;
      continue;
    }

    // Regular line
    if (line.trim() === '') {
      result.push(<div key={`br-${i}`} className="h-2" />);
    } else {
      result.push(<div key={`p-${i}`} className="min-h-[1.375rem]">{parseInlineMarkdown(line)}</div>);
    }
    i++;
  }

  return <>{result}</>;
}

function parseInlineMarkdown(text: string): React.ReactNode {
  if (!text) return null;
  const segments: React.ReactNode[] = [];
  let pos = 0;

  while (pos < text.length) {
    const remaining = text.slice(pos);

    // Custom Emoji: <a:name:id> or <:name:id>
    const emojiMatch = remaining.match(/^<(a?):(\w+):(\d+)>/);
    if (emojiMatch) {
      const isAnimated = emojiMatch[1] === 'a';
      const name = emojiMatch[2];
      const id = emojiMatch[3];
      const ext = isAnimated ? 'gif' : 'png';
      const url = `https://cdn.discordapp.com/emojis/${id}.${ext}?size=48&quality=lossless`;
      
      segments.push(
        <img
          key={`emoji-${pos}`}
          src={url}
          alt={`:${name}:`}
          title={`:${name}:`}
          className="inline-block w-[22px] h-[22px] align-bottom mx-0.5"
        />
      );
      pos += emojiMatch[0].length;
      continue;
    }

    // Bold
    const boldMatch = remaining.match(/^\*\*([^*]+?)\*\*/);
    if (boldMatch) {
      segments.push(<strong key={pos} className="font-bold text-white">{parseInlineMarkdown(boldMatch[1])}</strong>);
      pos += boldMatch[0].length;
      continue;
    }

    // Underline
    const underlineMatch = remaining.match(/^__([^_]+?)__/);
    if (underlineMatch) {
      segments.push(<u key={pos} className="underline">{parseInlineMarkdown(underlineMatch[1])}</u>);
      pos += underlineMatch[0].length;
      continue;
    }

    // Italic
    const italicMatch = remaining.match(/^(\*|_)([^*_]+?)\1/);
    if (italicMatch) {
      segments.push(<em key={pos} className="italic">{parseInlineMarkdown(italicMatch[2])}</em>);
      pos += italicMatch[0].length;
      continue;
    }

    // Strikethrough
    const strikethroughMatch = remaining.match(/^~~([^~]+?)~~/);
    if (strikethroughMatch) {
      segments.push(<s key={pos} className="line-through text-[#949ba4]">{parseInlineMarkdown(strikethroughMatch[1])}</s>);
      pos += strikethroughMatch[0].length;
      continue;
    }

    // Code
    const codeMatch = remaining.match(/^`([^`]+?)`/);
    if (codeMatch) {
      segments.push(
        <code key={pos} className="bg-[#1e1f22] px-1 py-0.5 rounded text-[14px] font-mono text-[#e3e5e8]">
          {codeMatch[1]}
        </code>
      );
      pos += codeMatch[0].length;
      continue;
    }

    // Spoiler
    const spoilerMatch = remaining.match(/^\|\|([^|]+?)\|\|/);
    if (spoilerMatch) {
      segments.push(
        <span
          key={pos}
          className="bg-[#1e1f22] hover:bg-[#2b2d31] rounded px-1 cursor-pointer transition-colors group relative inline-block min-w-[20px]"
          onClick={(e) => {
            const target = e.currentTarget;
            target.classList.remove('bg-[#1e1f22]');
            const content = target.querySelector('.spoiler-content');
            const hint = target.querySelector('.spoiler-hint');
            if (content) content.classList.remove('opacity-0');
            if (hint) hint.classList.add('hidden');
          }}
        >
          <span className="spoiler-content opacity-0 transition-opacity duration-200">
            {parseInlineMarkdown(spoilerMatch[1])}
          </span>
          <span className="spoiler-hint absolute inset-0 flex items-center justify-center text-[10px] font-bold text-[#b5bac1] uppercase tracking-wider">
            Spoiler
          </span>
        </span>
      );
      pos += spoilerMatch[0].length;
      continue;
    }

    // Mentions
    const userMention = remaining.match(/^<@!?(\d+)>/);
    if (userMention) {
      segments.push(
        <span key={pos} className="bg-[#5865f2]/30 text-[#c9cdfb] px-1 rounded font-medium hover:bg-[#5865f2] hover:text-white transition-colors cursor-pointer">
          @{userMention[1]}
        </span>
      );
      pos += userMention[0].length;
      continue;
    }

    const roleMention = remaining.match(/^<@&(\d+)>/);
    if (roleMention) {
      segments.push(
        <span key={pos} className="bg-[#5865f2]/30 text-[#c9cdfb] px-1 rounded font-medium hover:bg-[#5865f2] hover:text-white transition-colors cursor-pointer">
          @role-{roleMention[1]}
        </span>
      );
      pos += roleMention[0].length;
      continue;
    }

    const channelMention = remaining.match(/^<#(\d+)>/);
    if (channelMention) {
      segments.push(
        <span key={pos} className="bg-[#5865f2]/30 text-[#c9cdfb] px-1 rounded font-medium hover:bg-[#5865f2] hover:text-white transition-colors cursor-pointer">
          #channel-{channelMention[1]}
        </span>
      );
      pos += channelMention[0].length;
      continue;
    }

    // Link
    const linkMatch = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/);
    if (linkMatch) {
      segments.push(
        <a key={pos} href={linkMatch[2]} target="_blank" rel="noopener noreferrer" className="text-[#00a8fc] hover:underline">
          {linkMatch[1]}
        </a>
      );
      pos += linkMatch[0].length;
      continue;
    }
    
    // Fallback to plain text
    segments.push(<span key={pos}>{remaining[0]}</span>);
    pos += 1;
  }

  return <>{segments}</>;
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

function formatFullDate(timestamp: string): string {
  const date = new Date(timestamp);
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
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

const MessageReaction: React.FC<{ reaction: Reaction; onAddReaction?: () => void }> = ({ reaction, onAddReaction }) => {
  return (
    <button
      onClick={onAddReaction}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-sm ${
        reaction.me
          ? 'bg-[#5865f2]/30 border border-[#5865f2] text-white'
          : 'bg-[#2b2d31] hover:bg-[#35363c] border border-[#3f4147] text-[#dbdee1]'
      } transition-colors`}
    >
      <span className="text-base">{reaction.emoji.id ? `✨` : reaction.emoji.name}</span>
      <span className="text-xs font-medium">{reaction.count}</span>
    </button>
  );
};

const MessageComponent: React.FC<{
  message: Message;
  currentUser: User | null;
  onEdit?: (message: Message) => void;
  onDelete?: (id: string) => void;
  onUserClick?: (user: User) => void;
  showHeader?: boolean;
  onAddReaction?: (messageId: string, emoji: string) => void;
}> = ({ message, currentUser, onEdit, onDelete, onUserClick, showHeader = true, onAddReaction }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [showMenu, setShowMenu] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const reactionPickerRef = useRef<HTMLDivElement>(null);

  const isCurrentUser = message.author.id === currentUser?.id;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
      if (reactionPickerRef.current && !reactionPickerRef.current.contains(e.target as Node)) {
        setShowReactionPicker(false);
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

  const handleAddReaction = (emoji: string) => {
    onAddReaction?.(message.id, emoji);
    setShowReactionPicker(false);
  };

  return (
    <div
      id={`message-${message.id}`}
      className={`group flex gap-2 px-4 py-0.5 hover:bg-[#2e3035] transition-colors relative ${showHeader ? 'mt-[17px]' : 'mt-[0.05px]'}`}
    >
      {showHeader && (
        <div className="relative flex-shrink-0">
          <img
            src={userAvatarUrl(message.author)}
            alt={message.author.username}
            onClick={() => onUserClick?.(message.author)}
            className="w-10 h-10 rounded-full cursor-pointer hover:opacity-80 transition-opacity mt-0.5"
          />
          <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-[#23a559] border-[3px] border-[#313338] rounded-full" />
        </div>
      )}

      <div className={`flex-1 min-w-0 ${showHeader ? 'pt-[2px]' : ''}`}>
        {showHeader && (
          <div className="flex items-center gap-2 leading-[22px]">
            <button
              className={`font-medium text-[15px] hover:underline cursor-pointer ${
                isCurrentUser ? 'text-[#00a8fc]' : 'text-[#f2f3f5]'
              }`}
              onClick={() => onUserClick?.(message.author)}
            >
              {formatUser(message.author)}
            </button>
            {message.author.bot && (
              <span className="text-[10px] bg-[#5865f2] text-white px-1 py-0.5 rounded font-semibold uppercase">
                Bot
              </span>
            )}
            <span className="text-xs text-[#949ba4] font-medium" title={formatFullDate(message.timestamp)}>
              {formatDate(message.timestamp)}
            </span>
            {message.edited_timestamp && (
              <span className="text-[10px] text-[#949ba4]">(edited)</span>
            )}
          </div>
        )}

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
                <div className="whitespace-pre-wrap break-words text-[#dbdee1] text-[15px] leading-[1.375rem]">
                  {parseDiscordMarkdown(message.content)}
                </div>
              )}

              {message.embeds && message.embeds.length > 0 && (
                <div className="space-y-2 mt-2">
                  {message.embeds.map((embed, i) => (
                    <MessageEmbed key={i} embed={embed} />
                  ))}
                </div>
              )}

              {message.attachments && message.attachments.length > 0 && (
                <div className="space-y-2 mt-2">
                  {message.attachments.map((attachment) => (
                    <MessageAttachment key={attachment.id} attachment={attachment} />
                  ))}
                </div>
              )}

              {message.reactions && message.reactions.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {message.reactions.map((reaction, i) => (
                    <MessageReaction
                      key={i}
                      reaction={reaction}
                      onAddReaction={() => handleAddReaction(reaction.emoji.name)}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          <div className="absolute -top-4 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center">
            <div className="bg-[#2b2d31] border border-[#1e1f22] rounded shadow-lg flex items-center divide-x divide-[#1e1f22]">
              <button
                onClick={() => setShowReactionPicker(!showReactionPicker)}
                className="px-2 py-1 hover:bg-[#35363c] transition-colors"
                title="Add reaction"
              >
                <svg className="w-4 h-4 text-[#b5bac1]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0a12 12 0 1 0 0 24 12 12 0 0 0 0-24zm0 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20zM7.5 9.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm9 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM12 17.5c-2.33 0-4.32-1.45-5.12-3.5h10.24c-.8 2.05-2.79 3.5-5.12 3.5z" />
                </svg>
              </button>
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="px-2 py-1 hover:bg-[#35363c] transition-colors"
                title="More"
              >
                <svg className="w-4 h-4 text-[#b5bac1]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                </svg>
              </button>
            </div>

            {showReactionPicker && (
              <div
                ref={reactionPickerRef}
                className="absolute right-0 top-6 bg-[#2b2d31] border border-[#1e1f22] rounded-lg shadow-xl p-2 grid grid-cols-6 gap-1 z-30"
              >
                {['😀', '😂', '😍', '👍', '👎', '❤️', '🔥', '🎉', '🎊', '💯', '✨', '💪'].map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => handleAddReaction(emoji)}
                    className="w-8 h-8 hover:bg-[#35363c] rounded transition-colors text-xl"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>

          {showMenu && (
            <div
              ref={menuRef}
              className="absolute right-0 top-6 w-44 bg-[#111214] rounded-md shadow-xl z-20 overflow-hidden py-1.5"
            >
              {isCurrentUser && (
                <>
                  <button
                    onClick={() => {
                      setIsEditing(true);
                      setShowMenu(false);
                    }}
                    className="w-full text-left px-2 py-1.5 text-sm text-[#dbdee1] hover:bg-[#5865f2] hover:text-white transition-colors flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
                    </svg>
                    Edit Message
                  </button>
                  <button
                    onClick={handleDelete}
                    className="w-full text-left px-2 py-1.5 text-sm text-[#f23f43] hover:bg-[#f23f43] hover:text-white transition-colors flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                    </svg>
                    Delete Message
                  </button>
                  <div className="h-px bg-[#4e5058] my-1" />
                </>
              )}
              <button
                onClick={() => {
                  navigator.clipboard.writeText(message.id);
                  setShowMenu(false);
                }}
                className="w-full text-left px-2 py-1.5 text-sm text-[#dbdee1] hover:bg-[#5865f2] hover:text-white transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" />
                </svg>
                Copy Message ID
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============ TOAST COMPONENT ============

const Toast: React.FC<{
  message: string;
  type?: 'success' | 'error' | 'info';
  onClose: () => void;
}> = ({ message, type = 'info', onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bgColors = {
    success: 'bg-[#23a559]',
    error: 'bg-[#f23f43]',
    info: 'bg-[#5865f2]',
  };

  return (
    <div className={`fixed bottom-4 right-4 ${bgColors[type]} text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 animate-slide-in z-50`}>
      {type === 'success' && (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
        </svg>
      )}
      {type === 'error' && (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
        </svg>
      )}
      <span className="font-medium">{message}</span>
      <button onClick={onClose} className="hover:bg-white/20 rounded p-0.5 transition-colors">
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
        </svg>
      </button>
    </div>
  );
};

// ============ QUICK SWITCHER COMPONENT ============

const QuickSwitcher: React.FC<{
  channels: Channel[];
  guilds: Guild[];
  onSelect: (type: 'channel' | 'guild', id: string) => void;
  onClose: () => void;
}> = ({ channels, guilds, onSelect, onClose }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const filteredChannels = channels.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredGuilds = guilds.filter((g) =>
    g.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center pt-[15vh] z-50">
      <div className="bg-[#2b2d31] rounded-lg shadow-2xl w-[440px] max-h-[420px] flex flex-col animate-scale-in">
        <div className="p-4 border-b border-[#1e1f22]">
          <input
            ref={inputRef}
            type="text"
            placeholder="Jump to..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose();
            }}
            className="w-full bg-[#1e1f22] text-white px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-[#5865f2]"
          />
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {searchQuery && filteredGuilds.length > 0 && (
            <div className="mb-2">
              <div className="text-xs font-semibold text-[#949ba4] uppercase px-2 mb-1">Servers</div>
              {filteredGuilds.slice(0, 5).map((guild) => (
                <button
                  key={guild.id}
                  onClick={() => onSelect('guild', guild.id)}
                  className="w-full text-left px-2 py-1.5 rounded hover:bg-[#35363c] text-[#dbdee1] flex items-center gap-2"
                >
                  {guild.icon ? (
                    <img src={guildIconUrl(guild)} alt="" className="w-5 h-5 rounded-full" />
                  ) : (
                    <div className="w-5 h-5 rounded bg-[#5865f2] flex items-center justify-center text-xs">
                      {guild.name.charAt(0)}
                    </div>
                  )}
                  <span>{guild.name}</span>
                </button>
              ))}
            </div>
          )}
          {searchQuery && filteredChannels.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-[#949ba4] uppercase px-2 mb-1">Channels</div>
              {filteredChannels.slice(0, 5).map((channel) => (
                <button
                  key={channel.id}
                  onClick={() => onSelect('channel', channel.id)}
                  className="w-full text-left px-2 py-1.5 rounded hover:bg-[#35363c] text-[#dbdee1] flex items-center gap-2"
                >
                  <span className="text-[#949ba4]">{getChannelTypeIcon(channel.type)}</span>
                  <span>{channel.name}</span>
                </button>
              ))}
            </div>
          )}
          {!searchQuery && (
            <div className="text-center py-8 text-[#949ba4] text-sm">
              Type to search channels and servers...
            </div>
          )}
          {searchQuery && filteredChannels.length === 0 && filteredGuilds.length === 0 && (
            <div className="text-center py-8 text-[#949ba4] text-sm">No results found</div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============ USER SEARCH MODAL ============

const UserSearchModal: React.FC<{
  users: User[];
  onUserClick: (user: User) => void;
  onClose: () => void;
}> = ({ users, onUserClick, onClose }) => {
  const [query, setQuery] = useState('');

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#2b2d31] border border-[#1e1f22] rounded-lg shadow-2xl max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-[#1e1f22]">
          <h2 className="text-xl font-bold text-white mb-4">Search Users</h2>
          <input
            type="text"
            placeholder="Search users..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            className="w-full bg-[#1e1f22] text-[#dbdee1] placeholder-[#87898c] px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5865f2]"
          />
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {users.length === 0 ? (
            <div className="text-center py-8 text-[#949ba4]">No users found</div>
          ) : (
            users.map((user) => (
              <button
                key={user.id}
                onClick={() => onUserClick(user)}
                className="w-full text-left px-4 py-3 rounded-lg hover:bg-[#35363c] transition-colors flex items-center gap-3"
              >
                <img src={userAvatarUrl(user)} alt="" className="w-10 h-10 rounded-full" />
                <div className="flex-1">
                  <div className="font-semibold text-[#f2f3f5]">{formatUser(user)}</div>
                  <div className="text-sm text-[#949ba4]">@{user.username}</div>
                </div>
                {user.bot && (
                  <span className="text-xs bg-[#5865f2] text-white px-2 py-1 rounded font-bold">BOT</span>
                )}
              </button>
            ))
          )}
        </div>
        <div className="p-4 border-t border-[#1e1f22] flex justify-end">
          <Button onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
};

// ============ CREATE SERVER MODAL ============

const CreateServerModal: React.FC<{
  onClose: () => void;
  onCreate: (name: string, icon: File | null) => void;
}> = ({ onClose, onCreate }) => {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState<File | null>(null);
  const [iconPreview, setIconPreview] = useState<string>('');

  const handleIconChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIcon(file);
      setIconPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onCreate(name.trim(), icon);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#2b2d31] border border-[#1e1f22] rounded-lg shadow-2xl max-w-md w-full animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="p-4">
          <h2 className="text-xl font-bold text-white mb-6">Create Server</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-[#b5bac1] mb-2">Server Icon</label>
              <div className="flex items-center gap-4">
                <div
                  className="w-20 h-20 rounded-full bg-[#35363c] flex items-center justify-center cursor-pointer hover:bg-[#404249] transition-colors relative overflow-hidden group"
                  onClick={() => document.getElementById('server-icon-input')?.click()}
                >
                  {iconPreview ? (
                    <img src={iconPreview} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <svg className="w-10 h-10 text-[#949ba4]" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M19 13h-6v6h-2v-6h-2v-2h6v2zM7 9c-1.1 0-2 .9-2 2v2h-2c0 1.1.9 2 2s.9-2 2-2zm8 0c-1.1 0-2 .9-2 2v2h-2c0 1.1.9 2 2s.9-2 2-2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4z" />
                    </svg>
                  )}
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-white text-xs">Upload</span>
                  </div>
                </div>
                <input
                  id="server-icon-input"
                  type="file"
                  accept="image/*"
                  onChange={handleIconChange}
                  className="hidden"
                />
                {icon && (
                  <button
                    type="button"
                    onClick={() => { setIcon(null); setIconPreview(''); }}
                    className="text-[#f23f43] text-sm hover:underline"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-[#b5bac1] mb-2">Server Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Awesome Server"
                maxLength={100}
                autoFocus
                className="w-full bg-[#1e1f22] text-[#dbdee1] placeholder-[#87898c] px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5865f2]"
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={onClose} variant="secondary">Cancel</Button>
              <Button type="submit" variant="primary" disabled={!name.trim()}>
                Create Server
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

// ============ EMOJI PICKER ============

const EmojiPicker: React.FC<{
  onSelect: (emoji: string) => void;
  onClose: () => void;
}> = ({ onSelect, onClose }) => {
  const emojis = [
    '😀', '😂', '😍', '🥰', '🎉', '🎊', '💯', '✨', '💪',
    '❤️', '🧡', '💔', '👍', '👎�', '🔥', '⭐', '🌟', '💕',
    '😎', '🤔', '😮', '🤯', '😅', '😢', '😡', '🤣', '🤬',
    '👀', '👽', '🐱', '🌈', '🌍', '💻', '🎮', '🎨', '🎭',
    '🍕', '🍔', '☕', '🍷', '🥤', '🍺', '🥝', '🍞', '🍰',
    '⚽', '🏀', '🎸', '🎺', '🎻', '🎤', '🎧', '🏹', '🏈',
    '🚗', '🚀', '🛸', '🌎', '🎱', '🎬', '📺', '📷', '📸',
  ];

  return (
    <div className="fixed bottom-24 right-4 bg-[#2b2d31] border border-[#1e1f22] rounded-lg shadow-xl p-3 z-50 animate-scale-in">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-[#b5bac1]">Emoji Picker</h3>
        <button onClick={onClose} className="text-[#949ba4] hover:text-[#dbdee1]">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
          </svg>
        </button>
      </div>
      <div className="grid grid-cols-8 gap-1 max-h-64 overflow-y-auto">
        {emojis.map((emoji) => (
          <button
            key={emoji}
            onClick={() => onSelect(emoji)}
            className="w-9 h-9 text-2xl hover:bg-[#35363c] rounded transition-colors flex items-center justify-center"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
};

// ============ MEMBER LIST COMPONENT ============

const MemberList: React.FC<{
  members: Member[];
  roles: Role[];
  selectedUser: User | null;
  onUserClick: (user: User) => void;
}> = ({ members, roles, selectedUser, onUserClick }) => {
  // Group members by highest role
  const groupedMembers = members.reduce((acc, member) => {
    if (member.user.id === selectedUser?.id) return acc; // Skip current user

    const roleIds = member.roles;
    let highestRole = roles.find((r) => r.id === roleIds[0]);
    const roleName = highestRole?.name || 'Online';

    if (!acc[roleName]) {
      acc[roleName] = [];
    }
    acc[roleName].push(member);
    return acc;
  }, {} as Record<string, Member[]>);

  return (
    <div className="w-60 bg-[#2b2d31] flex flex-col">
      <div className="h-12 px-4 flex items-center border-b border-[#1e1f22] shadow-sm">
        <h2 className="font-semibold text-xs text-[#949ba4] uppercase">Members — {members.length}</h2>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {Object.entries(groupedMembers).map(([roleName, roleMembers]) => (
          <div key={roleName} className="mb-4">
            <div className="text-xs font-semibold text-[#949ba4] uppercase px-2 mb-1">{roleName}</div>
            {roleMembers.map((member) => (
              <button
                key={member.user.id}
                onClick={() => onUserClick(member.user)}
                className="w-full text-left px-2 py-1.5 rounded-[4px] hover:bg-[#35363c] transition-colors flex items-center gap-3 group"
              >
                <div className="relative flex-shrink-0">
                  <img
                    src={userAvatarUrl(member.user)}
                    alt={member.user.username}
                    className="w-8 h-8 rounded-full"
                  />
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-[#23a559] border-[2px] border-[#2b2d31] rounded-full" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#949ba4] group-hover:text-[#dbdee1] truncate">
                    {member.nick || member.user.global_name || member.user.username}
                  </p>
                </div>
                {member.user.bot && (
                  <span className="text-[10px] bg-[#5865f2] text-white px-1 py-0.5 rounded font-semibold uppercase">
                    Bot
                  </span>
                )}
              </button>
            ))}
          </div>
        ))}
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
  const [dmChannels, setDmChannels] = useState<Channel[]>([]);
  const [isDMView, setIsDMView] = useState(false);

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
  const [showQuickSwitcher, setShowQuickSwitcher] = useState(false);
  const [showMemberList, setShowMemberList] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);

  // New UI states
  const [showCreateServer, setShowCreateServer] = useState(false);
  const [showUserSearch, setShowUserSearch] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [serverName, setServerName] = useState('');
  const [serverIcon, setServerIcon] = useState<File | null>(null);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [searchedUsers, setSearchedUsers] = useState<User[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setShowQuickSwitcher((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setShowQuickSwitcher(false);
        setShowUserProfile(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authToken]);

  useEffect(() => {
    if (!authToken || !botUser) return;
    loadGuilds();
    loadDMChannels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authToken, botUser]);

  useEffect(() => {
    if (!authToken || !selectedGuildId) return;
    loadGuildData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authToken, selectedGuildId]);

  useEffect(() => {
    if (!authToken || !selectedChannelId) {
      setMessages([]);
      return;
    }
    loadMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const loadDMChannels = async () => {
    if (!authToken) return;
    try {
      const data = await authedFetch<Channel[]>(authToken, '/users/@me/channels');
      setDmChannels(data.filter((ch) => ch.type === 1 || ch.type === 3));
    } catch (error) {
      console.error('Failed to load DM channels:', error);
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
      setToast({ message: 'Message sent!', type: 'success' });
    } catch (error) {
      console.error('Failed to send message:', error);
      setToast({ message: 'Failed to send message', type: 'error' });
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
      setToast({ message: 'Message edited!', type: 'success' });
    } catch (error) {
      console.error('Failed to edit message:', error);
      setToast({ message: 'Failed to edit message', type: 'error' });
    }
  };

  const handleAddReaction = async (messageId: string, emoji: string) => {
    if (!authToken || !selectedChannelId) return;
    try {
      await authedFetch(authToken, `/channels/${selectedChannelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}/@me`, {
        method: 'PUT',
      });
      loadMessages();
    } catch (error) {
      console.error('Failed to add reaction:', error);
    }
  };

  const handleDeleteMessage = (messageId: string) => {
    if (!authToken || !selectedChannelId) return;
    authedFetch(authToken, `/channels/${selectedChannelId}/messages/${messageId}`, {
      method: 'DELETE',
    })
      .then(() => {
        loadMessages();
        setToast({ message: 'Message deleted!', type: 'success' });
      })
      .catch(console.error);
  };

  const handleQuickSwitcherSelect = (type: 'channel' | 'guild', id: string) => {
    if (type === 'guild') {
      setIsDMView(false);
      setSelectedGuildId(id);
      setSelectedChannelId(null);
      setMessages([]);
    } else {
      setIsDMView(false);
      setSelectedChannelId(id);
    }
    setShowQuickSwitcher(false);
  };

  const handleSearchUsers = async (query: string) => {
    if (!authToken || !query.trim()) return;

    try {
      const data = await authedFetch<{ members: { user: User }[] }>(authToken, `/guilds/${selectedGuildId}/members/search?query=${encodeURIComponent(query)}&limit=5`);
      const users = data.members?.map(m => m.user) || [];
      setSearchedUsers(users);
    } catch (error) {
      console.error('Failed to search users:', error);
    }
  };

  const handleStartDM = async (user: User) => {
    if (!authToken) return;

    try {
      const data = await authedFetch<Channel>(authToken, '/users/@me/channels', {
        method: 'POST',
        body: JSON.stringify({ recipient_id: user.id }),
      });

      const newChannel = { ...data, recipients: [user], type: 1 };
      setDmChannels([newChannel, ...dmChannels]);
      setIsDMView(true);
      setSelectedGuildId(null);
      setSelectedChannelId(newChannel.id);
      setMessages([]);
      setShowUserSearch(false);
      setUserSearchQuery('');
      setToast({ message: `Started DM with ${user.username}`, type: 'success' });
    } catch (error) {
      console.error('Failed to create DM:', error);
      setToast({ message: 'Failed to start DM', type: 'error' });
    }
  };

  const handleCreateServer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authToken || !serverName.trim()) return;

    try {
      const data = await authedFetch<Guild>(authToken, '/guilds', {
        method: 'POST',
        body: JSON.stringify({ name: serverName }),
      });

      setGuilds([...guilds, data]);
      setServerName('');
      setServerIcon(null);
      setShowCreateServer(false);
      setToast({ message: 'Server created!', type: 'success' });
    } catch (error) {
      console.error('Failed to create server:', error);
      setToast({ message: 'Failed to create server', type: 'error' });
    }
  };

  const handleReply = (messageId: string) => {
    const message = messages.find(m => m.id === messageId);
    if (message) {
      setReplyingTo(messageId);
      setMessageInput(`> <@${message.author.username}> ${message.content.substring(0, 50)}...`);
      // Scroll to message composer
      const input = document.querySelector('input[type="text"]') as HTMLInputElement;
      input?.focus();
    }
  };

  const handleCancelReply = () => {
    setReplyingTo(null);
    setMessageInput('');
  };

  const handleUserClick = (user: User) => {
    setSelectedUser(user);
    setShowUserProfile(true);
  };

  // Login Screen
  if (!authToken || !botUser) {
    return (
      <div className="fixed inset-0 flex items-center justify-center p-6 bg-[#313338]">
        <div className="w-full max-w-md bg-[#2b2d31] rounded-lg shadow-xl p-8">
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 rounded-full bg-[#5865f2] flex items-center justify-center text-4xl shadow-lg">
              🤖
            </div>
          </div>
          <h1 className="text-2xl font-bold text-center mb-2 text-white">Welcome to BotClienty</h1>
          <p className="text-[#b5bac1] text-center mb-6 text-sm">
            Discord Bot Web Client with DM Support
          </p>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-bold mb-2 text-[#b5bac1] uppercase">
                Bot Token <span className="text-[#f23f43]">*</span>
              </label>
              <input
                type="password"
                placeholder="Enter your Discord bot token"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                autoFocus
                className="w-full bg-[#1e1f22] border border-[#1e1f22] rounded-[3px] px-3 py-2.5 text-[15px] text-[#dbdee1] placeholder-[#87898c] focus:outline-none focus:border-[#00a8fc] transition-colors"
              />
            </div>

            {authError && (
              <div className="bg-[#f23f43]/10 border border-[#f23f43] p-3 rounded-[3px]">
                <p className="text-[#f23f43] text-sm flex items-center gap-2">
                  <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                  </svg>
                  {authError}
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={isAuthenticating}
              className="w-full bg-[#5865f2] hover:bg-[#4752c4] text-white font-medium py-2.5 rounded-[3px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isAuthenticating ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Authenticating...
                </span>
              ) : (
                'Log In'
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-[#3f4147]">
            <p className="text-xs text-[#949ba4] mb-3 font-medium">FEATURES</p>
            <div className="space-y-2 text-sm text-[#b5bac1]">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-[#23a559] flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                </svg>
                View all servers and channels
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-[#23a559] flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                </svg>
                Send and receive messages
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-[#23a559] flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                </svg>
                Direct message support
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-[#23a559] flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                </svg>
                Rich embeds and attachments
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-[#23a559] flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                </svg>
                Message reactions
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-[#23a559] flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                </svg>
                Server member list
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-[#3f4147]">
              <p className="text-xs text-[#949ba4] mb-3 font-medium">KEYBOARD SHORTCUTS</p>
              <div className="space-y-1.5 text-xs text-[#b5bac1]">
                <div className="flex items-center gap-2">
                  <kbd className="bg-[#1e1f22] px-1.5 py-0.5 rounded text-[10px] font-mono">Ctrl</kbd>
                  <span>+</span>
                  <kbd className="bg-[#1e1f22] px-1.5 py-0.5 rounded text-[10px] font-mono">K</kbd>
                  <span className="text-[#949ba4]">Quick switcher</span>
                </div>
                <div className="flex items-center gap-2">
                  <kbd className="bg-[#1e1f22] px-1.5 py-0.5 rounded text-[10px] font-mono">Esc</kbd>
                  <span className="text-[#949ba4]">Close modals</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const selectedGuild = guilds.find((g) => g.id === selectedGuildId);
  const selectedChannel = isDMView
    ? dmChannels.find((c) => c.id === selectedChannelId)
    : channels.find((c) => c.id === selectedChannelId);
  const textChannels = channels.filter((c) => c.type === 0);
  const voiceChannels = channels.filter((c) => c.type === 2);
  const categories = channels.filter((c) => c.type === 4);

  // Group messages by same author
  const groupedMessages: Array<Message & { showHeader: boolean }> = messages.reduce((acc, message, index) => {
    const prevMessage = messages[index - 1];
    const showHeader =
      !prevMessage ||
      prevMessage.author.id !== message.author.id ||
      new Date(message.timestamp).getTime() - new Date(prevMessage.timestamp).getTime() > 5 * 60 * 1000;

    acc.push({ ...message, showHeader });
    return acc;
  }, [] as Array<Message & { showHeader: boolean }>);

  // Main app return
  return (
    <div className="flex h-screen bg-gray-900 text-gray-100">
      {/* Server Sidebar */}
      <nav className="w-[72px] bg-[#1e1f22] flex flex-col items-center py-3 gap-2 overflow-y-auto">
        <button
           onClick={() => {
             setIsDMView(true);
             setSelectedGuildId(null);
             setSelectedChannelId(null);
             setMessages([]);
           }}
           className={`group relative w-12 h-12 rounded-[24px] bg-[#313338] flex items-center justify-center transition-all duration-200 hover:rounded-[16px] hover:bg-[#5865f2] ${
             isDMView ? 'rounded-[16px] bg-[#5865f2]' : ''
           }`}
           title="Direct Messages"
        >
          <svg
             className={`w-6 h-6 transition-colors ${isDMView ? 'text-white' : 'text-[#b5bac1] group-hover:text-white'}`}
             fill="currentColor"
             viewBox="0 0 24 24"
          >
             <path d="M12 2C6.486 2 2 6.486 2 12s4.486 10 10 10 10-4.486 10-10S17.514 2 12 2zm0 18c-4.411 0-8-3.589-8-8s3.589-8 8-8 8 3.589 8 8-3.589 8-8 8z" />
             <path d="M8.5 12.5c.828 0 1.5-.672 1.5-1.5S9.328 9.5 8.5 9.5 7 10.172 7 11s.672 1.5 1.5 1.5zm7 0c.828 0 1.5-.672 1.5-1.5s-.672-1.5-1.5-1.5S14 10.172 14 11s.672 1.5 1.5 1.5zm-3.5 4c2.33 0 4.32-1.45 5.12-3.5H6.88c.8 2.05 2.79 3.5 5.12 3.5z" />
          </svg>
          {isDMView && (
            <div className="absolute left-0 w-1 h-10 bg-white rounded-r-full -ml-[3px]" />
          )}
        </button>

        {/* User Search Button */}
        <button
          onClick={() => {
            if (authToken && selectedGuildId) {
              setShowUserSearch(true);
              handleSearchUsers('');
            } else {
              setShowCreateServer(true);
            }
          }}
          className="group relative w-12 h-12 rounded-[24px] bg-[#23a559] flex items-center justify-center transition-all duration-200 hover:rounded-[16px] hover:bg-[#5865f2]"
          title={selectedGuildId ? "Search Users" : "Create Server"}
        >
          <svg
            className="w-6 h-6 text-white group-hover:scale-110 transition-transform"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            {selectedGuildId ? (
              <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
            ) : (
              <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
            )}
          </svg>
        </button>
        <div className="w-8 h-[2px] bg-[#35363c] rounded-full my-1" />
        {guilds.map((guild) => (
          <button
            key={guild.id}
            onClick={() => {
              setIsDMView(false);
              setSelectedGuildId(guild.id);
              setSelectedChannelId(null);
              setMessages([]);
            }}
            className={`group relative w-12 h-12 rounded-[24px] overflow-hidden flex items-center justify-center transition-all duration-200 hover:rounded-[16px] ${
              selectedGuildId === guild.id && !isDMView ? 'rounded-[16px]' : ''
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
              <div className="w-full h-full bg-[#313338] flex items-center justify-center group-hover:bg-[#5865f2] transition-colors">
                <span className="font-semibold text-lg text-[#dbdee1] group-hover:text-white transition-colors">
                  {guild.name.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            {selectedGuildId === guild.id && !isDMView && (
              <div className="absolute left-0 w-1 h-10 bg-white rounded-r-full -ml-[3px]" />
            )}
            {selectedGuildId !== guild.id && (
              <div className="absolute left-0 w-1 h-0 group-hover:h-5 bg-white rounded-r-full -ml-[3px] transition-all duration-200" />
            )}
          </button>
        ))}
        {/* Create Server Button */}
        <button
          onClick={() => setShowCreateServer(true)}
          className="group relative w-12 h-12 rounded-[24px] bg-[#313338] flex items-center justify-center transition-all duration-200 hover:rounded-[16px] hover:bg-[#23a559] hover:text-white text-[#23a559]"
          title="Create Server"
        >
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
            <path d="M19 13h-6v6h-2v-6h-2v-2h6v-2h2v2h2v2h2v-2zM7 9c-1.1 0-2 .9-2 2v2h-2c-1.1 0-2 .9-2 2v4c0 1.1.9 2 2h4v2h4c1.1 0 2-.9 2-2v-4c0-1.1-.9-2-2-2-2h-4c-1.1 0-2-.9-2-2v-2h4v-2h-2v2h-2v2h-2c-1.1 0-2-.9-2-2v4c0 1.1.9 2 2h4v-2h-2v2h-2v2h-2v-2z" />
          </svg>
          <div className="absolute left-0 w-1 h-0 group-hover:h-5 bg-white rounded-r-full -ml-[3px] transition-all duration-200" />
        </button>
      </nav>

      {/* Channel Sidebar */}
      <aside className="w-60 bg-[#2b2d31] flex flex-col">
        <header className="h-12 px-4 flex items-center border-b border-[#1e1f22] shadow-sm">
          <h2 className="font-semibold text-base truncate text-white">
            {isDMView ? 'Direct Messages' : selectedGuild?.name || 'BotClienty'}
          </h2>
        </header>

        <div className="flex-1 overflow-y-auto p-2 space-y-[2px]">
          {isDMView ? (
            <>
              {dmChannels.length > 0 ? (
                dmChannels.map((channel) => {
                  const recipient = channel.recipients?.[0];
                  return (
                    <button
                      key={channel.id}
                      onClick={() => {
                        setSelectedChannelId(channel.id);
                        setShowChannelInfo(false);
                      }}
                      className={`w-full text-left px-2 py-2 rounded-[4px] hover:bg-[#35363c] transition-colors flex items-center gap-3 group ${
                        selectedChannelId === channel.id
                          ? 'bg-[#404249] text-white'
                          : 'text-[#949ba4]'
                      }`}
                    >
                      {recipient && (
                        <>
                          <div className="relative">
                            <img
                              src={userAvatarUrl(recipient)}
                              alt={recipient.username}
                              className="w-8 h-8 rounded-full"
                            />
                            <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-[#23a559] border-[3px] border-[#2b2d31] rounded-full" />
                          </div>
                          <span className="text-sm font-medium truncate flex-1">
                            {recipient.global_name || recipient.username}
                          </span>
                        </>
                      )}
                    </button>
                  );
                })
              ) : (
                <div className="text-center py-8 px-4">
                  <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-[#313338] flex items-center justify-center">
                    <svg className="w-8 h-8 text-[#80848e]" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.486 2 2 6.486 2 12s4.486 10 10 10 10-4.486 10-10S17.514 2 12 2zm0 18c-4.411 0-8-3.589-8-8s3.589-8 8-8 8 3.589 8 8-3.589 8-8 8z" />
                    </svg>
                  </div>
                  <p className="text-[#b5bac1] text-sm">No direct messages</p>
                </div>
              )}
            </>
          ) : (
            <>
                            {/* Group channels by category */}
              {categories.map((category) => {
                const categoryChannels = channels.filter((c) => c.parent_id === category.id && c.type !== 4);
                if (categoryChannels.length === 0) return null;

                const textChannelsInCategory = categoryChannels.filter((c) => c.type === 0);
                const voiceChannelsInCategory = categoryChannels.filter((c) => c.type === 2);

                return (
                  <div key={category.id} className="mb-4 bg-[#2e3035]/20 rounded-lg overflow-hidden border border-[#1e1f22]/30 shadow-sm mx-1">
                    <div className="text-[11px] font-bold text-[#949ba4] uppercase px-2 py-1.5 flex items-center gap-1 cursor-pointer hover:text-[#dbdee1] transition-colors bg-[#1e1f22]/20">
                      <svg className="w-3 h-3 transition-transform" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" />
                      </svg>
                      <span className="tracking-wider">{category.name}</span>
                    </div>
                    <div className="p-1 space-y-[1px]">
                      {textChannelsInCategory.map((channel) => (
                        <button
                          key={channel.id}
                          onClick={() => setSelectedChannelId(channel.id)}
                          className={`w-full text-left px-2 py-1 rounded-[4px] hover:bg-[#35363c] transition-colors flex items-center gap-2 group ${
                            selectedChannelId === channel.id
                              ? 'bg-[#404249] text-white'
                              : 'text-[#949ba4] hover:text-[#dbdee1]'
                          }`}
                        >
                          <span className="text-[#80848e] font-light text-lg">#</span>
                          <span className="text-[14px] font-medium truncate flex-1">{channel.name}</span>
                          {channel.nsfw && (
                            <span className="text-[9px] bg-[#f23f43] text-white px-1 py-0.5 rounded font-bold">
                              NSFW
                            </span>
                          )}
                        </button>
                      ))}
                      {voiceChannelsInCategory.map((channel) => (
                        <button
                          key={channel.id}
                          className="w-full text-left px-2 py-1 rounded-[4px] hover:bg-[#35363c] transition-colors flex items-center gap-2 text-[#949ba4] hover:text-[#dbdee1]"
                        >
                          <span className="text-[#80848e] text-lg">🔊</span>
                          <span className="text-[14px] font-medium truncate">{channel.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}

              {/* Uncategorized channels */}
              {(() => {
                const uncategorizedTextChannels = textChannels.filter((c) => !c.parent_id);
                const uncategorizedVoiceChannels = voiceChannels.filter((c) => !c.parent_id);

                if (uncategorizedTextChannels.length === 0 && uncategorizedVoiceChannels.length === 0) return null;

                return (
                  <div className="mb-4 bg-[#2e3035]/20 rounded-lg overflow-hidden border border-[#1e1f22]/30 shadow-sm mx-1">
                    <div className="p-1 space-y-[1px]">
                      {uncategorizedTextChannels.map((channel) => (
                        <button
                          key={channel.id}
                          onClick={() => setSelectedChannelId(channel.id)}
                          className={`w-full text-left px-2 py-1 rounded-[4px] hover:bg-[#35363c] transition-colors flex items-center gap-2 group ${
                            selectedChannelId === channel.id
                              ? 'bg-[#404249] text-white'
                              : 'text-[#949ba4] hover:text-[#dbdee1]'
                          }`}
                        >
                          <span className="text-[#80848e] font-light text-lg">#</span>
                          <span className="text-[14px] font-medium truncate flex-1">{channel.name}</span>
                          {channel.nsfw && (
                            <span className="text-[9px] bg-[#f23f43] text-white px-1 py-0.5 rounded font-bold">
                              NSFW
                            </span>
                          )}
                        </button>
                      ))}
                      {uncategorizedVoiceChannels.map((channel) => (
                        <button
                          key={channel.id}
                          className="w-full text-left px-2 py-1 rounded-[4px] hover:bg-[#35363c] transition-colors flex items-center gap-2 text-[#949ba4] hover:text-[#dbdee1]"
                        >
                          <span className="text-[#80848e] text-lg">🔊</span>
                          <span className="text-[14px] font-medium truncate">{channel.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })()}


            </>
          )}
          {channels.filter((c) => c.type === 0).length === 0 && !isLoading && !isDMView && (
            <p className="text-[#949ba4] text-sm px-2 py-4">No channels available</p>
          )}
        </div>

        <div className="h-[52px] px-2 flex items-center bg-[#232428]">
          <div className="flex items-center gap-2 flex-1 min-w-0 px-2 py-1 rounded hover:bg-[#35363c] transition-colors cursor-pointer">
            <div className="relative flex-shrink-0">
              <img
                src={userAvatarUrl(botUser)}
                alt={botUser.username}
                className="w-8 h-8 rounded-full"
              />
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-[#23a559] border-[3px] border-[#232428] rounded-full" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-white truncate leading-[18px]">
                {botUser.global_name || botUser.username}
              </p>
              <p className="text-xs text-[#b5bac1] truncate leading-[13px]">
                #{botUser.discriminator}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="flex-shrink-0 p-1 hover:bg-[#4e505899] rounded transition-colors"
              title="Logout"
            >
              <svg className="w-5 h-5 text-[#b5bac1]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col bg-[#313338]">
        {/* Chat Header */}
        <header className="h-12 px-4 flex items-center border-b border-[#1e1f22] shadow-sm">
          <div className="flex items-center gap-2 flex-1">
            {selectedChannel && (
              <>
                {isDMView ? (
                  <>
                    {selectedChannel.recipients?.[0] && (
                      <>
                        <div className="relative">
                          <img
                            src={userAvatarUrl(selectedChannel.recipients[0])}
                            alt={selectedChannel.recipients[0].username}
                            className="w-6 h-6 rounded-full"
                          />
                          <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-[#23a559] border-[2px] border-[#313338] rounded-full" />
                        </div>
                        <h1 className="text-base font-semibold text-white">
                          {selectedChannel.recipients[0].global_name || selectedChannel.recipients[0].username}
                        </h1>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <span className="text-[#80848e] text-xl">
                      {getChannelTypeIcon(selectedChannel.type)}
                    </span>
                    <h1 className="text-base font-semibold text-white">
                      {selectedChannel.name}
                    </h1>
                    {selectedChannel.nsfw && (
                      <span className="text-[10px] bg-[#f23f43] text-white px-1.5 py-0.5 rounded font-bold">
                        NSFW
                      </span>
                    )}
                  </>
                )}
                {selectedChannel.topic && (
                  <>
                    <div className="w-px h-6 bg-[#3f4147] mx-2" />
                    <p className="text-sm text-[#b5bac1] truncate">{selectedChannel.topic}</p>
                  </>
                )}
              </>
            )}
            {!selectedChannel && (
              <h1 className="text-base font-semibold text-[#949ba4]">
                {isDMView ? 'Select a direct message' : 'Select a channel'}
              </h1>
            )}
          </div>
          {selectedChannel && !isDMView && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowMemberList(!showMemberList)}
                className="p-1 text-[#b5bac1] hover:text-[#dbdee1] transition-colors"
                title="Toggle Members"
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05-1.3.15.33.58.7.95 1.24.95V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
                </svg>
              </button>
              <button
                onClick={() => setShowChannelInfo(!showChannelInfo)}
                className="p-1 text-[#b5bac1] hover:text-[#dbdee1] transition-colors"
                title="Channel Info"
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                </svg>
              </button>
            </div>
          )}
        </header>

        {/* Messages Container */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center items-center h-full">
              <div className="text-center">
                <div className="w-12 h-12 border-4 border-[#1e1f22] border-t-[#5865f2] rounded-full animate-spin mx-auto mb-4" />
                <p className="text-[#b5bac1]">Loading messages...</p>
              </div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-full px-4">
              <div className="text-center max-w-md">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#2b2d31] flex items-center justify-center text-3xl">
                  💬
                </div>
                <h3 className="text-base font-semibold mb-1 text-[#f2f3f5]">
                  {selectedChannel
                    ? isDMView
                      ? `This is the beginning of your direct message history with @${selectedChannel.recipients?.[0]?.username || 'user'}.`
                      : `Welcome to #${selectedChannel.name}!`
                    : 'No channel selected'}
                </h3>
                <p className="text-sm text-[#b5bac1]">
                  {selectedChannel && 'Be the first to send a message!'}
                </p>
              </div>
            </div>
          ) : (
            <div className="py-4">
              {groupedMessages.map((message) => (
                <MessageComponent
                  key={message.id}
                  message={message}
                  currentUser={botUser}
                  onEdit={handleEditMessage}
                  onDelete={handleDeleteMessage}
                  onUserClick={handleUserClick}
                  onAddReaction={handleAddReaction}
                  showHeader={message.showHeader}
                />
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Message Composer */}
        <div className="px-4 pb-6">
          {/* Typing indicator */}
          {isTyping && typingUsers.length > 0 && (
            <div className="mb-2 px-4 py-1">
              <span className="text-xs text-[#b5bac1] flex items-center gap-1">
                <span className="flex items-center gap-0.5">
                  <span className="w-1.5 h-1.5 bg-[#b5bac1] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-[#b5bac1] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-[#b5bac1] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </span>
                <span>
                  {typingUsers.length === 1
                    ? 'Someone is typing...'
                    : `${typingUsers.length} people are typing...`}
                </span>
              </span>
            </div>
          )}

          <form onSubmit={handleSendMessage}>
            <div className="bg-[#383a40] rounded-lg px-4 py-3 flex items-center gap-2">
              <button
                type="button"
                className="text-[#b5bac1] hover:text-[#dbdee1] transition-colors flex-shrink-0"
                title="Add attachment"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z" />
                </svg>
              </button>
              <input
                type="text"
                value={messageInput}
                onChange={(e) => {
                  setMessageInput(e.target.value);
                  // Simulate typing indicator when typing
                  if (e.target.value.length > 0 && !isTyping) {
                    setIsTyping(true);
                    setTypingUsers(['Someone']);
                    setTimeout(() => {
                      setIsTyping(false);
                      setTypingUsers([]);
                    }, 3000);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage(e);
                  }
                }}
                placeholder={
                  selectedChannelId
                    ? isDMView
                      ? `Message @${selectedChannel?.recipients?.[0]?.username || 'user'}`
                      : `Message #${selectedChannel?.name || 'channel'}`
                    : 'Select a channel first'
                }
                disabled={!selectedChannelId}
                className="flex-1 bg-transparent text-[#dbdee1] text-[15px] placeholder-[#87898c] focus:outline-none"
              />
              <button
                type="button"
                className="text-[#b5bac1] hover:text-[#dbdee1] transition-colors flex-shrink-0"
                title="GIFs"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M11.5 9H13v6h-1.5zM9 9H6c-.6 0-1 .5-1 1v4c0 .5.4 1 1 1h3v2H6c-1.1 0-2-.9-2-2V10c0-1.1.9-2 2-2h3v-1zm5 5H13V9h1c.6 0 1 .5 1 1v4c0 .5-.4 1-1 1h1v2h-1c-1.1 0-2-.9-2-2V10c0-1.1.9-2 2-2z" />
                </svg>
              </button>
              <button
                type="button"
                className="text-[#b5bac1] hover:text-[#dbdee1] transition-colors flex-shrink-0"
                title="Emojis"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z" />
                </svg>
              </button>
            </div>
          </form>
        </div>
      </main>

      {/* Right Sidebar - Member List */}
      {!isDMView && showMemberList && selectedGuild && (
        <MemberList
          members={members}
          roles={roles}
          selectedUser={botUser}
          onUserClick={handleUserClick}
        />
      )}

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

      {/* User Search Modal */}
      {showUserSearch && (
        <UserSearchModal
          users={searchedUsers}
          onUserClick={(user) => {
            handleStartDM(user);
            setSelectedUser(user);
          }}
          onClose={() => {
            setShowUserSearch(false);
            setSearchedUsers([]);
            setUserSearchQuery('');
          }}
        />
      )}

      {/* Create Server Modal */}
      {showCreateServer && (
        <CreateServerModal
          onClose={() => setShowCreateServer(false)}
          onCreate={async (name, icon) => {
            if (!authToken || !name.trim()) return;
            
            try {
              const data = await authedFetch<Guild>(authToken, '/guilds', {
                method: 'POST',
                body: JSON.stringify({ name: name.trim() }),
              });
              
              setGuilds([...guilds, data]);
              setShowCreateServer(false);
              setToast({ message: 'Server created!', type: 'success' });
            } catch (error) {
              console.error('Failed to create server:', error);
              setToast({ message: 'Failed to create server', type: 'error' });
            }
          }}
        />
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

      {/* Quick Switcher */}
      {showQuickSwitcher && (
        <QuickSwitcher
          channels={channels}
          guilds={guilds}
          onSelect={handleQuickSwitcherSelect}
          onClose={() => setShowQuickSwitcher(false)}
        />
      )}

      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
