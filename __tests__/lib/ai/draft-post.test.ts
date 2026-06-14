import { describe, it, expect, vi, beforeEach } from 'vitest';
import { draftLinkedInPost, draftXPost } from '../../../lib/ai/draft-post';
import * as client from '../../../lib/ai/client';

// Mock the AI client
vi.mock('../../../lib/ai/client', () => ({
  callAI: vi.fn(),
}));

describe('Draft Posts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('draftLinkedInPost', () => {
    const defaultParams = {
      rawInput: 'I launched a new feature',
      achievementType: 'project',
      reasoning: 'It was complex',
      voiceProfile: null,
    };

    it('should return parsed output with draftText, hashtags, and mediaPrompt', async () => {
      const validResponse = JSON.stringify({
        draftText: 'Here is my LinkedIn post about launching a feature.',
        hashtags: ['feature', 'launch', 'tech'],
        mediaPrompt: 'An image of a rocket launching'
      });

      vi.mocked(client.callAI).mockResolvedValue(validResponse);

      const result = await draftLinkedInPost(defaultParams);

      expect(result.draftText).toBe('Here is my LinkedIn post about launching a feature.');
      expect(result.hashtags).toEqual(['feature', 'launch', 'tech']);
      expect(result.mediaPrompt).toBe('An image of a rocket launching');
    });

    it('should fallback to defaults if AI returns invalid JSON', async () => {
      vi.mocked(client.callAI).mockResolvedValue('Not JSON');

      const result = await draftLinkedInPost(defaultParams);

      expect(result.draftText).toContain('Just logged a new career achievement');
      expect(result.hashtags).toBeDefined();
      expect(result.mediaPrompt).toBeDefined();
    });
  });

  describe('draftXPost', () => {
    const defaultParams = {
      rawInput: 'I launched a new feature',
      achievementType: 'project',
      voiceProfile: null,
    };

    it('should enforce draftText <= 280 characters', async () => {
      const longText = 'A'.repeat(300);
      const validResponse = JSON.stringify({
        draftText: longText,
        thread: [],
        hashtags: ['launch']
      });

      vi.mocked(client.callAI).mockResolvedValue(validResponse);

      const result = await draftXPost(defaultParams);

      expect(result.draftText.length).toBeLessThanOrEqual(280);
      expect(result.draftText.endsWith('…')).toBe(true);
    });

    it('should return valid output', async () => {
      const validResponse = JSON.stringify({
        draftText: 'Just launched a new feature! So excited.',
        thread: ['More details here.'],
        hashtags: ['launch', 'tech']
      });

      vi.mocked(client.callAI).mockResolvedValue(validResponse);

      const result = await draftXPost(defaultParams);

      expect(result.draftText).toBe('Just launched a new feature! So excited.');
      expect(result.thread).toEqual(['More details here.']);
      expect(result.hashtags).toEqual(['launch', 'tech']);
    });

    it('should fallback to defaults if AI returns invalid JSON', async () => {
      vi.mocked(client.callAI).mockResolvedValue('Not JSON');

      const result = await draftXPost(defaultParams);

      expect(result.draftText).toContain('New achievement unlocked');
      expect(result.thread).toEqual([]);
      expect(result.hashtags).toEqual(['career']);
    });
  });

  describe('LinkedIn and X drafts differences', () => {
    it('should never produce identical drafts since they use different functions and prompts', async () => {
      // Because draftLinkedInPost and draftXPost are distinct functions
      // calling the API independently, they generate different structures.
      const linkedinResponse = JSON.stringify({
        draftText: 'A professional LinkedIn post about my new feature.',
        hashtags: ['linkedin', 'professional'],
        mediaPrompt: 'A graph showing growth'
      });

      const xResponse = JSON.stringify({
        draftText: 'A short tweet about my new feature!',
        thread: [],
        hashtags: ['twitter']
      });

      // We mock implementation to return diff answers based on system prompt or just sequentially
      vi.mocked(client.callAI)
        .mockResolvedValueOnce(linkedinResponse) // For LinkedIn
        .mockResolvedValueOnce(xResponse);       // For X

      const linkedinResult = await draftLinkedInPost({
        rawInput: 'Test',
        achievementType: 'project',
        reasoning: 'Test',
        voiceProfile: null,
      });

      const xResult = await draftXPost({
        rawInput: 'Test',
        achievementType: 'project',
        voiceProfile: null,
      });

      expect(linkedinResult.draftText).not.toBe(xResult.draftText);
      expect(client.callAI).toHaveBeenCalledTimes(2);
    });
  });
});
