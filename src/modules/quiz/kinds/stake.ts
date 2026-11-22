import { z } from "zod";
import { KindError, QuestionKind, baseSettings, parsePayload } from "./types";

export const stakeSettings = z.object({
  ...baseSettings,
  /** потолок ставки: счёт игрока, цена вопроса или фиксированное число */
  maxStake: z.union([z.literal("score"), z.literal("price"), z.number().int().positive()]).default("price"),
});

/** Вопрос со ставкой: set_stake, затем begin_play. Верно: +ставка, неверно: −ставка. */
export const stakeKind: QuestionKind = {
  kind: "stake",
  settingsSchema: stakeSettings,
  initState: () => ({ phase: "prepare", stake: null, participantId: null }),
  commands: {
    set_stake(state, payload, ctx, q) {
      const { participantId, amount } = parsePayload(z.object({ participantId: z.uuid().optional(), amount: z.number().int().positive() }), payload);
      const s = stakeSettings.parse(q.settings);
      const who = participantId ?? ctx.activeParticipantId;
      if (participantId && !ctx.players.some((p) => p.id === participantId)) throw new KindError("VALIDATION_ERROR", "Этого игрока нет в сессии");
      let max: number;
      if (s.maxStake === "price") max = q.price;
      else if (s.maxStake === "score") {
        const player = ctx.players.find((p) => p.id === who);
        if (!player) throw new KindError("VALIDATION_ERROR", "Укажите participantId или выберите активного игрока: потолок ставки зависит от счёта");
        max = Math.max(0, player.score);
      } else max = s.maxStake;
      if (amount > max) throw new KindError("VALIDATION_ERROR", `Ставка не может быть больше ${max}`, { maxStake: max });
      return { ...state, stake: amount, participantId: participantId ?? state.participantId };
    },
  },
  commandRules: { set_stake: { phase: "prepare" } },
  activeParticipant: (_q, state) => state.participantId,
  canBeginPlay: (_q, state) => (state.stake ? null : "Сначала сделайте ставку (set_stake)"),
  project(q, state) {
    const s = stakeSettings.parse(q.settings);
    return { stake: state.stake, participantId: state.participantId, maxStake: s.maxStake };
  },
  points: (q, state) => {
    const stake = state.stake ?? q.price;
    return { ifCorrect: stake, ifWrong: q.settings?.noPenalty ? 0 : -stake };
  },
};
