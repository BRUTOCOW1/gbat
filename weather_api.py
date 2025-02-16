from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import openmeteo_requests
import requests_cache
import requests
import pandas as pd
from retry_requests import retry

app = FastAPI()

# ✅ Allow CORS for Angular frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4255"],  # ✅ Change to your Angular frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Setup Open-Meteo API client
cache_session = requests_cache.CachedSession('.cache', expire_after=3600)
retry_session = retry(cache_session, retries=5, backoff_factor=0.2)
openmeteo = openmeteo_requests.Client(session=retry_session)

class WeatherRequest(BaseModel):
    golf_course_name: str
    city: str
    country: str
    date: str  # Format: YYYY-MM-DD

def get_golf_course_location(golf_course_name, city=None, country=None):
    """Find latitude & longitude of a golf course using OpenStreetMap."""
    base_url = "https://nominatim.openstreetmap.org/search"
    query = f"{golf_course_name}, {city}, {country}"
    
    params = {"q": query, "format": "json", "limit": 1}
    headers = {"User-Agent": "GolfApp/1.0 (your-email@example.com)"}  # Replace with your email

    try:
        response = requests.get(base_url, params=params, headers=headers, timeout=10)
        response.raise_for_status()

        data = response.json()
        if data:
            return float(data[0]["lat"]), float(data[0]["lon"])
        else:
            return None, None

    except requests.exceptions.RequestException:
        return None, None

def get_hourly_weather(lat, lon, date):
    """Fetch hourly weather data from Open-Meteo."""
    url = "https://archive-api.open-meteo.com/v1/archive"

    params = {
        "latitude": lat,
        "longitude": lon,
        "hourly": ["temperature_2m", "precipitation", "windspeed_10m"],  
        "start_date": date,
        "end_date": date,
        "timezone": "auto"
    }

    responses = openmeteo.weather_api(url, params=params)
    response = responses[0]  
    
    hourly = response.Hourly()
    hourly_time = pd.date_range(
        start=pd.to_datetime(hourly.Time(), unit="s", utc=True),
        periods=len(hourly.Variables(0).ValuesAsNumpy()),
        freq=pd.Timedelta(seconds=hourly.Interval())
    )

    weather_data = {
        "time": hourly_time.strftime('%Y-%m-%d %H:%M:%S').tolist(),
        "temperature_2m": hourly.Variables(0).ValuesAsNumpy().tolist(),
        "precipitation": hourly.Variables(1).ValuesAsNumpy().tolist(),
        "windspeed_10m": hourly.Variables(2).ValuesAsNumpy().tolist(),
    }

    return weather_data

@app.post("/get-weather/")
def get_weather(request: WeatherRequest):
    """API endpoint to get hourly weather for a golf course."""
    lat, lon = get_golf_course_location(request.golf_course_name, request.city, request.country)

    if lat is None or lon is None:
        return {"error": "Golf course not found"}

    weather = get_hourly_weather(lat, lon, request.date)
    return {"latitude": lat, "longitude": lon, "weather": weather}

# Run with: uvicorn weather_api:app --host 0.0.0.0 --port 8000 --reload
