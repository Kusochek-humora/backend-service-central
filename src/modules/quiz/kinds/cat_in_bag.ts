import { z } from "zod";
import { KindError, QuestionKind, baseSettings, parsePayload, symmetricPoints } from "./types";

export const catInBagSettings = z.object({
  ...baseSettings,
  priceOverride: z.number().int().positive().optional(),
  allowSelf: z.boolean().default(false),
  teaser: z.string().max(500).optional(),
});

/**
 * «Кот в мешке»: сначала заставка без содержимого (phase=prepare), оператор выбирает получателя
 * (choose_recipient), затем begin_play. Отвечает выбранный игрок — он становится активным.
 */
export const catInBagKind: QuestionKind = {
  kind: "cat_in_bag",
  settingsSchema: catInBagSettings,
  // chooserId — кто открыл вопрос (активный на момент открытия); себе передавать нельзя, если allowSelf=false
  initState: (_q, ctx) => ({ phase: "prepare", chooserId: ctx.activeParticipantId, recipientId: null }),
  commands: {
    choose_recipient(state, payload, ctx, q) {
      const { participantId } = parsePayload(z.object({ participantId: z.uuid() }), payload);
      const s = catInBagSettings.parse(q.settings);
      if (!ctx.players.some((p) => p.id === participantId)) throw new KindError("VALIDATION_ERROR", "Этого игрока нет в сессии");
      if (!s.allowSelf && participantId === state.chooserId) {
        throw new KindError("VALIDATION_ERROR", "Нельзя передать вопрос самому себе (allowSelf=false)");
      }
      return { ...state, recipientId: participantId };
    },
  },
  commandRules: { choose_recipient: { phase: "prepare" } },
  activeParticipant: (_q, state) => state.recipientId,
  canBeginPlay: (_q, state) => (state.recipientId ? null : "Сначала выберите получателя (choose_recipient)"),
  project(q, state) {
    const s = catInBagSettings.parse(q.settings);
    return { teaser: s.teaser, allowSelf: s.allowSelf, recipientId: state.recipientId, price: s.priceOverride ?? q.price };
  },
  points: (q) => symmetricPoints(q, catInBagSettings.parse(q.settings).priceOverride ?? q.price),
};
