import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class WeatherService {
  private apiUrl = 'http://localhost:8000/get-weather/';  // Backend URL

  constructor(private http: HttpClient) {}

  getWeather(golfCourse: string, city: string, country: string, date: string): Observable<any> {
    const date_str = date.split('T')[0];
    const body = {
        "golf_course_name": golfCourse,
        "city": city,
        "country": country,
        "date": date_str
      };
    return this.http.post<any>(this.apiUrl, body);
  }
}
