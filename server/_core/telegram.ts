import { ENV } from "./env";

/** Sends an operational message without exposing the bot token to ESP32. */
export async function sendTelegramMessage(text: string): Promise<boolean> {
  if (!ENV.telegramBotToken || !ENV.telegramChatId) return false;

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${ENV.telegramBotToken}/sendMessage`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chat_id: ENV.telegramChatId,
          text,
          disable_web_page_preview: true,
        }),
      }
    );
    if (!response.ok) {
      console.warn(`[Telegram] sendMessage failed: HTTP ${response.status}`);
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[Telegram] Unable to send message:", error);
    return false;
  }
}
