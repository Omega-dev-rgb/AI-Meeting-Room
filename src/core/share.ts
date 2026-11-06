import { authorName } from './prompt';
import type { Member, Message, Room } from './types';

/** 共有に使える発言（システムのお知らせは除く） */
export function shareableMessages(messages: Message[]): Message[] {
  return messages.filter((m) => m.kind === 'chat' || m.kind === 'summary');
}

/**
 * 最初に選んでおく発言：直近のユーザーの投稿と、それへの返事（話の流れがわかるように）。
 * 長くなりすぎないよう max 件まで。ユーザーの投稿がなければ直近 max 件
 */
export function defaultShareSelection(messages: Message[], max = 6): string[] {
  const list = shareableMessages(messages);
  let start = -1;
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i].authorId === 'user') {
      start = i;
      break;
    }
  }
  if (start < 0) return list.slice(-max).map((m) => m.id);
  const ids = list.slice(start, start + max).map((m) => m.id);
  return ids;
}

export const SHARE_HASHTAG = '#AI会議室';

/** 画像が使えないとき用のテキスト版（会話の順番どおり） */
export function shareText(room: Room, messages: Message[], selectedIds: string[], members: Member[]): string {
  const picked = shareableMessages(messages).filter((m) => selectedIds.includes(m.id));
  const lines = picked.map((m) => {
    const name = authorName(m.authorId, members);
    return `${name}${m.kind === 'summary' ? '（要約）' : ''}：${m.text}`;
  });
  return [`【${room.title}】`, ...lines, '', SHARE_HASHTAG].join('\n');
}
