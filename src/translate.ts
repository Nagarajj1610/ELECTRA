import { TranslationServiceClient } from '@google-cloud/translate';
import logger from './logger.ts';
import { env } from './config/env.ts';

const translationClient = new TranslationServiceClient();
const location = 'global';

/**
 * Checks if the translation project is configured.
 * @returns {string} Project ID or empty
 */
const getProjectId = (): string => env.GOOGLE_CLOUD_PROJECT || '';

/**
 * Calls the Google Cloud Translation API.
 * @param {string} text - Text to translate
 * @param {string} target - Target language code
 * @param {string} projectId - GCP project ID
 * @returns {Promise<string>} Translated text
 */
const callTranslationApi = async (text: string, target: string, projectId: string): Promise<string> => {
  const request = {
    parent: `projects/${projectId}/locations/${location}`,
    contents: [text],
    mimeType: 'text/plain' as const,
    targetLanguageCode: target,
  };
  const [response] = await translationClient.translateText(request);
  const translated = response.translations?.[0]?.translatedText;
  if (!translated) throw new Error('Empty translation response');
  return translated;
};

/**
 * Translates text to the target language using Google Cloud Translation API v3.
 * Falls back to returning the original text if translation fails.
 * @param {string} text - The input text
 * @param {'hi' | 'en'} targetLanguage - The target language
 * @returns {Promise<string>} The translated text
 */
export const translateText = async (text: string, targetLanguage: 'hi' | 'en'): Promise<string> => {
  const projectId = getProjectId();
  if (!projectId) {
    logger.warn('GOOGLE_CLOUD_PROJECT not set — skipping translation');
    return text;
  }

  try {
    return await callTranslationApi(text, targetLanguage, projectId);
  } catch (error: any) {
    logger.error(`Translation error (target=${targetLanguage}): ${error?.message || error}`);
    return text;
  }
};
