app.post("/ai/copilot", requireAuth, async (req: any, res) => {
  try {
    const { message } = req.body;
    const userId = req.user.id;

    const history = await pool.query(
      `
      SELECT 'flight' as type, created_at FROM bookings WHERE user_id=$1
      UNION ALL
      SELECT 'tour' as type, created_at FROM tour_bookings WHERE user_id=$1
      ORDER BY created_at DESC
      LIMIT 10
      `,
      [userId]
    );

    const response = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content:
                "You are a personal travel AI assistant. Use user history only.",
            },
            {
              role: "user",
              content: JSON.stringify({
                message,
                history: history.rows,
              }),
            },
          ],
        }),
      }
    );

    const data = await response.json();

    const reply =
      data?.choices?.[0]?.message?.content ??
      "I couldn't generate a response.";

    return res.json({ reply });
  } catch (err) {
    console.log("COPILOT ERROR:", err);

    return res.status(200).json({
      reply: "⚠️ AI temporarily unavailable",
    });
  }
});