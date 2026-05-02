import { TranslationServiceClient } from '@google-cloud/translate';
import { env } from './config/env.ts';
import logger from './logger.ts';

const translationClient = new TranslationServiceClient();

/**
 * Translates text between English and Hindi using Google Cloud Translation API.
 * @param {string} text - The text to translate
 * @param {string} targetLanguage - The target language code ('en' or 'hi')
 * @returns {Promise<string>} The translated text
 */
export const translateText = async (text: string, targetLanguage: string): Promise<string> => {
  if (!env.GOOGLE_CLOUD_PROJECT || env.GOOGLE_CLOUD_PROJECT === 'test') {
    return `[Mock Translation to ${targetLanguage}] ${text}`;
  }

  try {
    const [response] = await translationClient.translateText({
      parent: `projects/${env.GOOGLE_CLOUD_PROJECT}/locations/global`,
      contents: [text],
      mimeType: 'text/plain',
      targetLanguageCode: targetLanguage,
    });

    return response.translations?.[0]?.translatedText || text;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Translation error: ${message}`);
    return text; // Fallback to original text
  }
};
