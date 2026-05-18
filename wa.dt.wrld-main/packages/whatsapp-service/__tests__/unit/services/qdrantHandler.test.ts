/**
 * Qdrant Handler Utilities Tests
 *
 * Tests for hybrid search utilities including:
 * - Keyword extraction
 * - Message classification
 * - Content normalization
 * - RRF fusion
 * - Importance/TTL calculation
 */

// Set env vars before any imports
process.env.API_KEY = process.env.API_KEY || 'test-api-key';

import {
  extractKeywords,
  normalizeContent,
  classifyMessageType,
  determineTtlCategory,
  calculateImportance,
  reciprocalRankFusion,
  STOPWORDS,
} from '../../../src/services/qdrantHandler';

describe('Hybrid Search Utilities', () => {
  describe('extractKeywords', () => {
    it('should extract meaningful keywords from text', () => {
      const text = 'What is the weather like today in San Francisco?';
      const keywords = extractKeywords(text);

      expect(keywords).toContain('weather');
      expect(keywords).toContain('today');
      expect(keywords).toContain('san');
      expect(keywords).toContain('francisco');
      // Stopwords should be filtered
      expect(keywords).not.toContain('what');
      expect(keywords).not.toContain('the');
      expect(keywords).not.toContain('is');
    });

    it('should return empty array for text with only stopwords', () => {
      const text = 'the a an is are';
      const keywords = extractKeywords(text);

      expect(keywords).toEqual([]);
    });

    it('should limit keywords to maxKeywords parameter', () => {
      const text = 'apple banana cherry date elderberry fig grape honeydew kiwi lemon mango nectarine';
      const keywords = extractKeywords(text, 5);

      expect(keywords.length).toBeLessThanOrEqual(5);
    });

    it('should sort keywords by frequency', () => {
      const text = 'python python python javascript javascript typescript';
      const keywords = extractKeywords(text);

      expect(keywords[0]).toBe('python');
      expect(keywords[1]).toBe('javascript');
    });

    it('should filter out short words (< 3 chars)', () => {
      const text = 'go is a programming language';
      const keywords = extractKeywords(text);

      expect(keywords).not.toContain('go');
      expect(keywords).toContain('programming');
      expect(keywords).toContain('language');
    });
  });

  describe('normalizeContent', () => {
    it('should lowercase and remove punctuation', () => {
      const text = 'Hello, World! How are YOU?';
      const normalized = normalizeContent(text);

      expect(normalized).not.toContain('!');
      expect(normalized).not.toContain('?');
      expect(normalized).not.toContain(',');
      expect(normalized.toLowerCase()).toBe(normalized);
    });

    it('should remove stopwords', () => {
      const text = 'The quick brown fox jumps over the lazy dog';
      const normalized = normalizeContent(text);

      expect(normalized).not.toContain('the');
      expect(normalized).not.toContain('over');
      expect(normalized).toContain('quick');
      expect(normalized).toContain('brown');
      expect(normalized).toContain('fox');
    });
  });

  describe('classifyMessageType', () => {
    it('should classify greetings', () => {
      expect(classifyMessageType('Hi there!')).toBe('greeting');
      expect(classifyMessageType('Hello')).toBe('greeting');
      expect(classifyMessageType('hey')).toBe('greeting');
      expect(classifyMessageType('Good morning everyone')).toBe('greeting');
    });

    it('should classify questions', () => {
      expect(classifyMessageType('What is your name?')).toBe('question');
      expect(classifyMessageType('How does this work')).toBe('question');
      expect(classifyMessageType('Why is the sky blue?')).toBe('question');
      expect(classifyMessageType('Can you help me?')).toBe('question');
    });

    it('should classify commands', () => {
      expect(classifyMessageType('Please send me the report')).toBe('command');
      expect(classifyMessageType('Show me the latest updates')).toBe('command');
      expect(classifyMessageType('Help me with this task')).toBe('command');
      expect(classifyMessageType('Find the file')).toBe('command');
    });

    it('should classify statements', () => {
      expect(classifyMessageType('The meeting is at 3pm')).toBe('statement');
      expect(classifyMessageType('I completed the task yesterday')).toBe('statement');
      expect(classifyMessageType('Python is a great language')).toBe('statement');
    });
  });

  describe('determineTtlCategory', () => {
    it('should mark greetings as ephemeral', () => {
      expect(determineTtlCategory('Hi!', 'greeting')).toBe('ephemeral');
      expect(determineTtlCategory('Hello there', 'greeting')).toBe('ephemeral');
    });

    it('should mark short messages as session-level', () => {
      expect(determineTtlCategory('Yes', 'statement')).toBe('session');
      expect(determineTtlCategory('Send file', 'command')).toBe('session');
    });

    it('should mark longer statements as persistent', () => {
      const longText = 'This is a longer message that contains important information about the project timeline and deliverables that should be remembered.';
      expect(determineTtlCategory(longText, 'statement')).toBe('persistent');
    });

    it('should mark questions as persistent', () => {
      const question = 'What is the deadline for the quarterly report submission?';
      expect(determineTtlCategory(question, 'question')).toBe('persistent');
    });
  });

  describe('calculateImportance', () => {
    it('should give higher importance to questions', () => {
      const questionImportance = calculateImportance('What is the deadline?', 'question');
      const statementImportance = calculateImportance('The meeting is at 3pm', 'statement');

      expect(questionImportance).toBeGreaterThan(statementImportance);
    });

    it('should give low importance to greetings', () => {
      const greetingImportance = calculateImportance('Hi!', 'greeting');

      expect(greetingImportance).toBeLessThan(0.5);
    });

    it('should give higher importance to longer content', () => {
      const shortImportance = calculateImportance('OK', 'statement');
      const longText = 'This is a comprehensive explanation of the project requirements including deadlines, deliverables, and team responsibilities.';
      const longImportance = calculateImportance(longText, 'statement');

      expect(longImportance).toBeGreaterThan(shortImportance);
    });

    it('should cap importance at 1.0', () => {
      const longQuestion = 'What is the comprehensive plan for the entire Q4 2024 including all milestones, deliverables, and budget allocations for each department?';
      const importance = calculateImportance(longQuestion, 'question');

      expect(importance).toBeLessThanOrEqual(1.0);
    });
  });

  describe('reciprocalRankFusion', () => {
    it('should combine vector and keyword results', () => {
      const vectorResults = [
        { id: 'a', score: 0.9 },
        { id: 'b', score: 0.8 },
        { id: 'c', score: 0.7 },
      ];

      const keywordResults = [
        { id: 'b', score: 0.95 },
        { id: 'd', score: 0.85 },
        { id: 'a', score: 0.75 },
      ];

      const fused = reciprocalRankFusion(vectorResults, keywordResults);

      // Results should be sorted by combined score
      expect(fused.length).toBeGreaterThan(0);
      expect(fused[0].score).toBeGreaterThanOrEqual(fused[1].score);

      // Items appearing in both lists should have higher scores
      const itemA = fused.find(r => r.id === 'a');
      const itemD = fused.find(r => r.id === 'd');

      expect(itemA).toBeDefined();
      expect(itemD).toBeDefined();
      // 'a' appears in both lists, 'd' only in keyword
      expect(itemA!.score).toBeGreaterThan(itemD!.score);
    });

    it('should respect vector weight parameter', () => {
      const vectorResults = [{ id: 'v1', score: 0.9 }];
      const keywordResults = [{ id: 'k1', score: 0.9 }];

      const fusedHighVector = reciprocalRankFusion(vectorResults, keywordResults, 0.9);
      const fusedLowVector = reciprocalRankFusion(vectorResults, keywordResults, 0.1);

      const v1HighVector = fusedHighVector.find(r => r.id === 'v1')!.score;
      const v1LowVector = fusedLowVector.find(r => r.id === 'v1')!.score;

      expect(v1HighVector).toBeGreaterThan(v1LowVector);
    });

    it('should handle empty inputs', () => {
      const fused1 = reciprocalRankFusion([], [{ id: 'a', score: 0.9 }]);
      const fused2 = reciprocalRankFusion([{ id: 'b', score: 0.9 }], []);
      const fused3 = reciprocalRankFusion([], []);

      expect(fused1.length).toBe(1);
      expect(fused2.length).toBe(1);
      expect(fused3.length).toBe(0);
    });

    it('should track individual scores', () => {
      const vectorResults = [{ id: 'a', score: 0.9 }];
      const keywordResults = [{ id: 'a', score: 0.8 }];

      const fused = reciprocalRankFusion(vectorResults, keywordResults);
      const result = fused.find(r => r.id === 'a')!;

      expect(result.vectorScore).toBe(0.9);
      expect(result.keywordScore).toBe(0.8);
    });
  });

  describe('STOPWORDS', () => {
    it('should contain common English stopwords', () => {
      expect(STOPWORDS.has('the')).toBe(true);
      expect(STOPWORDS.has('a')).toBe(true);
      expect(STOPWORDS.has('is')).toBe(true);
      expect(STOPWORDS.has('are')).toBe(true);
      expect(STOPWORDS.has('and')).toBe(true);
    });

    it('should not contain meaningful words', () => {
      expect(STOPWORDS.has('python')).toBe(false);
      expect(STOPWORDS.has('code')).toBe(false);
      expect(STOPWORDS.has('meeting')).toBe(false);
    });
  });
});
