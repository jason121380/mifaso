import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";

const CreateSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().min(1).max(100),
  password: z.string().min(8),
  role: z.enum(["ADMIN", "EDITOR", "AUTHOR"]).default("AUTHOR"),
  bio: z.string().optional(),
});

export async function GET() {
  const session = await auth();
  const user = session?.user as any;
  if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, avatar: true, bio: true, active: true, createdAt: true, _count: { select: { articles: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const user = session?.user as any;
  if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const data = parsed.data;
  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) return NextResponse.json({ error: "此帳號已被使用" }, { status: 409 });

  const password = await bcrypt.hash(data.password, 12);
  const newUser = await prisma.user.create({
    data: { ...data, password },
    select: { id: true, name: true, email: true, role: true, active: true, createdAt: true, _count: { select: { articles: true } } },
  });
  return NextResponse.json(newUser, { status: 201 });
}
