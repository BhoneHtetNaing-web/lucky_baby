// app.post("/ai/chat", async (req: Request, res: Response) => {
//   try {
//     const { message } = req.body;

//     if (!message) {
//       return res.status(400).json({ reply: "Message required" });
//     }

//     const text = message.toLowerCase();

//     // =============================
//     // 🧠 AUTO INTENT DETECTION
//     // =============================

//     const run = async (q: string, p?: any[]) =>
//       (await pool.query(q, p || [])).rows;

//     let contextData: any = null;

//     // ✈️ Flights
//     if (text.includes("flight")) {
//       contextData = await run(
//         "SELECT from_city, to_city, price FROM flights ORDER BY price ASC LIMIT 5"
//       );
//     }

//     // 🏝 Tours
//     if (text.includes("tour")) {
//       contextData = await run(
//         "SELECT name, price FROM tours ORDER BY price ASC LIMIT 5"
//       );
//     }

//     // 📊 User bookings
//     if (text.includes("my booking")) {
//       contextData = await run(
//         "SELECT status, seat, ticket_code FROM bookings ORDER BY created_at DESC LIMIT 5"
//       );
//     }

//     // 💳 Payments
//     if (text.includes("payment")) {
//       contextData = await run(
//         "SELECT amount, status FROM payments ORDER BY created_at DESC LIMIT 5"
//       );
//     }

//     // =============================
//     // 🤖 GPT WITH CONTEXT
//     // =============================

//     const response = await fetch("https://api.openai.com/v1/chat/completions", {
//       method: "POST",
//       headers: {
//         Authorization: `Bearer ${process.env.OPENAI_KEY}`,
//         "Content-Type": "application/json",
//       },
//       body: JSON.stringify({
//         model: "gpt-4o-mini",
//         messages: [
//           {
//             role: "system",
//             content: `
// You are a powerful travel AI inside a booking app.

// You have access to real-time data:
// ${JSON.stringify(contextData)}

// Rules:
// - Always give helpful answers
// - Suggest cheapest/best options
// - Be short but smart
// - If data exists, use it
//             `,
//           },
//           { role: "user", content: message },
//         ],
//       }),
//     });

//     const data = await response.json();

//     return res.json({
//       reply:
//         data?.choices?.[0]?.message?.content ||
//         "I can help with flights, tours, bookings, and payments.",
//     });
//   } catch (err) {
//     console.log(err);
//     res.status(500).json({ reply: "AI error" });
//   }
// });
// app.post("/ai/smart-chat", async (req: Request, res: Response) => {
//   try {
//     const { message } = req.body;

//     if (!message) {
//       return res.status(400).json({ reply: "Message required" });
//     }

//     // =============================
//     // 🧠 STEP 1: AI GENERATE SQL
//     // =============================

//     const sqlGen = await fetch("https://api.openai.com/v1/chat/completions", {
//       method: "POST",
//       headers: {
//         Authorization: `Bearer ${process.env.OPENAI_KEY}`,
//         "Content-Type": "application/json",
//       },
//       body: JSON.stringify({
//         model: "gpt-4o-mini",
//         messages: [
//           {
//             role: "system",
//             content: `
// You are a SQL generator for a travel booking system.

// Tables:
// - flights(id, from_city, to_city, price, departure_time)
// - bookings(id, user_id, flight_id, seat, status, created_at)
// - tours(id, name, price)
// - payments(id, booking_id, amount, status, created_at)
// - users(id, email)

// Rules:
// - ONLY generate SELECT queries
// - NO DELETE, UPDATE, INSERT
// - LIMIT results to 10
// - Always safe queries
// Return ONLY SQL, no explanation.
//             `,
//           },
//           {
//             role: "user",
//             content: message,
//           },
//         ],
//       }),
//     });

//     const sqlData = await sqlGen.json();
//     let query = sqlData?.choices?.[0]?.message?.content;

//     if (!query) {
//       return res.json({ reply: "I couldn't understand that." });
//     }

