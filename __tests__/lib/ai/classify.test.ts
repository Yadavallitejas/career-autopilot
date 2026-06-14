import { describe, it, expect, vi, beforeEach } from 'vitest';
import { classifyAchievement } from '../../../lib/ai/classify';
import * as client from '../../../lib/ai/client';

// Mock the AI client
vi.mock('../../../lib/ai/client', () => ({
  callAI: vi.fn(),
}));

describe('classifyAchievement', () => {
  const defaultParams = {
    rawInput: 'I led a team that built a new feature.',
    existingResumeText: '',
    existingPortfolioProjects: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return parsed output and correct worthy flags when callAI returns valid JSON', async () => {
    const validResponse = JSON.stringify({
      resumeScore: 8,
      portfolioScore: 6,
      achievementType: 'project',
      reasoning: 'This is a solid project. Excellent teamwork.',
      resumeSection: 'Projects',
      resumeBullet: 'Led a team that built a new feature'
    });

    vi.mocked(client.callAI).mockResolvedValue(validResponse);

    const result = await classifyAchievement(defaultParams);

    expect(result.resumeScore).toBe(8);
    expect(result.portfolioScore).toBe(6);
    expect(result.achievementType).toBe('project');
    expect(result.resumeWorthy).toBe(true); // >= 7
    expect(result.portfolioWorthy).toBe(true); // >= 6
    expect(result.resumeBullet).toBe('Led a team that built a new feature');
    expect(result.resumeSection).toBe('Projects');
  });

  it('should strip markdown fences and return correct output', async () => {
    const markdownResponse = `\`\`\`json
    {
      "resumeScore": 8,
      "portfolioScore": 6,
      "achievementType": "project",
      "reasoning": "This is a solid project. Excellent teamwork.",
      "resumeSection": "Projects",
      "resumeBullet": "Led a team that built a new feature"
    }
    \`\`\``;

    vi.mocked(client.callAI).mockResolvedValue(markdownResponse);

    const result = await classifyAchievement(defaultParams);
    expect(result.resumeScore).toBe(8);
    expect(result.resumeWorthy).toBe(true);
  });

  it('should fallback to safe defaults if callAI returns invalid JSON', async () => {
    vi.mocked(client.callAI).mockResolvedValue('Oops, I forgot to write JSON');

    const result = await classifyAchievement(defaultParams);

    expect(result.resumeScore).toBe(5);
    expect(result.portfolioScore).toBe(4);
    expect(result.achievementType).toBe('other');
    expect(result.resumeWorthy).toBe(false);
    expect(result.portfolioWorthy).toBe(false);
  });

  it('should fallback to safe defaults if callAI returns valid JSON but fails schema (scores out of range)', async () => {
    const outOfRangeResponse = JSON.stringify({
      resumeScore: 11, // max is 10
      portfolioScore: 5,
      achievementType: 'project',
      reasoning: 'Reasoning goes here for validation',
      resumeSection: 'Projects',
      resumeBullet: 'Built feature'
    });

    vi.mocked(client.callAI).mockResolvedValue(outOfRangeResponse);

    const result = await classifyAchievement(defaultParams);

    expect(result.resumeScore).toBe(5);
    expect(result.resumeWorthy).toBe(false);
    expect(result.portfolioWorthy).toBe(false);
    // When schema validation fails but JSON is valid and contains reasoning, it uses safe defaults
    // but extracts reasoning if present and valid as string.
    expect(result.reasoning).toBe('Reasoning goes here for validation');
  });

  it('should clear bullet and section if achievement is not resume worthy', async () => {
    const lowScoreResponse = JSON.stringify({
      resumeScore: 6, // < 7 means not resume worthy
      portfolioScore: 2,
      achievementType: 'other',
      reasoning: 'Not very impactful.',
      resumeSection: 'Projects',
      resumeBullet: 'Did something'
    });

    vi.mocked(client.callAI).mockResolvedValue(lowScoreResponse);

    const result = await classifyAchievement(defaultParams);

    expect(result.resumeScore).toBe(6);
    expect(result.resumeWorthy).toBe(false);
    expect(result.portfolioWorthy).toBe(false);
    expect(result.resumeBullet).toBeNull(); // Cleared because not resume worthy
    expect(result.resumeSection).toBeNull(); // Cleared because not resume worthy
  });
});
