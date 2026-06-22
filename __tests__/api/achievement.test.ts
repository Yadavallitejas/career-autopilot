import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../../app/api/achievement/route';
import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '../../db';
import { enqueueAchievementJob } from '../../lib/queue/qstash';

// Mock the dependencies
vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
}));

vi.mock('../../db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue([{ id: 'user_1', plan: 'pro' }])
        }))
      }))
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: 'ach_1' }])
      }))
    })),
  }
}));

vi.mock('../../lib/queue/qstash', () => ({
  enqueueAchievementJob: vi.fn(),
}));

describe('POST /api/achievement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createRequest = (body: any) => {
    return new NextRequest('http://localhost/api/achievement', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  };

  it('should return 401 if user is not authenticated', async () => {
    vi.mocked(auth).mockReturnValue({ userId: null } as any);

    const req = createRequest({ rawInput: 'Valid input length here' });
    const res = await POST(req);

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 422 if body rawInput is too short (< 10 chars)', async () => {
    vi.mocked(auth).mockReturnValue({ userId: 'clerk_1' } as any);

    const req = createRequest({ rawInput: 'short' });
    const res = await POST(req);

    expect(res.status).toBe(422);
    const data = await res.json();
    expect(data.error).toBe('Achievement must be at least 10 characters.');
  });

  it('should return 422 if body rawInput is too long (> 2000 chars)', async () => {
    vi.mocked(auth).mockReturnValue({ userId: 'clerk_1' } as any);

    const longText = 'A'.repeat(2001);
    const req = createRequest({ rawInput: longText });
    const res = await POST(req);

    expect(res.status).toBe(422);
    const data = await res.json();
    expect(data.error).toBe('Achievement must be 2000 characters or fewer.');
  });

  it('should process correctly with valid body and auth', async () => {
    vi.mocked(auth).mockReturnValue({ userId: 'clerk_1' } as any);
    vi.mocked(enqueueAchievementJob).mockResolvedValue('msg_1');

    const req = createRequest({ rawInput: 'This is a valid achievement that is long enough.' });
    const res = await POST(req);

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.achievementId).toBe('ach_1');
    expect(data.status).toBe('processing');

    expect(enqueueAchievementJob).toHaveBeenCalledWith({
      achievementId: 'ach_1',
      userId: 'user_1'
    });
  });
});
