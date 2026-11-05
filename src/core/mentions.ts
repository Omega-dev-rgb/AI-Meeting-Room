import { VENDOR_LABEL } from './defaultMembers';
import type { Member } from './types';

/**
 * 投稿文から「@名前」での指名を探す。名前・ベンダー名（@Claude など）・ID のどれでも指名できる。
 * 見つかった順に重複なしで返す。
 */
export function parseMentions(text: string, members: Member[]): string[] {
  const found: { id: string; index: number }[] = [];
  const lower = text.toLowerCase();
  for (const m of members) {
    const keys = [m.name, VENDOR_LABEL[m.vendor], m.id].map((k) => '@' + k.toLowerCase());
    let best = -1;
    for (const k of keys) {
      const i = lower.indexOf(k);
      if (i >= 0 && (best < 0 || i < best)) best = i;
    }
    // 全角＠にも対応
    for (const k of keys) {
      const i = lower.indexOf('＠' + k.slice(1));
      if (i >= 0 && (best < 0 || i < best)) best = i;
    }
    if (best >= 0) found.push({ id: m.id, index: best });
  }
  return found.sort((a, b) => a.index - b.index).map((f) => f.id);
}
