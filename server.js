import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

app.post("/chat", async (req, res) => {
  try {
    const userMessage = req.body.message;
    const weather = req.body.weather;

    console.log("Message:", userMessage);
    console.log("FULL WEATHER OBJECT:", JSON.stringify(weather, null, 2));

    // Normalize weather data to handle any format
    const normalizedWeather = {
      city: weather.city || "Unknown",
      temp: weather.temp || weather.temperature || weather.main?.temp,
      condition: weather.condition || weather.description || weather.weather?.[0]?.description
    };

    console.log("Normalized weather:", normalizedWeather);

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "openai/gpt-3.5-turbo",
        messages: [
          {
            role: "user",
            content: `You have weather information for the following city:

City: ${normalizedWeather.city}
Temperature: ${normalizedWeather.temp}°C
Condition: ${normalizedWeather.condition}

Using ONLY this weather data, answer the user's question.

Question: ${userMessage}`
          }
        ]
      })
    });

    const data = await response.json();

    console.log("FULL API RESPONSE:", data);

    if (data.error) {
      return res.json({ reply: data.error.message });
    }

    const reply = data.choices?.[0]?.message?.content || "No response";

    res.json({ reply });

  } catch (err) {
    console.error("ERROR:", err);
    res.json({ reply: "Server error" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});