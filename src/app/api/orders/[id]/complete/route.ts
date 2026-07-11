import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "@/utils/jwt.util";
import pool from "@/lib/db";

type Params = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(
  req: NextRequest,
  { params }: Params
) {
  try {
    const authHeader = req.headers.get("Authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const token = authHeader.split(" ")[1];

    const decoded = verifyAccessToken(token);

    if (!decoded) {
      return NextResponse.json(
        { success: false, error: "Invalid token" },
        { status: 401 }
      );
    }

    const { id } = await params;

    const orderId = Number(id);

    const [rows]: any = await pool.query(
      `
      SELECT id,user_id,status
      FROM orders
      WHERE id=?
      `,
      [orderId]
    );

    if (rows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Order tidak ditemukan",
        },
        { status: 404 }
      );
    }

    const order = rows[0];

    if (Number(order.user_id) !== Number(decoded.sub)) {
      return NextResponse.json(
        {
          success: false,
          error: "Forbidden",
        },
        { status: 403 }
      );
    }

    if (order.status !== "shipped") {
      return NextResponse.json(
        {
          success: false,
          error: "Order belum dikirim",
        },
        { status: 400 }
      );
    }

    await pool.query(
      `
      UPDATE orders
      SET
          status='completed',
          delivered_at=NOW(),
          updated_at=NOW()
      WHERE id=?
      `,
      [orderId]
    );

    return NextResponse.json({
      success: true,
      message: "Pesanan selesai.",
    });

  } catch (err: any) {

    console.error(err);

    return NextResponse.json(
      {
        success: false,
        error: err.message,
      },
      {
        status: 500,
      }
    );
  }
}