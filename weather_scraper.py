import openmeteo_requests
import requests_cache
import requests
import pandas as pd
from retry_requests import retry
import sys
# Setup Open-Meteo API client with caching and retry handling
cache_session = requests_cache.CachedSession('.cache', expire_after=3600)
retry_session = retry(cache_session, retries=5, backoff_factor=0.2)
openmeteo = openmeteo_requests.Client(session=retry_session)

import requests

def get_golf_course_location(golf_course_name, city=None, country=None):
    """Find latitude & longitude of a golf course using OpenStreetMap with proper headers."""
    base_url = "https://nominatim.openstreetmap.org/search"
    query = f"{golf_course_name}"
    
    if city:
        query += f", {city}"
    if country:
        query += f", {country}"
    
    params = {"q": query, "format": "json", "limit": 1}
    headers = {
        "User-Agent": "GolfApp/1.0 ben.brutocao@gmail.com"  # Replace with your email
    }

    try:
        response = requests.get(base_url, params=params, headers=headers, timeout=10)
        response.raise_for_status()  # Raise an error for bad responses (4xx, 5xx)

        if not response.text.strip():  # Check if response is empty
            print("⚠️ Empty response from OpenStreetMap API.")
            return None, None
        
        data = response.json()

        if data:
            return float(data[0]["lat"]), float(data[0]["lon"])
        else:
            print("⚠️ No results found for the golf course.")
            return None, None

    except requests.exceptions.RequestException as e:
        print(f"❌ Error fetching location: {e}")
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
    response = responses[0]  # Process first location
    
    # Extract hourly weather variables
    hourly = response.Hourly()
    hourly_time = pd.date_range(
        start=pd.to_datetime(hourly.Time(), unit="s", utc=True),
        periods=len(hourly.Variables(0).ValuesAsNumpy()),
        freq=pd.Timedelta(seconds=hourly.Interval())
    )

    # Store all hourly data in a dictionary
    hourly_data = {
        "time": hourly_time,
        "temperature_2m": hourly.Variables(0).ValuesAsNumpy(),
        "precipitation": hourly.Variables(1).ValuesAsNumpy(),
        "windspeed_10m": hourly.Variables(2).ValuesAsNumpy(),
    }

    return pd.DataFrame(hourly_data)


def main():
    golf_course_name = "Lions Municipal Golf Course"  # Change as needed
    city = "Austin"
    country = "USA"
    date = "2025-02-12"  # Format: YYYY-MM-DD

    # Get location
    lat, lon = get_golf_course_location(golf_course_name, city, country)

    if lat and lon:
        print(f"📍 Location: {lat}, {lon}")

        # Get weather data
        weather_data = get_hourly_weather(lat, lon, date)


        print(weather_data)

if __name__ == "__main__":
    sys.exit(main())