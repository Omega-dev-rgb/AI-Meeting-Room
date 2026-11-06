import { VENDOR_LABEL } from './defaultMembers';
import type { ChatTurn, Member, Message, Room, Settings } from './types';

export function authorName(authorId: string, members: Member[]): string {
  if (authorId === 'user') return 'あなた';
  if (authorId === 'system') return 'システム';
  return members.find((m) => m.id === authorId)?.name ?? '退出したメンバー';
}

function systemPrompt(me: Member, others: Member[], room: Room, settings: Settings): string {
  const lines = [
    `あなたは「${me.name}」です（中身は${VENDOR_LABEL[me.vendor]}）。`,
    `ここは「${room.title}」というグループチャットで、ユーザー（このチャットの持ち主）とAIメンバーが会話しています。`,
    `【性格】${me.persona}`,
    `【担当】${me.role}`,
    `【ほかのメンバー】` +
      (others.length ? others.map((o) => `${o.name}（${o.role}）`).join('、') : 'なし'),
    '【話し方のルール】',
    ...(room.depth === 'quick'
      ? ['- 日本語で、1回の発言は2〜3文。テンポよく短く返す']
      : [
          '- 日本語で、1回の発言は3〜6文程度',
          '- 一般論で終わらせず、理由か具体例（数字・場面・やり方）を必ず1つ入れる',
          '- 前の人に賛成するだけで終わらない。別の角度、反対意見、見落としのどれかを足す',
          '- 話が深まるよう、ユーザーか他のメンバーへの問いを1つ入れてよい',
        ]),
    '- 自分の名前を発言の先頭に付けない',
    '- 他のメンバーの発言を踏まえ、同じことを繰り返さない。必要なら名前を呼んで反応する',
    '- わからないことは推測で断定しない',
    '- あなたはAIのメンバーで、ユーザー本人ではない。【ユーザーについて】や会話に出たユーザーの状況（育休・仕事・家族など）を、自分の経験として語らない',
    '- まとめ役以外のメンバーは、まとめや進行をしない。自分の担当の視点で意見を言う',
  ];
  if (settings.userProfile.trim()) lines.push(`【ユーザーについて】${settings.userProfile.trim()}`);
  if (me.memory.trim()) lines.push(`【あなたの記憶メモ】${me.memory.trim()}`);
  if (room.latestSummary) lines.push(`【これまでの要約】${room.latestSummary}`);
  return lines.join('\n');
}

/**
 * メンバー1人分の入力を組み立てる。
 * 自分の過去発言は assistant、それ以外は「【名前】本文」として user に入れる。
 * 料金を抑えるため、直近 historyLimit 件だけを渡す。
 */
export function buildPrompt(
  me: Member,
  members: Member[],
  room: Room,
  history: Message[],
  settings: Settings,
): ChatTurn[] {
  const others = members.filter((m) => m.id !== me.id && room.memberIds.includes(m.id));
  const recent = history.filter((m) => m.kind === 'chat').slice(-settings.historyLimit);
  const turns: ChatTurn[] = [{ role: 'system', content: systemPrompt(me, others, room, settings) }];
  for (const msg of recent) {
    if (msg.authorId === me.id) {
      turns.push({ role: 'assistant', content: msg.text });
    } else {
      const content = `【${authorName(msg.authorId, members)}】${msg.text}`;
      const last = turns[turns.length - 1];
      // user が連続する場合は1つにまとめる（連続を嫌うモデルがあるため）
      if (last.role === 'user') last.content += '\n' + content;
      else turns.push({ role: 'user', content });
    }
  }
  if (turns[turns.length - 1].role !== 'user') {
    turns.push({ role: 'user', content: '（続けてあなたの番です。発言してください）' });
  }
  return turns;
}

/** 「今どうなってる？」用の入力 */
export function buildSummaryPrompt(members: Member[], room: Room, history: Message[], settings: Settings): ChatTurn[] {
  const log = history
    .filter((m) => m.kind === 'chat')
    .slice(-Math.max(settings.historyLimit, 60))
    .map((m) => `【${authorName(m.authorId, members)}】${m.text}`)
    .join('\n');
  return [
    {
      role: 'system',
      content:
        'あなたは会議の書記です。次のグループチャットのログを読み、日本語で次の3つの見出しで簡潔にまとめてください。' +
        '\n■ 今の論点\n■ 決まったこと\n■ 次の一手\n各見出しは箇条書き3つ以内。決まっていないことは「なし」と書く。',
    },
    {
      role: 'user',
      content: `会議室「${room.title}」\n${room.latestSummary ? `前回の要約:\n${room.latestSummary}\n\n` : ''}ログ:\n${log || '（まだ発言なし）'}`,
    },
  ];
}