//     query = query.trim();

//     // =============================
//     // 🛡 SECURITY FILTER
//     // =============================

//     const blocked = ["delete", "update", "insert", "drop", "alter"];

//     if (blocked.some((b) => query.toLowerCase().includes(b))) {
//       return res.json({
//         reply: "⚠️ Unsafe query blocked.",
//       });
//     }

//     // =============================
//     // ⚡ STEP 2: RUN QUERY
//     // =============================

//     let dbResult;
//     try {
//       dbResult = await pool.query(query);
//     } catch (err) {
//       return res.json({
//         reply: "⚠️ Query failed. Try rephrasing.",
//       });
//     }

//     // =============================
//     // 🤖 STEP 3: AI EXPLAIN RESULT
//     // =============================

//     const explain = await fetch(
//       "https://api.openai.com/v1/chat/completions",
//       {
//         method: "POST",
//         headers: {
//           Authorization: `Bearer ${process.env.OPENAI_KEY}`,
//           "Content-Type": "application/json",
//         },
//         body: JSON.stringify({
//           model: "gpt-4o-mini",
//           messages: [
//             {
//               role: "system",
//               content: `
// You are a travel AI assistant.

// Explain database results in a human-friendly way.
// Keep it short, useful, and actionable.
//               `,
//             },
//             {
//               role: "user",
//               content: `
// User question: ${message}

// SQL Result:
// ${JSON.stringify(dbResult.rows)}
//               `,
//             },
//           ],
//         }),
//       }
//     );

//     const explainData = await explain.json();

//     return res.json({
//       reply:
//         explainData?.choices?.[0]?.message?.content ||
//         "No meaningful result.",
//     });
//   } catch (err) {
//     console.log("SMART AI ERROR:", err);
//     res.status(500).json({
//       reply: "⚠️ Smart AI failed.",
//     });
//   }
// });
// app.post("/admin/ai", requireAdmin, async (req, res) => {
//   try {
//     const { message } = req.body;
//     const text = message.toLowerCase();

//     const run = async (q: string) => (await pool.query(q)).rows;

//     let context: any = {};

//     // 💰 Revenue
//     if (text.includes("revenue")) {
//       context.revenue = await run(`
//         SELECT DATE(created_at) as date, SUM(amount) as total
//         FROM payments WHERE status='APPROVED'
//         GROUP BY DATE(created_at)
//         ORDER BY date DESC LIMIT 7
//       `);
//     }

//     // 📊 Bookings
//     if (text.includes("booking")) {
//       context.bookings = await run(`
//         SELECT COUNT(*) FROM bookings
//       `);
//     }

//     // 👑 Top users
//     if (text.includes("user")) {
//       context.users = await run(`
//         SELECT user_id, COUNT(*) as total
//         FROM bookings
//         GROUP BY user_id
//         ORDER BY total DESC LIMIT 5
//       `);
//     }

//     // =============================
//     // 🤖 GPT ADMIN BRAIN
//     // =============================

//     const response = await fetch("https://api.openai.com/v1/chat/completions", {
//       method: "POST",
//       headers: {
//         Authorization: `Bearer ${process.env.OPENAI_KEY}`,
//         "Content-Type": "application/json",
//       },
//       body: JSON.stringify({
//         model: "gpt-4o-mini",
//         messages: [
//           {
//             role: "system",
//             content: `
// You are an Admin AI dashboard assistant.

// Data:
// ${JSON.stringify(context)}

// You must:
// - explain metrics clearly
// - summarize trends
// - give insights
// - detect problems
//             `,
//           },
//           { role: "user", content: message },
//         ],
//       }),
//     });

//     const data = await response.json();

//     res.json({
//       reply:
//         data?.choices?.[0]?.message?.content ||
//         "Ask about revenue, users, or bookings.",
//     });
//   } catch (err) {
//     console.log(err);
//     res.status(500).json({ reply: "Admin AI error" });
//   }
// });