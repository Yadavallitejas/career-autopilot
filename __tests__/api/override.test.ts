import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "../../app/api/achievement/[id]/override/route";
import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "../../db";
import { addBulletToResume, generateResumePdf } from "../../lib/resume/builder";
import { callAI } from "../../lib/ai/client";

// Mock Clerk auth
vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
}));

// Mock DB
const mockTransaction = vi.hoisted(() => vi.fn(async (callback: any) => {
  const mockTx = {
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn().mockResolvedValue({}),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn().mockResolvedValue({}),
    })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn().mockResolvedValue([
            { id: "version_2", isCurrent: true },
            { id: "version_1", isCurrent: false },
          ]),
        })),
      })),
    })),
  };
  return callback(mockTx);
}));

vi.mock("../../db", () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
    transaction: mockTransaction,
  },
}));

// Mock Builder
vi.mock("../../lib/resume/builder", () => ({
  addBulletToResume: vi.fn(),
  generateResumePdf: vi.fn(),
}));

// Mock AI client
vi.mock("../../lib/ai/client", () => ({
  callAI: vi.fn(),
}));

describe("POST /api/achievement/[id]/override", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createRequest = (body: any) => {
    return new NextRequest("http://localhost/api/achievement/ach_123/override", {
      method: "POST",
      body: JSON.stringify(body),
    });
  };

  it("should return 401 if user is not authenticated", async () => {
    vi.mocked(auth).mockReturnValue({ userId: null } as any);

    const req = createRequest({ action: "add_to_resume" });
    const res = await POST(req, { params: { id: "ach_123" } });

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("Unauthorized");
  });

  it("should return 404 if user is not found in database", async () => {
    vi.mocked(auth).mockReturnValue({ userId: "clerk_123" } as any);

    // Mock db.select for user to return empty array
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue([]),
        })),
      })),
    } as any);

    const req = createRequest({ action: "add_to_resume" });
    const res = await POST(req, { params: { id: "ach_123" } });

    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe("User not found");
  });

  it("should return 404 if achievement is not found", async () => {
    vi.mocked(auth).mockReturnValue({ userId: "clerk_123" } as any);

    // User select succeeds
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue([{ id: "user_123" }]),
        })),
      })),
    } as any);

    // Achievement select returns empty array
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue([]),
        })),
      })),
    } as any);

    const req = createRequest({ action: "add_to_resume" });
    const res = await POST(req, { params: { id: "ach_123" } });

    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe("Achievement not found");
  });

  it("should return 400 for invalid action", async () => {
    vi.mocked(auth).mockReturnValue({ userId: "clerk_123" } as any);

    // User select succeeds
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue([{ id: "user_123" }]),
        })),
      })),
    } as any);

    // Achievement select succeeds
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue([{ id: "ach_123", rawInput: "Learned a lot" }]),
        })),
      })),
    } as any);

    const req = createRequest({ action: "invalid_action" });
    const res = await POST(req, { params: { id: "ach_123" } });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Invalid action");
  });

  it("should successfully add to resume and compile pdf", async () => {
    vi.mocked(auth).mockReturnValue({ userId: "clerk_123" } as any);

    // User select succeeds
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue([{ id: "user_123" }]),
        })),
      })),
    } as any);

    // Achievement select succeeds with pre-defined bullet and section
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue([
            {
              id: "ach_123",
              userId: "user_123",
              rawInput: "Built a great serverless function with high availability.",
              resumeBullet: "Engineered scalable serverless endpoints reducing response times.",
              resumeSection: "Experience",
            },
          ]),
        })),
      })),
    } as any);

    // Current resume select succeeds
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue([
            {
              id: "resume_123",
              userId: "user_123",
              templateId: "classic",
              isCurrent: true,
              rawText: JSON.stringify({ experience: [] }),
            },
          ]),
        })),
      })),
    } as any);

    const mockUpdatedData = { experience: [{ bullets: ["Engineered scalable serverless endpoints reducing response times."] }] };
    vi.mocked(addBulletToResume).mockResolvedValue(mockUpdatedData);
    vi.mocked(generateResumePdf).mockResolvedValue({
      fileUrl: "http://supabase.com/resume.pdf",
      rawText: JSON.stringify(mockUpdatedData),
    });

    const req = createRequest({ action: "add_to_resume" });
    const res = await POST(req, { params: { id: "ach_123" } });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.action).toBe("add_to_resume");
    expect(data.bullet).toBe("Engineered scalable serverless endpoints reducing response times.");
    expect(data.section).toBe("Experience");

    expect(addBulletToResume).toHaveBeenCalledWith(
      { experience: [] },
      "Experience",
      "Engineered scalable serverless endpoints reducing response times."
    );
    expect(generateResumePdf).toHaveBeenCalled();
  });

  it("should successfully remove from resume and revert to previous version", async () => {
    vi.mocked(auth).mockReturnValue({ userId: "clerk_123" } as any);

    // User select succeeds
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue([{ id: "user_123" }]),
        })),
      })),
    } as any);

    // Achievement select succeeds
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue([{ id: "ach_123", userId: "user_123" }]),
        })),
      })),
    } as any);

    const req = createRequest({ action: "remove_from_resume" });
    const res = await POST(req, { params: { id: "ach_123" } });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.action).toBe("remove_from_resume");
    expect(mockTransaction).toHaveBeenCalled();
  });
});
