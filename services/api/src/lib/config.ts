export const config = {
  chat: {
    previewSeconds: 10,
    primaryChatSeconds: 120,
    extendChatSeconds: 300,
    extendHandshakeSeconds: 15,
  },

  cooldowns: {
    pairCooldownHours: 16,
  },

  gems: {
    dailyRegenSeconds: 24 * 60 * 60, // 1 gem per day
    defaultMax: 3,
    defaultStart: 3,
    fullReminderEveryHours: 72,
  },
};
