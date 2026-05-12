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

function getForecastSummary(weather) {
  const forecastDays = weather.forecast?.forecastday
    || weather.weatherData?.forecast?.forecastday
    || weather.forecastday;

  if (Array.isArray(forecastDays) && forecastDays.length > 0) {
    return forecastDays.slice(0, 3).map((day) => {
      const dayData = day.day || day;
      const condition = dayData.condition?.text || dayData.condition || dayData.description || "Unknown";
      const rainChance = dayData.daily_chance_of_rain || dayData.chance_of_rain || dayData.rainChance;
      const maxTemp = dayData.maxtemp_c || dayData.maxTemp || dayData.temp?.max;
      const minTemp = dayData.mintemp_c || dayData.minTemp || dayData.temp?.min;

      return {
        date: day.date || dayData.date,
        condition,
        rainChance,
        maxTemp,
        minTemp
      };
    });
  }

  const forecastList = weather.list || weather.weatherData?.list;

  if (Array.isArray(forecastList) && forecastList.length > 0) {
    return forecastList.slice(0, 8).map((item) => ({
      time: item.dt_txt || item.time,
      temp: item.main?.temp || item.temp || item.temp_c,
      condition: item.weather?.[0]?.description || item.condition?.text || item.condition,
      rainChance: item.pop !== undefined ? Math.round(item.pop * 100) : item.chance_of_rain
    }));
  }

  return null;
}

app.post("/chat", async (req, res) => {
  try {
    const userMessage = req.body.message;
    const weather = req.body.weather;

    console.log("Message:", userMessage);
    console.log("FULL WEATHER OBJECT:", JSON.stringify(weather || null, null, 2));

    const messages = [];

    if (weather) {
      // Normalize weather data to handle common weather API formats.
      const normalizedWeather = {
        city: weather.city
          || weather.name
          || weather.location?.name
          || weather.weatherData?.location?.name
          || "Unknown",

        temp: weather.temp
          || weather.temperature
          || weather.temp_c
          || weather.main?.temp
          || weather.current?.temp_c
          || weather.weatherData?.current?.temp_c,

        condition: weather.condition
          || weather.description
          || weather.weather?.[0]?.description
          || weather.text
          || weather.current?.condition?.text
          || weather.weatherData?.current?.condition?.text
      };

      const forecastSummary = getForecastSummary(weather);

      console.log("Normalized weather:", normalizedWeather);
      console.log("Forecast summary:", forecastSummary);

      const hasWeatherData = normalizedWeather.city !== "Unknown"
        && normalizedWeather.temp !== undefined
        && normalizedWeather.temp !== null
        && normalizedWeather.temp !== ""
        && normalizedWeather.condition;

      if (!hasWeatherData) {
        return res.json({
          reply: "Please search for a city first, then I can answer weather-related questions for that location."
        });
      }

      messages.push({
        role: "user",
        content: `You are being used inside a weather app. You have weather information for the following city:

City: ${normalizedWeather.city}
Temperature: ${normalizedWeather.temp}°C
Condition: ${normalizedWeather.condition}
Forecast: ${forecastSummary ? JSON.stringify(forecastSummary) : "No forecast data provided"}

Answer in a friendly, practical way.
- If rain or high rain chance is shown, suggest carrying an umbrella or raincoat.
- If it is hot, suggest light breathable clothing, water, and shade.
- If it is cold, suggest warm layers.
- If forecast data is provided, use it for upcoming-weather questions like "later", "soon", "today", or "tomorrow".
- If forecast data is not provided, do not invent future weather. Say you only have the current conditions.
- Keep replies short and natural.

If the question is not about weather, answer normally.

Question: ${userMessage}`
      });
    } else {
      messages.push({
        role: "user",
        content: userMessage
      });
    }

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "openai/gpt-3.5-turbo",
        messages,
        max_tokens: 180
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
