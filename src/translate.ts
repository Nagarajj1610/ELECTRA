import { TranslationServiceClient } from '@google-cloud/translate';
import dotenv from 'dotenv';
import logger from './logger.ts';
dotenv.config();

const translationClient = new TranslationServiceClient();

// Use project from env — required for Cloud Translation API v3
const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || '';
const location = 'global';

/**
 * Translates text to the target language using Google Cloud Translation API v3.
 * Falls back to returning the original text if translation fails.
 */
export const translateText = async (text: string, targetLanguage: 'hi' | 'en'): Promise<string> => {
  if (!projectId) {
    logger.warn('GOOGLE_CLOUD_PROJECT not set — skipping translation');
    return text;
  }

  try {
    const request = {
      parent: `projects/${projectId}/locations/${location}`,
      contents: [text],
      mimeType: 'text/plain' as const,
      targetLanguageCode: targetLanguage,
    };

    const [response] = await translationClient.translateText(request);
    const translated = response.translations?.[0]?.translatedText;
    if (!translated) throw new Error('Empty translation response');
    return translated;
  } catch (error: any) {
    logger.error(`Translation error (target=${targetLanguage}): ${error?.message || error}`);
    return text; // graceful fallback: return original text
  }
};
